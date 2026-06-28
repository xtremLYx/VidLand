import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [theme, setTheme] = useState('dark');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  
  // Trimming engine states
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(15);
  const [cropRatio, setCropRatio] = useState('landscape');
  const [selectedFormatIndex, setSelectedFormatIndex] = useState(0);
  
  const formRef = useRef(null);

  // Initialize theme and history
  useEffect(() => {
    // Theme setup
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      applyTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    }

    // History setup
    const savedHistory = localStorage.getItem('fetch_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Initialize trim limits when result loads
  useEffect(() => {
    if (result) {
      setTrimStart(0);
      setTrimEnd(result.duration ? Math.min(15, result.duration) : 15);
      setSelectedFormatIndex(0);
    }
  }, [result]);

  const applyTheme = (newTheme) => {
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
  };

  const toggleTheme = () => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  };

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
    return n.toFixed(1) + " " + units[l];
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
    
    return `/api/trim?videoUrl=${encodeURIComponent(selectedFormat.url)}` + 
      (needsAudioMux ? audioUrlParam : '') + 
      `&start=${trimStart}&end=${trimEnd}&crop=${cropRatio}&title=${encodeURIComponent(result.title)}`;
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
      <header className="global-header">
        <div className="nav-container">
          <div className="logo" onClick={() => window.location.reload()}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="logo-symbol">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 0 1 6 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
            </svg>
            <span className="logo-text">OmniFetch</span>
          </div>
          <button 
            id="theme-toggle" 
            className="theme-toggle-btn" 
            onClick={toggleTheme}
            aria-label="Toggle dark/light theme"
          >
            {theme === 'dark' ? (
              <svg id="theme-icon-light" className="theme-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.46 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 100 2h1z" clipRule="evenodd"></path>
              </svg>
            ) : (
              <svg id="theme-icon-dark" className="theme-icon" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="main-content">
        {/* Hero Header Section */}
        <section className="hero-section">
          <h1 className="hero-title">Video downloads,<br />refined and secure.</h1>
          <p className="hero-subtitle">Paste a YouTube or Instagram link to start. High-speed memory proxy streaming, zero storage footprint, complete privacy.</p>
        </section>

        {/* Main Downloader Interface */}
        <section className="downloader-card-container">
          <div className="downloader-card">
            <form ref={formRef} onSubmit={(e) => handleFetch(e)} className="fetch-form">
              <div className="input-wrapper">
                <span className="search-input-icon">⚡</span>
                <input 
                  type="url" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube or Instagram link..." 
                  required 
                  autoComplete="off"
                  spellCheck="false"
                />
                <button type="button" onClick={handlePaste} className="paste-btn" title="Paste from clipboard">
                  <span>Paste</span>
                </button>
              </div>
              <button type="submit" className="submit-btn" disabled={loading}>
                <span>{loading ? "Processing..." : "Fetch Video"}</span>
              </button>
            </form>

            {/* Processing Spinner Indicator */}
            {loading && (
              <div className="spinner-container">
                <div className="apple-spinner-ring">
                  <div></div><div></div><div></div><div></div>
                </div>
                <p className="loading-message">Retrieving video metadata...</p>
              </div>
            )}
            
            {/* Error Notice Panel */}
            {error && (
              <div className="error-panel">
                <div className="error-content">
                  <span className="error-icon">⚠</span>
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
                      alt="Video thumbnail" 
                      onError={(e) => {
                        e.target.src = "https://placehold.co/600x400?text=Thumbnail+Not+Found";
                      }}
                    />
                  </div>
                  <div className="video-info">
                    <div className="badge-row">
                      <span 
                        className="platform-badge"
                        style={result.platform.toLowerCase() === 'instagram' ? {
                          background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                          color: '#ffffff'
                        } : {}}
                      >
                        {result.platform}
                      </span>
                    </div>
                    <h2 className="video-title">{result.title}</h2>
                  </div>
                </div>

                {/* Shorts-Cutter Trim Section */}
                <div className="trim-section-card">
                  <div className="trim-card-header">
                    <span className="trim-icon">✂</span>
                    <h3 className="trim-card-title">Shorts-Cutter: Trim & Format</h3>
                  </div>
                  
                  <div className="trim-controls-grid">
                    <div className="trim-control-group">
                      <label className="control-label">Aspect Ratio</label>
                      <div className="crop-toggle-buttons">
                        <button 
                          type="button"
                          className={`crop-btn ${cropRatio === 'landscape' ? 'active' : ''}`}
                          onClick={() => setCropRatio('landscape')}
                        >
                          Landscape (Original)
                        </button>
                        <button 
                          type="button"
                          className={`crop-btn ${cropRatio === 'vertical' ? 'active' : ''}`}
                          onClick={() => setCropRatio('vertical')}
                        >
                          Vertical (9:16 Crop)
                        </button>
                      </div>
                    </div>

                    <div className="trim-control-group">
                      <label className="control-label">Target Quality</label>
                      <select 
                        value={selectedFormatIndex}
                        onChange={(e) => setSelectedFormatIndex(parseInt(e.target.value))}
                        className="quality-select-dropdown"
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
                      <span>Start: <strong>{formatTime(trimStart)}</strong></span>
                      <span>End: <strong>{formatTime(trimEnd)}</strong></span>
                      <span>Duration: <strong>{trimEnd - trimStart}s</strong></span>
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

                <div className="formats-table-wrapper">
                  <table className="formats-table">
                    <thead>
                      <tr>
                        <th>Resolution</th>
                        <th>Format</th>
                        <th>Estimated Size</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!result.formats || result.formats.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            No formats found. The video might be private, geoblocked or restricted.
                          </td>
                        </tr>
                      ) : (
                        result.formats.map((fmt, i) => {
                          const downloadUrl = `/api/download?url=${encodeURIComponent(fmt.url)}` + 
                            (fmt.audioUrl ? `&audioUrl=${encodeURIComponent(fmt.audioUrl)}` : '') + 
                            `&title=${encodeURIComponent(result.title)}&format=${encodeURIComponent(fmt.format_id || fmt.label)}`;
                          return (
                            <tr key={i}>
                              <td style={{ fontWeight: '600' }}>{fmt.label}</td>
                              <td>{fmt.ext.toUpperCase()}</td>
                              <td>{formatBytes(fmt.filesize)}</td>
                              <td>
                                <a 
                                  className="download-link-btn" 
                                  href={downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
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
      </main>

      <footer className="global-footer">
        <div className="footer-container">
          <p className="footer-legal">Designed in California. OmniFetch handles downloads strictly via memory proxy. No user media is saved on disk.</p>
        </div>
      </footer>
    </>
  );
}

export default App;
