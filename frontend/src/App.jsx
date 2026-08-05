import { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  
  // Active tab state: 'download' (default) | 'trim'
  const [activeTab, setActiveTab] = useState('download');
  
  // Download tab sub-format state: 'mp4' (default) | 'mp3'
  const [downloadSubTab, setDownloadSubTab] = useState('mp4');

  // Trimming engine states
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(15);
  const [cropRatio, setCropRatio] = useState('landscape');
  const [selectedFormatIndex, setSelectedFormatIndex] = useState(0);
  
  // Scroll state to reveal 2nd section on scroll
  const [isScrolled, setIsScrolled] = useState(false);

  const formRef = useRef(null);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Initialize history
  useEffect(() => {
    const savedHistory = localStorage.getItem('fetch_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);


  // Window scroll listener for 2nd section visibility
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Initialize trim limits when result loads
  useEffect(() => {
    if (result) {
      setTrimStart(0);
      setTrimEnd(result.duration && result.duration > 0 ? Math.min(15, result.duration) : 15);
      setSelectedFormatIndex(0);
      setActiveTab('download'); // Default to download tab when new result loads
      setDownloadSubTab('mp4'); // Default to MP4 sub-tab when new result loads
    }
  }, [result]);



  // Clipboard Paste helper
  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrl(text.trim());
        }
      } else {
        alert("Clipboard access not supported or blocked by browser. Please paste manually using Ctrl+V.");
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  // File size formatter
  const formatBytes = (bytes) => {
    if (!bytes || isNaN(bytes)) return "Unknown size";
    const units = ["B", "KB", "MB", "GB"];
    let l = 0, n = parseInt(bytes, 10) || 0;
    while (n >= 1024 && ++l) {
      n = n / 1024;
    }
    return n.toFixed(1) + "\u00A0" + units[l];
  };

  // Convert seconds to human readable time
  const formatTime = (secs) => {
    if (isNaN(secs) || secs === null) return "0:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const ss = s.toString().padStart(2, '0');
    
    if (h > 0) {
      const mm = m.toString().padStart(2, '0');
      return `${h}:${mm}:${ss}`;
    }
    return `${m}:${ss}`;
  };

  // Build the HTTP GET query URL for downloading trimmed clip
  const getTrimDownloadUrl = () => {
    if (!result || !result.formats || result.formats.length === 0) return '';
    
    const selectedFormat = result.formats[selectedFormatIndex];
    const isAudioOnly = selectedFormat.resolution === 'Audio';
    
    const audioFormat = result.formats.find(f => f.resolution === 'Audio');
    const audioUrlParam = audioFormat ? `&audioUrl=${encodeURIComponent(audioFormat.url)}` : '';
    
    const needsAudioMux = !isAudioOnly && !selectedFormat.label.toLowerCase().includes('audio') && audioFormat;
    
    const trimDuration = trimEnd - trimStart;
    let sizeParam = '';
    if (result.duration && result.duration > 0 && selectedFormat.filesize) {
      const estimatedSize = Math.round((trimDuration / result.duration) * selectedFormat.filesize);
      if (estimatedSize > 0) {
        sizeParam = `&size=${estimatedSize}`;
      }
    }
    
    return `/api/trim?videoUrl=${encodeURIComponent(selectedFormat.url)}` + 
      (needsAudioMux ? audioUrlParam : '') + 
      `&start=${trimStart}&end=${trimEnd}&crop=${cropRatio}&title=${encodeURIComponent(result.title)}` +
      sizeParam;
  };

  // Save successful fetch to history
  const saveToHistory = (videoData, targetUrl) => {
    let currentHistory = [...history];
    // Remove if already exists
    currentHistory = currentHistory.filter(item => item.url !== targetUrl);
    // Prepend new item
    currentHistory.unshift({
      url: targetUrl,
      title: videoData.title,
      thumbnail: videoData.thumbnail,
      platform: videoData.platform,
      timestamp: Date.now()
    });
    // Limit to 5
    currentHistory = currentHistory.slice(0, 5);
    
    setHistory(currentHistory);
    localStorage.setItem('fetch_history', JSON.stringify(currentHistory));
  };

  // Clear search history
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('fetch_history');
  };

  // Form submission handler
  const handleFetch = async (e, directUrl = null) => {
    if (e) e.preventDefault();
    
    const targetUrl = (directUrl || url).trim();
    if (!targetUrl) return;

    setError('');
    setResult(null);
    setLoading(true);

    try {
      const response = await fetch('/api/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: targetUrl })
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Backend URL connection error. Please verify your live Render backend URL in vercel.json.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'An error occurred fetching metadata.');
      }

      setResult(data);
      saveToHistory(data, targetUrl);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || 'An unexpected network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Click handler for history cards
  const handleHistoryClick = (item) => {
    setUrl(item.url);
    handleFetch(null, item.url);
  };

  return (
    <>
      {/* Global Glassmorphic Header */}
      <Header currentPath="/" />


      {/* SECTION 1: Hero & Downloader Landing Section (100% Height) */}
      <section className="hero-landing-section">
        <div className="hero-landing-container">
          {/* Hero Header Section */}
        <section className="hero-section">
          <h1 className="hero-title">Video downloads,<br />refined and secure.</h1>
          <p className="hero-subtitle">Paste a YouTube link to start. High-speed memory proxy streaming, zero storage footprint, complete privacy.</p>
        </section>

        {/* Main Downloader Interface */}
        <section className="downloader-card-container">
          <div className="downloader-card">
            <form ref={formRef} onSubmit={(e) => handleFetch(e)} className="fetch-form">
              <div className="input-wrapper">
                <span className="search-input-icon" aria-hidden="true">⚡</span>
                <input 
                  type="url" 
                  name="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube link…" 
                  required 
                  autoComplete="off"
                  inputMode="url"
                  spellCheck={false}
                  aria-label="YouTube Video URL"
                />
                <button type="button" onClick={handlePaste} className="paste-btn" aria-label="Paste URL from clipboard" title="Paste from clipboard">
                  <span>Paste</span>
                </button>
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>
                <span>{loading ? "Processing…" : "Fetch Video"}</span>
              </button>
            </form>

            {/* Processing Spinner Indicator */}
            {loading && (
              <div className="spinner-container" aria-live="polite">
                <div className="apple-spinner-ring" aria-hidden="true">
                  <div></div><div></div><div></div><div></div>
                </div>
                <p className="loading-message">Retrieving video metadata…</p>
              </div>
            )}
            
            {/* Error Notice Panel */}
            {error && (
              <div className="error-panel" aria-live="polite">
                <div className="error-content">
                  <span className="error-icon" aria-hidden="true">⚠</span>
                  <p className="error-message">{error}</p>
                </div>
              </div>
            )}

            {/* Video Result Presentation panel */}
            {result && (
              <div className="result-panel">
                <div className="result-meta-container">
                  <div className="thumbnail-wrapper">
                    <img 
                      src={result.thumbnail || "https://placehold.co/600x400?text=No+Thumbnail"} 
                      alt={`Thumbnail for ${result.title}`}
                      width="140"
                      height="78"
                      loading="lazy"
                      onError={(e) => {
                        e.target.src = "https://placehold.co/600x400?text=Thumbnail+Not+Found";
                      }}
                    />
                  </div>
                  <div className="video-info">
                    <div className="badge-row">
                      <span className="platform-badge">
                        {result.platform}
                      </span>
                    </div>
                    <h2 className="video-title">{result.title}</h2>
                  </div>
                </div>

                {/* Tab Navigation Controls */}
                <nav className="tab-navigation" role="tablist" aria-label="Media options">
                  <button 
                    role="tab"
                    id="tab-download"
                    aria-selected={activeTab === 'download'}
                    aria-controls="panel-download"
                    className={`tab-btn ${activeTab === 'download' ? 'active' : ''}`}
                    onClick={() => setActiveTab('download')}
                  >
                    <span aria-hidden="true">⚡</span> Video Downloads
                  </button>
                  <button 
                    role="tab"
                    id="tab-trim"
                    aria-selected={activeTab === 'trim'}
                    aria-controls="panel-trim"
                    className={`tab-btn ${activeTab === 'trim' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trim')}
                  >
                    <span aria-hidden="true">✂</span> Shorts-Cutter (Trim & Crop)
                  </button>
                </nav>

                {/* Tab Panel 1: Video Downloads (Default) */}
                {activeTab === 'download' && (() => {
                  const filteredFormats = (result.formats || []).filter(fmt => {
                    const isMp3 = fmt.ext?.toLowerCase() === 'mp3' || fmt.resolution === 'Audio';
                    return downloadSubTab === 'mp3' ? isMp3 : !isMp3;
                  });

                  return (
                    <div id="panel-download" role="tabpanel" aria-labelledby="tab-download" className="tab-panel">
                      {/* Format Sub-tab Navigation */}
                      <div className="sub-tab-navigation" role="tablist" aria-label="Format options">
                        <button 
                          role="tab"
                          id="subtab-mp4"
                          aria-selected={downloadSubTab === 'mp4'}
                          aria-controls="subpanel-mp4"
                          className={`sub-tab-btn ${downloadSubTab === 'mp4' ? 'active' : ''}`}
                          onClick={() => setDownloadSubTab('mp4')}
                        >
                          <span aria-hidden="true">🎬</span> MP4 Video
                        </button>
                        <button 
                          role="tab"
                          id="subtab-mp3"
                          aria-selected={downloadSubTab === 'mp3'}
                          aria-controls="subpanel-mp3"
                          className={`sub-tab-btn ${downloadSubTab === 'mp3' ? 'active' : ''}`}
                          onClick={() => setDownloadSubTab('mp3')}
                        >
                          <span aria-hidden="true">🎵</span> MP3 Audio Only
                        </button>
                      </div>

                      {/* Desktop Table View */}
                      <div className="formats-table-wrapper desktop-only">
                        <table className="formats-table">
                          <thead>
                            <tr>
                              <th scope="col">{downloadSubTab === 'mp3' ? 'Quality / Format' : 'Resolution'}</th>
                              <th scope="col">Format</th>
                              <th scope="col">Estimated Size</th>
                              <th scope="col">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredFormats.length === 0 ? (
                              <tr>
                                <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 16px' }}>
                                  No {downloadSubTab === 'mp3' ? 'audio' : 'video'} formats found for this media.
                                </td>
                              </tr>
                            ) : (
                              filteredFormats.map((fmt, i) => {
                                const downloadUrl = `/api/download?url=${encodeURIComponent(fmt.url)}` + 
                                  (fmt.audioUrl ? `&audioUrl=${encodeURIComponent(fmt.audioUrl)}` : '') + 
                                  `&title=${encodeURIComponent(result.title)}&format=${encodeURIComponent(fmt.format_id || fmt.label)}` +
                                  (fmt.filesize ? `&size=${fmt.filesize}` : '');
                                return (
                                  <tr key={i}>
                                    <td style={{ fontWeight: '600' }}>{fmt.label}</td>
                                    <td>{fmt.ext.toUpperCase()}</td>
                                    <td className="tabular-num">{formatBytes(fmt.filesize)}</td>
                                    <td>
                                      <a 
                                        className="download-link-btn" 
                                        href={downloadUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`Download ${result.title} in ${fmt.label}`}
                                      >
                                        Download
                                      </a>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Responsive Cards View */}
                      <div className="mobile-formats-list mobile-only">
                        {filteredFormats.length === 0 ? (
                          <p className="no-formats-msg" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px 0' }}>
                            No {downloadSubTab === 'mp3' ? 'audio' : 'video'} formats found for this media.
                          </p>
                        ) : (
                          filteredFormats.map((fmt, i) => {
                            const downloadUrl = `/api/download?url=${encodeURIComponent(fmt.url)}` + 
                              (fmt.audioUrl ? `&audioUrl=${encodeURIComponent(fmt.audioUrl)}` : '') + 
                              `&title=${encodeURIComponent(result.title)}&format=${encodeURIComponent(fmt.format_id || fmt.label)}` +
                              (fmt.filesize ? `&size=${fmt.filesize}` : '');
                            return (
                              <div className="mobile-format-card" key={i}>
                                <div className="mobile-format-meta">
                                  <span className="mobile-format-title">{fmt.label}</span>
                                  <span className="mobile-format-sub tabular-num">
                                    {fmt.ext.toUpperCase()} &bull; {formatBytes(fmt.filesize)}
                                  </span>
                                </div>
                                <a 
                                  className="mobile-download-btn" 
                                  href={downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Download ${result.title} in ${fmt.label}`}
                                >
                                  Download ({fmt.ext.toUpperCase()})
                                </a>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Tab Panel 2: Shorts-Cutter Trim Section */}
                {activeTab === 'trim' && (
                  <div id="panel-trim" role="tabpanel" aria-labelledby="tab-trim" className="tab-panel">
                    <div className="trim-section-card">
                      <div className="trim-card-header">
                        <span className="trim-icon" aria-hidden="true">✂</span>
                        <h3 className="trim-card-title">Shorts-Cutter: Trim & Crop</h3>
                      </div>
                      
                      <div className="trim-controls-grid">
                        <div className="trim-control-group">
                          <label className="control-label" htmlFor="aspect-ratio-toggle">Aspect Ratio</label>
                          <div className="crop-toggle-buttons" id="aspect-ratio-toggle">
                            <button 
                              type="button"
                              className={`crop-btn ${cropRatio === 'landscape' ? 'active' : ''}`}
                              onClick={() => setCropRatio('landscape')}
                              aria-pressed={cropRatio === 'landscape'}
                            >
                              Landscape (Original)
                            </button>
                            <button 
                              type="button"
                              className={`crop-btn ${cropRatio === 'vertical' ? 'active' : ''}`}
                              onClick={() => setCropRatio('vertical')}
                              aria-pressed={cropRatio === 'vertical'}
                            >
                              Vertical (9:16 Crop)
                            </button>
                          </div>
                        </div>

                        <div className="trim-control-group">
                          <label className="control-label" htmlFor="quality-select">Target Quality</label>
                          <select 
                            id="quality-select"
                            value={selectedFormatIndex}
                            onChange={(e) => setSelectedFormatIndex(parseInt(e.target.value))}
                            className="quality-select-dropdown"
                            aria-label="Target quality select"
                          >
                            {result.formats.map((fmt, idx) => (
                              <option key={idx} value={idx}>
                                {fmt.label} ({fmt.ext.toUpperCase()})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="trim-range-container">
                        <div className="range-labels">
                          <span>Start: <strong className="tabular-num">{formatTime(trimStart)}</strong></span>
                          <span>End: <strong className="tabular-num">{formatTime(trimEnd)}</strong></span>
                          <span>Duration: <strong className="tabular-num">{trimEnd - trimStart}s</strong></span>
                        </div>

                        <div className="sliders-wrapper">
                          <div className="slider-row">
                            <span className="slider-type-lbl">Start</span>
                            <input 
                              type="range"
                              min="0"
                              max={result.duration || 300}
                              value={trimStart}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setTrimStart(Math.min(val, trimEnd - 1));
                              }}
                              className="trim-slider start-slider"
                              aria-label="Trim start timestamp slider"
                            />
                          </div>
                          <div className="slider-row">
                            <span className="slider-type-lbl">End</span>
                            <input 
                              type="range"
                              min="1"
                              max={result.duration || 300}
                              value={trimEnd}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setTrimEnd(Math.max(val, trimStart + 1));
                              }}
                              className="trim-slider end-slider"
                              aria-label="Trim end timestamp slider"
                            />
                          </div>
                        </div>

                        <div className="preset-buttons-container">
                          <span className="preset-label">Presets:</span>
                          <button 
                            type="button" 
                            onClick={() => {
                              setTrimStart(0);
                              setTrimEnd(Math.min(15, result.duration || 15));
                            }}
                            className="preset-btn"
                          >
                            First 15s
                          </button>
                          <button 
                            type="button" 
                            onClick={() => {
                              setTrimStart(0);
                              setTrimEnd(Math.min(30, result.duration || 30));
                            }}
                            className="preset-btn"
                          >
                            First 30s
                          </button>
                          <button 
                            type="button" 
                            onClick={() => {
                              setTrimStart(0);
                              setTrimEnd(Math.min(60, result.duration || 60));
                            }}
                            className="preset-btn"
                          >
                            First 60s
                          </button>
                        </div>
                      </div>

                      <div className="trim-action-container">
                        <a 
                          href={getTrimDownloadUrl()}
                          className="trim-export-btn"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Trim & Export Clip
                        </a>
                        <p className="trim-disclaimer">Note: Processing is streamed directly in memory and may take a moment to initialize.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Recent History / Download Tray */}
        {history.length > 0 && (
          <section className="recent-downloads-section">
            <div className="section-header">
              <h2 className="section-heading">Recent Fetches</h2>
              <button onClick={clearHistory} className="clear-history-btn">Clear</button>
            </div>
            <div className="recent-downloads-grid">
              {history.map((item, idx) => (
                <div key={idx} className="history-card" onClick={() => handleHistoryClick(item)}>
                  <div className="history-thumb">
                    <img 
                      src={item.thumbnail || "https://placehold.co/320x180/1c1c1e/fafafc?text=No+Thumbnail"} 
                      alt="Thumbnail" 
                      onError={(e) => {
                        e.target.src = 'https://placehold.co/320x180/1c1c1e/fafafc?text=No+Thumbnail';
                      }}
                    />
                  </div>
                  <div className="history-meta">
                    <div className="history-platform">{item.platform}</div>
                    <div className="history-title" title={item.title}>{item.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        </div>

        {/* Scroll Indicator Prompt */}
        <div 
          className="scroll-indicator-btn" 
          onClick={() => scrollToSection('seo-content-section')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && scrollToSection('seo-content-section')}
          aria-label="Scroll to view details"
        >
          <span className="scroll-indicator-text">Scroll to explore</span>
          <svg className="scroll-indicator-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M19 12l-7 7-7-7"/>
          </svg>
        </div>
      </section>

      {/* SECTION 2: SEO Text, Features & Footer (Appears on Scroll, disappears when back at top) */}
      <div className={`secondary-details-section ${isScrolled ? 'is-visible' : ''}`}>
        <main className="seo-main-content">
          <section className="seo-content-section">
          <div className="seo-container">
            <article className="seo-article">
              <h2 className="seo-heading">Best YouTube Video Downloader Online (4K, 1080p & MP3)</h2>
              <p className="seo-text">
                Welcome to <strong>VidLand</strong>, the premier <strong>youtube video downloader</strong> engineered to help you <strong>download youtube video free</strong> in crisp, original quality. Whether you are looking for a reliable <strong>youtube video downloader 4k</strong> for high-resolution displays, a fast <strong>youtube video downloader 1080p</strong> for offline watching, or an instant <strong>youtube video downloader mp3</strong> converter for your favorite music tracks, VidLand provides a seamless, zero-cost solution directly inside your web browser.
              </p>
              <p className="seo-text">
                Unlike bloated desktop software or ad-heavy sites frequently cautioned on <strong>youtube video downloader reddit</strong> discussions, VidLand runs as a clean, high-performance <strong>youtube video downloader online</strong> web application. You never need to install software, install browser extensions, or register an account. Just paste your link, select your desired resolution, and <strong>download youtube vids</strong> instantly with ultra-fast memory proxy streaming.
              </p>

              <h2 id="features-section" className="seo-heading">Why VidLand is the Best YouTube Video Downloader</h2>
              <div className="seo-grid">
                <div className="seo-card">
                  <h3 className="seo-card-title">⚡ High-Speed 4K & 1080p Downloads</h3>
                  <p className="seo-card-desc">Save ultra-HD videos using our dedicated <strong>youtube video downloader 4k</strong> and <strong>youtube video downloader 1080p</strong> engine. Enjoy original 60FPS video quality without watermarks or quality loss.</p>
                </div>
                <div className="seo-card">
                  <h3 className="seo-card-title">🎵 High Quality MP3 Converter</h3>
                  <p className="seo-card-desc">Convert music videos, podcasts, and interviews into standalone audio files using our <strong>youtube video downloader mp3</strong> tool. Extract 320kbps and 128kbps audio streams in seconds.</p>
                </div>
                <div className="seo-card">
                  <h3 className="seo-card-title">📱 Download YouTube Video to iPhone & Android</h3>
                  <p className="seo-card-desc">Wondering how to <strong>download youtube video to iphone</strong> without iTunes? VidLand works directly in Safari on iOS and Chrome on Android, saving media straight to your Files app.</p>
                </div>
                <div className="seo-card">
                  <h3 className="seo-card-title">✂️ Built-in Video Trimmer & Shorts Cutter</h3>
                  <p className="seo-card-desc">Trim long YouTube videos into custom clips or crop them into 9:16 vertical ratio formats for TikTok, YouTube Shorts, and Instagram Reels with precise start and end times.</p>
                </div>
              </div>

              <h2 id="how-it-works-section" className="seo-heading">How to Download YouTube Videos Free on Desktop & Mobile</h2>
              <p className="seo-text">Follow these simple steps to <strong>download youtube video</strong> files onto any device:</p>
              <ol className="seo-steps-list">
                <li><strong>Copy YouTube URL:</strong> Open YouTube on your desktop or mobile app and copy the link of the video you wish to save.</li>
                <li><strong>Paste into VidLand:</strong> Paste the URL into the search bar above and click <strong>Fetch Video</strong>.</li>
                <li><strong>Select Format & Quality:</strong> Choose from 4K, 1080p, 720p MP4, or MP3 audio only.</li>
                <li><strong>Click Download:</strong> Your browser will immediately start downloading the media file. If you want to <strong>download youtube video to iphone</strong>, tap the download arrow in Safari and save to Files or Camera Roll.</li>
              </ol>

              <h2 id="trust-section" className="seo-heading">Company, Security & Legal Information</h2>
              <p className="seo-text">Explore VidLand's architecture, zero-log privacy commitments, terms of service, and direct support desk:</p>
              <div className="seo-cards-grid trust-cards-grid">
                <a href="/privacy" className="trust-card">
                  <div className="trust-card-badge">Privacy</div>
                  <h3 className="seo-card-title">🔒 Privacy Policy</h3>
                  <p className="seo-card-desc">Read how our Zero-Log Memory Proxy Streaming protects user data with zero disk storage, no account requirement, and full anonymity.</p>
                  <span className="trust-card-link">View Privacy Policy →</span>
                </a>

                <a href="/about" className="trust-card">
                  <div className="trust-card-badge">About</div>
                  <h3 className="seo-card-title">ℹ️ About VidLand</h3>
                  <p className="seo-card-desc">Discover our mission to deliver a museum-grade 4K YouTube video downloader and MP3 converter without ads or bloatware.</p>
                  <span className="trust-card-link">Learn About Us →</span>
                </a>

                <a href="/terms" className="trust-card">
                  <div className="trust-card-badge">Legal</div>
                  <h3 className="seo-card-title">⚖️ Terms & Conditions</h3>
                  <p className="seo-card-desc">Understand our terms of service, fair use policy for personal educational downloading, copyright safety, and user guidelines.</p>
                  <span className="trust-card-link">Read Terms & Conditions →</span>
                </a>

                <a href="/contact" className="trust-card">
                  <div className="trust-card-badge">Support</div>
                  <h3 className="seo-card-title">✉️ Contact Us</h3>
                  <p className="seo-card-desc">Get direct technical support, submit bug reports, suggest new features, or send DMCA copyright inquiries to our support desk.</p>
                  <span className="trust-card-link">Get in Touch →</span>
                </a>
              </div>

              <h2 id="faq-section" className="seo-heading">Frequently Asked Questions (FAQ)</h2>
              <div className="seo-faq-list">
                <details className="seo-faq-accordion" open>
                  <summary className="seo-faq-summary">
                    <span className="seo-faq-q">How to download a youtube video?</span>
                    <svg className="seo-faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </summary>
                  <div className="seo-faq-answer-wrapper">
                    <p className="seo-faq-a">To <strong>download a youtube video</strong>, copy the video URL from YouTube, paste it into VidLand's search bar, click <strong>Fetch Video</strong>, select your preferred quality (4K, 1080p, 720p, or MP3 audio), and click <strong>Download</strong>.</p>
                  </div>
                </details>

                <details className="seo-faq-accordion">
                  <summary className="seo-faq-summary">
                    <span className="seo-faq-q">How to download youtube video to computer?</span>
                    <svg className="seo-faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </summary>
                  <div className="seo-faq-answer-wrapper">
                    <p className="seo-faq-a">To <strong>download youtube video to computer</strong> (Windows PC, Mac, or Linux), open your web browser, navigate to VidLand, paste the YouTube link, select your desired resolution, and click Download. The file will save directly to your computer's Downloads folder.</p>
                  </div>
                </details>

                <details className="seo-faq-accordion">
                  <summary className="seo-faq-summary">
                    <span className="seo-faq-q">How to download a video from youtube for free?</span>
                    <svg className="seo-faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </summary>
                  <div className="seo-faq-answer-wrapper">
                    <p className="seo-faq-a">You can <strong>download a video from youtube</strong> for free using VidLand's online web tool. It is 100% free with no account registration, no hidden fees, and unlimited downloads.</p>
                  </div>
                </details>

                <details className="seo-faq-accordion">
                  <summary className="seo-faq-summary">
                    <span className="seo-faq-q">How to download video from youtube on mobile or iPhone?</span>
                    <svg className="seo-faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </summary>
                  <div className="seo-faq-answer-wrapper">
                    <p className="seo-faq-a">To <strong>download video from youtube</strong> on an iPhone or Android phone, copy the link from the YouTube app, open Safari or Chrome, visit VidLand, paste the link, and tap Download to save the file to your Files app or Camera Roll.</p>
                  </div>
                </details>

                <details className="seo-faq-accordion">
                  <summary className="seo-faq-summary">
                    <span className="seo-faq-q">What is the best youtube video downloader?</span>
                    <svg className="seo-faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </summary>
                  <div className="seo-faq-answer-wrapper">
                    <p className="seo-faq-a">VidLand is widely recognized as the <strong>best youtube video downloader</strong> online because it delivers ultra-fast 4K and 1080p downloads, 320kbps MP3 conversion, video trimming, zero ads, and respects user privacy without desktop software.</p>
                  </div>
                </details>

                <details className="seo-faq-accordion">
                  <summary className="seo-faq-summary">
                    <span className="seo-faq-q">What is a safe youtube video downloader?</span>
                    <svg className="seo-faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </summary>
                  <div className="seo-faq-answer-wrapper">
                    <p className="seo-faq-a">A <strong>safe youtube video downloader</strong> is one that runs entirely in your web browser without requiring software downloads, browser extensions, or account sign-ups. VidLand is 100% safe, ad-free, and handles media streaming securely in memory.</p>
                  </div>
                </details>

                <details className="seo-faq-accordion">
                  <summary className="seo-faq-summary">
                    <span className="seo-faq-q">What is a good youtube video downloader for high quality MP4 & MP3?</span>
                    <svg className="seo-faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </summary>
                  <div className="seo-faq-answer-wrapper">
                    <p className="seo-faq-a">A <strong>good youtube video downloader</strong> provides original high-resolution downloads up to 4K 60fps and crystal-clear audio extraction. VidLand is a <strong>good youtube video downloader</strong> supporting 4K, 2K, 1080p, 720p MP4, and high bitrate MP3 streams.</p>
                  </div>
                </details>

                <details className="seo-faq-accordion">
                  <summary className="seo-faq-summary">
                    <span className="seo-faq-q">How to download youtube shorts video downloader clips?</span>
                    <svg className="seo-faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </summary>
                  <div className="seo-faq-answer-wrapper">
                    <p className="seo-faq-a">To <strong>download youtube shorts video downloader</strong> clips, copy the URL of any YouTube Shorts video, paste it into VidLand, and choose full video download or use our built-in Shorts-Cutter tool to trim and crop the vertical clip for TikTok or Instagram Reels.</p>
                  </div>
                </details>
              </div>
            </article>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  </>

  );
}

export default App;
