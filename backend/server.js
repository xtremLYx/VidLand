import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import YTDlpWrapPackage from 'yt-dlp-wrap';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
const YTDlpWrap = YTDlpWrapPackage.default || YTDlpWrapPackage;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

// Setup directories relative to the file location
const binDir = path.resolve(__dirname, 'bin');
const isWindows = process.platform === 'win32';
const ytDlpFilename = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const ytDlpPath = path.join(binDir, ytDlpFilename);

// Ensure yt-dlp binary exists & is updated to the latest release
async function ensureYtDlp() {
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
  const downloader = YTDlpWrap.default || YTDlpWrap;
  if (!fs.existsSync(ytDlpPath)) {
    console.log(`yt-dlp not found at ${ytDlpPath}. Downloading latest release from GitHub...`);
    await downloader.downloadFromGithub(ytDlpPath);
    console.log('yt-dlp download complete!');
    if (!isWindows) {
      fs.chmodSync(ytDlpPath, 0o755); // make executable
    }
  } else {
    try {
      console.log("Ensuring latest yt-dlp binary version...");
      const ytDlp = new YTDlpWrap(ytDlpPath);
      await ytDlp.execPromise(["-U"]);
    } catch (e) {
      console.log("yt-dlp self-update status:", e.message);
    }
  }
}

// Security Validation
function isSafeUrl(url) {
  if (!url) return false;
  
  // 1. Regex check to restrict domain suffixes strictly
  const pattern = /^https?:\/\/([a-zA-Z0-9-]+\.)*(youtube\.com|youtu\.be)(:[0-9]+)?(\/.*)?$/i;
  if (!pattern.test(url)) return false;
  
  // 2. Prevent userinfo @ bypasses
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return false;
    
    const hostname = parsed.hostname.toLowerCase();
    const allowedDomains = ["youtube.com", "youtu.be"];
    
    const matched = allowedDomains.some(domain => 
      hostname === domain || hostname.endsWith("." + domain)
    );
    
    return matched;
  } catch (e) {
    return false;
  }
}

// CDN Hostname Verification
function validateCdnUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    const allowedSuffixes = [
      ".googlevideo.com",
      "googlevideo.com"
    ];
    
    return allowedSuffixes.some(suffix => 
      hostname === suffix || hostname.endsWith(suffix)
    );
  } catch (e) {
    return false;
  }
}

