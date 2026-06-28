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

// Ensure yt-dlp binary exists
async function ensureYtDlp() {
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
  if (!fs.existsSync(ytDlpPath)) {
    console.log(`yt-dlp not found at ${ytDlpPath}. Downloading latest release from GitHub...`);
    // yt-dlp-wrap has a default export or is a class
    const downloader = YTDlpWrap.default || YTDlpWrap;
    await downloader.downloadFromGithub(ytDlpPath);
    console.log('yt-dlp download complete!');
    if (!isWindows) {
      fs.chmodSync(ytDlpPath, 0o755); // make executable
    }
  }
}

// Security Validation
function isSafeUrl(url) {
  if (!url) return false;
  
  // 1. Regex check to restrict domain suffixes strictly
  const pattern = /^https?:\/\/([a-zA-Z0-9-]+\.)*(youtube\.com|youtu\.be|instagram\.com|dd\.instagram\.com)(:[0-9]+)?(\/.*)?$/i;
  if (!pattern.test(url)) return false;
  
  // 2. Prevent userinfo @ bypasses
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return false;
    
    const hostname = parsed.hostname.toLowerCase();
    const allowedDomains = ["youtube.com", "youtu.be", "instagram.com", "dd.instagram.com"];
    
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
      "googlevideo.com",
      ".cdninstagram.com",
      "cdninstagram.com",
      ".fbcdn.net",
      "fbcdn.net"
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
  
  const categories = {
    "1080p": { height: 1080, best: null },
    "720p": { height: 720, best: null },
    "360p": { height: 360, best: null },
    "audio": { height: null, best: null }
  };
  
  for (const fmt of formatsList) {
    const ext = fmt.ext || "";
    const height = fmt.height;
    const vcodec = fmt.vcodec || "none";
    const acodec = fmt.acodec || "none";
    const directUrl = fmt.url;
    
    if (!directUrl) continue;
    
    // Audio selection
    if (vcodec === "none" && acodec !== "none") {
      const abr = fmt.abr || 0;
      const currBest = categories.audio.best;
      if (!currBest) {
        categories.audio.best = fmt;
      } else {
        if (fmt.format_id === "140") { // Standard 128k m4a
          categories.audio.best = fmt;
        } else if (currBest.format_id !== "140" && Math.abs(abr - 128) < Math.abs((currBest.abr || 0) - 128)) {
          categories.audio.best = fmt;
        }
      }
    }
    
    // Video resolution match
    if ([1080, 720, 360].includes(height)) {
      const catKey = `${height}p`;
      const currBest = categories[catKey].best;
      
      if (!currBest) {
        categories[catKey].best = fmt;
      } else {
        const currMuxed = (currBest.acodec !== "none" && currBest.vcodec !== "none");
        const fmtMuxed = (acodec !== "none" && vcodec !== "none");
        
        if (currBest.ext !== "mp4" && ext === "mp4") {
          categories[catKey].best = fmt;
        } else if ((currBest.ext === "mp4" && ext === "mp4") || (currBest.ext !== "mp4" && ext !== "mp4")) {
          if (fmtMuxed && !currMuxed) {
            categories[catKey].best = fmt;
          } else if (fmtMuxed === currMuxed) {
            if ((fmt.tbr || 0) > (currBest.tbr || 0)) {
              categories[catKey].best = fmt;
            }
          }
        }
      }
    }
  }
  
  // Compile the final format maps
  const audioBest = categories.audio.best;
  const audioUrl = audioBest ? audioBest.url : null;

  for (const [key, val] of Object.entries(categories)) {
    const fmt = val.best;
    if (fmt) {
      const height = fmt.height;
      const ext = fmt.ext || "";
      const format_id = fmt.format_id || "";
      const directUrl = fmt.url || "";
      
      let label, displayExt;
      if (key === "audio") {
        label = "MP3 Audio (128kbps)";
        displayExt = "mp3";
      } else {
        label = `MP4 ${key}`;
        displayExt = "mp4";
      }
      
      const isVideoOnly = key !== "audio" && (fmt.acodec === "none" || !fmt.acodec);
      
      selectedFormats.push({
        label,
        resolution: height ? `${height}p` : "Audio",
        ext: displayExt,
        format_id,
        url: directUrl,
        filesize: fmt.filesize || fmt.filesize_approx,
        audioUrl: isVideoOnly ? audioUrl : null
      });
    }
  }
  
  // For Instagram/other platforms that serve arbitrary sizes
  if (selectedFormats.length === 0) {
    for (const fmt of formatsList) {
      const height = fmt.height;
      const ext = fmt.ext || "mp4";
      const directUrl = fmt.url;
      if (!directUrl) continue;
      
      if (height) {
        selectedFormats.push({
          label: `MP4 ${height}p`,
          resolution: `${height}p`,
          ext: ext.includes("mp4") ? "mp4" : ext,
          format_id: fmt.format_id || "",
          url: directUrl,
          filesize: fmt.filesize || fmt.filesize_approx
        });
      }
    }
    
    // Sort and limit
    selectedFormats.sort((a, b) => {
      const hA = parseInt(a.resolution.replace("p", "")) || 0;
      const hB = parseInt(b.resolution.replace("p", "")) || 0;
      return hB - hA;
    });
    return selectedFormats.slice(0, 4);
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
    return res.status(400).json({ detail: "Forbidden: Only YouTube and Instagram URLs are allowed." });
  }
  
  try {
    await ensureYtDlp();
    const ytDlp = new YTDlpWrap(ytDlpPath);
    
    // Run yt-dlp metadata extraction
    const stdout = await ytDlp.execPromise([
      url,
      "-J",
      "--no-playlist",
      "--no-warnings"
    ]);
    
    const data = JSON.parse(stdout);
    const title = data.title || "Video Download";
    const thumbnail = data.thumbnail || (data.thumbnails && data.thumbnails.length > 0 ? data.thumbnails[0].url : "");
    const platform = url.toLowerCase().includes("youtu") ? "YouTube" : "Instagram";
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
  const { url, audioUrl, title = 'download', format = 'mp4' } = req.query;
  
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
  
  if (audioUrl && ext === "mp4") {
    // We need to mux video and audio!
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", "video/mp4");
    
    // We use ffmpeg to merge them.
    // Since it's a full download, we do copy codec if possible for fast merging
    const ffmpegArgs = [
      '-i', url,
      '-i', audioUrl,
      '-c:v', 'copy',
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
      if (log.includes('Error')) {
        console.error(`FFmpeg stderr during download muxing: ${log}`);
      }
    });
    
    ffmpegProcess.on('error', (err) => {
      console.error("FFmpeg download muxing process error:", err);
      if (!res.headersSent) {
        res.status(500).json({ detail: `FFmpeg transcoding failed: ${err.message}` });
      }
    });
    
    ffmpegProcess.on('close', (code) => {
      console.log(`FFmpeg download muxing finished with code ${code}`);
    });
    
    req.on('close', () => {
      console.log("Client download connection closed. Killing FFmpeg process...");
      ffmpegProcess.kill('SIGKILL');
    });
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
    
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }
    
    // Pipe response body to Express response stream
    const readable = Readable.fromWeb(response.body);
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
  const { videoUrl, audioUrl, start = 0, end = 10, crop = 'landscape', title = 'clip' } = req.query;

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

  const ffmpegArgs = [];

  // Add inputs with seeking
  if (audioUrl) {
    ffmpegArgs.push(
      '-ss', startSec.toString(),
      '-i', videoUrl,
      '-ss', startSec.toString(),
      '-i', audioUrl
    );
  } else {
    ffmpegArgs.push(
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

// Serve frontend build static files in production
const frontendBuildPath = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// Start server
app.listen(PORT, async () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
  try {
    await ensureYtDlp();
  } catch (err) {
    console.error("Warning: Failed to ensure yt-dlp on startup:", err.message);
  }
});
