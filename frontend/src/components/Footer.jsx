export default function Footer() {
  return (
    <footer className="global-footer">
      <div className="footer-container">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <div className="footer-brand">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="footer-brand-icon">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M10 15l5-3-5-3v6z"/>
              </svg>
              <span>VidLand</span>
            </div>
            <p className="footer-tagline">
              High-speed online YouTube video downloader, 4K converter, and Shorts trimmer. Zero disk storage footprint, complete user privacy.
            </p>
          </div>

          <div className="footer-links-col">
            <h4 className="footer-col-title">Navigation</h4>
            <ul className="footer-links-list">
              <li><a href="/" className="footer-link">Home Downloader</a></li>
              <li><a href="/#features-section" className="footer-link">Key Features</a></li>
              <li><a href="/#how-it-works-section" className="footer-link">How It Works</a></li>
              <li><a href="/#faq-section" className="footer-link">Frequently Asked Questions</a></li>
            </ul>
          </div>

          <div className="footer-links-col">
            <h4 className="footer-col-title">Company & Legal</h4>
            <ul className="footer-links-list">
              <li><a href="/about" className="footer-link">About Us</a></li>
              <li><a href="/privacy" className="footer-link">Privacy Policy</a></li>
              <li><a href="/terms" className="footer-link">Terms & Conditions</a></li>
              <li><a href="/contact" className="footer-link">Contact Support</a></li>
            </ul>
          </div>

          <div className="footer-links-col">
            <h4 className="footer-col-title">Security & Privacy</h4>
            <p className="footer-info-text">
              VidLand operates strictly via Memory Proxy Streaming. No files or user media are stored on servers or logged on disk.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-legal">Designed with Apple SF Pro aesthetic standards. © {new Date().getFullYear()} VidLand. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