// Sanitize titles for filename
function sanitizeFilename(filename) {
  const sanitized = filename.replace(/[\\/*?:"<>|]/g, "");
  return sanitized.trim();
}

// Parse timestamp to seconds (supports seconds, MM:SS, or HH:MM:SS)
function parseTimestamp(ts) {
  if (typeof ts === 'number') return ts;
  if (!ts) return 0;
  
  const parts = ts.toString().split(':').map(Number);
  if (parts.some(isNaN)) {
    const parsed = parseFloat(ts);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

// Extract quality formats from yt-dlp data
function extractFormats(ytdlpData, url) {
  const formatsList = ytdlpData.formats || [];
  const selectedFormats = [];
  
  let bestAudio = null;
  const heightMap = new Map();
  
  for (const fmt of formatsList) {
    const ext = fmt.ext || "";
    const height = fmt.height;
    const vcodec = fmt.vcodec || "none";
    const acodec = fmt.acodec || "none";
    const directUrl = fmt.url;
    
    if (!directUrl) continue;
    
    // Audio track selection
    if (vcodec === "none" && acodec !== "none") {
      const abr = fmt.abr || 0;
      if (!bestAudio) {
        bestAudio = fmt;
      } else if (fmt.format_id === "140") {
        bestAudio = fmt;
      } else if (bestAudio.format_id !== "140" && Math.abs(abr - 128) < Math.abs((bestAudio.abr || 0) - 128)) {
        bestAudio = fmt;
      }
      continue;
    }
    
    // Video format matching per resolution height
    if (height && vcodec !== "none") {
      const existing = heightMap.get(height);
      if (!existing) {
        heightMap.set(height, fmt);
      } else {
        const fmtMuxed = (acodec !== "none" && vcodec !== "none");
        const existingMuxed = (existing.acodec !== "none" && (existing.vcodec || "none") !== "none");
        const fmtH264 = vcodec.includes("avc1");
        const existingH264 = (existing.vcodec || "").includes("avc1");
        
        if (fmtH264 && !existingH264) {
          heightMap.set(height, fmt);
        } else if (fmtH264 === existingH264) {
          if (fmtMuxed && !existingMuxed) {
            heightMap.set(height, fmt);
          } else if (fmtMuxed === existingMuxed) {
            if ((fmt.tbr || 0) > (existing.tbr || 0)) {
              heightMap.set(height, fmt);
            }
          }
        }
      }
    }
  }
  
  const audioUrl = bestAudio ? bestAudio.url : null;
  const audioSize = bestAudio ? (bestAudio.filesize || bestAudio.filesize_approx || 0) : 0;
  const sortedHeights = Array.from(heightMap.keys()).sort((a, b) => b - a);
  
  sortedHeights.forEach((height, idx) => {
    const fmt = heightMap.get(height);
    const isVideoOnly = fmt.acodec === "none" || !fmt.acodec;
    const isMaxQuality = (idx === 0);
    
    let qualityBadge = `${height}p`;
    if (height >= 2160) qualityBadge = `${height}p (4K Ultra HD)`;
    else if (height === 1440) qualityBadge = `${height}p (2K Quad HD)`;
    else if (height === 1080) qualityBadge = `1080p (Full HD)`;
    
    const label = isMaxQuality ? `MP4 ${qualityBadge} 🔥 [Max Quality]` : `MP4 ${qualityBadge}`;
    
    const rawVideoSize = fmt.filesize || fmt.filesize_approx || 0;
    const totalCalculatedSize = rawVideoSize > 0 ? (isVideoOnly ? rawVideoSize + audioSize : rawVideoSize) : (audioSize > 0 && isVideoOnly ? audioSize : null);
    
    selectedFormats.push({
      label,
      resolution: `${height}p`,
      ext: "mp4",
      format_id: fmt.format_id || "",
      url: fmt.url,
      filesize: totalCalculatedSize,
      audioUrl: isVideoOnly ? audioUrl : null
    });
  });
  
  if (bestAudio) {
    selectedFormats.push({
      label: "MP3 Audio (128kbps)",
      resolution: "Audio",
      ext: "mp3",
      format_id: bestAudio.format_id || "",
      url: bestAudio.url,
      filesize: bestAudio.filesize || bestAudio.filesize_approx || null,
      audioUrl: null
    });
  }
  
  return selectedFormats;
}

// Middleware
app.use(cors());
app.use(express.json());

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: { detail: "Too many requests. Please try again after 5 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// API Routes
app.post('/api/fetch', apiLimiter, async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ detail: "URL is required." });
  }
  
  if (!isSafeUrl(url)) {
    return res.status(400).json({ detail: "Forbidden: Only YouTube URLs are allowed." });
  }
  
  try {
    await ensureYtDlp();
    const ytDlp = new YTDlpWrap(ytDlpPath);
    
    // Run yt-dlp metadata extraction with player client fallbacks to handle YouTube restrictions
    const stdout = await ytDlp.execPromise([
      url,
      "-J",
      "--no-playlist",
      "--no-warnings",
      "--geo-bypass",
      "--extractor-args",
      "youtube:player_client=android,web,mweb,tv"
    ]);
    
    const data = JSON.parse(stdout);
    const title = data.title || "Video Download";
    const thumbnail = data.thumbnail || (data.thumbnails && data.thumbnails.length > 0 ? data.thumbnails[0].url : "");
    const platform = "YouTube";
    const duration = data.duration || 0;
    
    const formats = extractFormats(data, url);
    
    res.json({
      title,
      thumbnail,
      platform,
      duration,
      formats
    });
  } catch (error) {
    console.error("Error executing yt-dlp:", error);
    
    const errMessage = error.message || "";
    if (errMessage.toLowerCase().includes("private")) {
      res.status(403).json({ detail: "This video is private. Private content cannot be downloaded." });
    } else if (errMessage.toLowerCase().includes("age") || errMessage.toLowerCase().includes("sign in")) {
      res.status(403).json({ detail: "This video is age-restricted or requires account login." });
    } else if (errMessage.toLowerCase().includes("geo") || errMessage.toLowerCase().includes("country")) {
      res.status(403).json({ detail: "This video is geoblocked and unavailable in this region." });
    } else {
      res.status(500).json({ detail: "Failed to retrieve video information. Verify the URL is valid and public." });
    }
  }
});

app.get('/api/download', async (req, res) => {
  const { url, audioUrl, title = 'download', format = 'mp4', size } = req.query;
  
  if (!url) {
    return res.status(400).json({ detail: "URL query parameter is required." });
  }
  
  if (!validateCdnUrl(url) || (audioUrl && !validateCdnUrl(audioUrl))) {
    return res.status(400).json({ detail: "Forbidden: The requested stream URL does not belong to a trusted CDN." });
  }
  
  // Normalize extension
  let ext = "mp4";
  const formatLower = format.toLowerCase();
  if (formatLower.includes("mp3") || formatLower.includes("audio") || formatLower.includes("140")) {
    ext = formatLower.includes("mp3") ? "mp3" : "m4a";
  } else if (formatLower.includes("webm")) {
    ext = "webm";
  } else if (formatLower.includes("m4a")) {
    ext = "m4a";
  }
  
  const sanitizedTitle = sanitizeFilename(title) || "video";
  const filename = `${sanitizedTitle}.${ext}`;
  const expectedSize = (size && !isNaN(parseInt(size))) ? parseInt(size, 10) : null;
  
  if (ext === "mp3") {
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", "audio/mpeg");
    if (expectedSize && expectedSize > 0) {
      res.setHeader("Content-Length", expectedSize.toString());
    }
    
    const ffHeaders = "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n";
    const ffmpegArgs = [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-headers', ffHeaders,
      '-i', url,
      '-vn',
      '-c:a', 'libmp3lame',
      '-q:a', '2',
      '-f', 'mp3',
      'pipe:1'
    ];
    
    console.log(`Starting FFmpeg MP3 transcoding: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
    ffmpegProcess.stdout.pipe(res);
    
    ffmpegProcess.stderr.on('data', (data) => {
      const log = data.toString();
      if (log.includes('Error')) console.error(`FFmpeg stderr: ${log}`);
    });
    ffmpegProcess.on('error', (err) => {
      console.error("FFmpeg MP3 process error:", err);
      if (!res.headersSent) res.status(500).json({ detail: `FFmpeg MP3 conversion failed: ${err.message}` });
    });
    req.on('close', () => ffmpegProcess.kill('SIGKILL'));
    return;
  }
  
  if (audioUrl && ext === "mp4") {
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", "video/mp4");
    if (expectedSize && expectedSize > 0) {
      res.setHeader("Content-Length", expectedSize.toString());
    }
    
    const ffHeaders = "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n";
    const ffmpegArgs = [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-headers', ffHeaders,
      '-i', url,
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-headers', ffHeaders,
      '-i', audioUrl,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-c:a', 'aac',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-f', 'mp4',
      '-movflags', 'frag_keyframe+empty_moov',
      'pipe:1'
    ];
    
    console.log(`Starting FFmpeg download muxing: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);
    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
    ffmpegProcess.stdout.pipe(res);
    
    ffmpegProcess.stderr.on('data', (data) => {
      const log = data.toString();
      if (log.includes('Error')) console.error(`FFmpeg stderr during download muxing: ${log}`);
    });
    ffmpegProcess.on('error', (err) => {
      console.error("FFmpeg download process error:", err);
      if (!res.headersSent) res.status(500).json({ detail: `FFmpeg download failed: ${err.message}` });
    });
    req.on('close', () => ffmpegProcess.kill('SIGKILL'));
    return;
  }
  
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Encoding": "identity", // No compression
    "Connection": "keep-alive"
  };
  
  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      console.error(`CDN returned status ${response.status}`);
      return res.status(502).json({ 
        detail: "Media host returned error. The download link may have expired — try fetching again." 
      });
    }
    
    // Setup response headers
    let contentType = response.headers.get("content-type") || `video/${ext}`;
    if (ext === "mp3") contentType = "audio/mpeg";
    else if (ext === "m4a") contentType = "audio/mp4";
    
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", contentType);
    
    const contentLength = expectedSize || response.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength.toString());
    }
    
    // Pipe response body to Express response stream with 1MB highWaterMark for max download speed
    const readable = Readable.fromWeb(response.body, { highWaterMark: 1024 * 1024 });
    readable.pipe(res);
    
    readable.on('error', (err) => {
      console.error(`Error during stream processing for ${filename}:`, err);
    });
    
  } catch (error) {
    console.error(`Failed to proxy download connection:`, error);
    res.status(500).json({ detail: `Failed to connect to media host: ${error.message}` });
  }
});

app.get('/api/trim', async (req, res) => {
  const { videoUrl, audioUrl, start = 0, end = 10, crop = 'landscape', title = 'clip', size } = req.query;

  if (!videoUrl) {
    return res.status(400).json({ detail: "videoUrl is required." });
  }

  // Validate URLs are safe CDNs
  if (!validateCdnUrl(videoUrl) || (audioUrl && !validateCdnUrl(audioUrl))) {
    return res.status(400).json({ detail: "Forbidden: The requested stream URLs do not belong to a trusted CDN." });
  }

  const startSec = parseTimestamp(start);
  const endSec = parseTimestamp(end);
  const durationSec = endSec - startSec;

  if (durationSec <= 0) {
    return res.status(400).json({ detail: "End time must be greater than start time." });
  }

  if (durationSec > 300) {
    return res.status(400).json({ detail: "Maximum duration for trimming is 5 minutes." });
  }

  const sanitizedTitle = sanitizeFilename(title) || "clip";
  const filename = `${sanitizedTitle}_trimmed.mp4`;

  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader("Content-Type", "video/mp4");
  if (size && !isNaN(parseInt(size)) && parseInt(size) > 0) {
    res.setHeader("Content-Length", parseInt(size).toString());
  }

  const ffmpegArgs = [];

  const ffHeaders = "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n";

  // Add inputs with seeking
  if (audioUrl) {
    ffmpegArgs.push(
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-headers', ffHeaders,
      '-ss', startSec.toString(),
      '-i', videoUrl,
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-headers', ffHeaders,
      '-ss', startSec.toString(),
      '-i', audioUrl
    );
  } else {
    ffmpegArgs.push(
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-headers', ffHeaders,
      '-ss', startSec.toString(),
      '-i', videoUrl
    );
  }

  // Duration limit
  ffmpegArgs.push('-t', durationSec.toString());

  // Crop / map filter setup
  if (crop === 'vertical') {
    if (audioUrl) {
      ffmpegArgs.push(
        '-filter_complex', '[0:v]crop=ih*9/16:ih[v]',
        '-map', '[v]',
        '-map', '1:a'
      );
    } else {
      ffmpegArgs.push(
        '-vf', 'crop=ih*9/16:ih'
      );
    }
  } else {
    if (audioUrl) {
      ffmpegArgs.push(
        '-map', '0:v',
        '-map', '1:a'
      );
    }
  }

  // Encoding & Output
  ffmpegArgs.push(
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-c:a', 'aac',
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov',
    'pipe:1'
  );

  console.log(`Starting FFmpeg trim: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);

  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

  ffmpegProcess.stdout.pipe(res);

  ffmpegProcess.stderr.on('data', (data) => {
    const log = data.toString();
    if (log.includes('Error')) {
      console.error(`FFmpeg stderr: ${log}`);
    }
  });

  ffmpegProcess.on('error', (err) => {
    console.error("FFmpeg process error:", err);
    if (!res.headersSent) {
      res.status(500).json({ detail: `FFmpeg transcoding failed: ${err.message}` });
    }
  });

  ffmpegProcess.on('close', (code) => {
    console.log(`FFmpeg process finished with code ${code}`);
  });

  req.on('close', () => {
    console.log("Client connection closed. Killing FFmpeg process...");
    ffmpegProcess.kill('SIGKILL');
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
  try {
    await ensureYtDlp();
  } catch (err) {
    console.error("Warning: Failed to ensure yt-dlp on startup:", err.message);
  }
});
