import Header from '../components/Header';
import Footer from '../components/Footer';

export default function PrivacyPolicy() {
  return (
    <div className="app-layout">
      <Header currentPath="/privacy" />
      <main className="page-container">
        <article className="legal-article">
          <header className="page-header">
            <span className="page-badge">Security & Data Protection</span>
            <h1 className="page-title">Privacy Policy</h1>
            <p className="page-subtitle">Last updated: August 2026 • Effective Date: January 1, 2026</p>
          </header>

          <div className="legal-grid">
            <section className="legal-section">
              <h2>1. Zero-Log Memory Proxy Streaming Policy</h2>
              <p>At VidLand, we prioritize user privacy above all else. Traditional online converters download videos onto intermediate server hard drives, exposing media files and IP logs. VidLand operates on an advanced <strong>In-Memory Streaming Proxy Architecture</strong>.</p>
              <p>When you fetch or download a YouTube video or audio track, media streams are proxied directly through transient system RAM buffers. At no point are video files, user IP addresses, or target YouTube URLs written to physical disk drives or stored in databases.</p>
            </section>

            <section className="legal-section">
              <h2>2. Information We Do Not Collect</h2>
              <p>VidLand is built for complete anonymity:</p>
              <ul>
                <li><strong>No User Accounts:</strong> You do not need to register, provide an email address, or create a password.</li>
                <li><strong>No Payment Information:</strong> VidLand is 100% free. We never request credit card or financial details.</li>
                <li><strong>No Tracking Cookies:</strong> We do not place third-party tracking cookies or construct advertising profiles.</li>
                <li><strong>No Activity Logging:</strong> We do not log what videos you fetch, trim, or download.</li>
              </ul>
            </section>

            <section className="legal-section">
              <h2>3. Browser Local Storage Usage</h2>
              <p>VidLand utilizes your web browser's standard <code>localStorage</code> API for two non-intrusive client-side features:</p>
              <ol>
                <li><strong>Theme Preference:</strong> Remembers whether you selected Dark Mode or Light Mode across visits.</li>
                <li><strong>Recent History:</strong> Saves your last 5 searched video links locally on your own device for quick re-fetching.</li>
              </ol>
              <p>This data remains strictly on your device. You can clear this history anytime by clicking "Clear History" in the interface or clearing browser site data.</p>
            </section>

            <section className="legal-section">
              <h2>4. External Services & Third-Party APIs</h2>
              <p>VidLand interacts with YouTube's public media servers to retrieve public video metadata (title, duration, thumbnail, and stream formats). When you click download, your browser receives the stream payload directly via memory proxy. We encourage users to review YouTube's Terms of Service for content guidelines.</p>
            </section>

            <section className="legal-section">
              <h2>5. Global Data Rights (GDPR & CCPA)</h2>
              <p>Because VidLand does not collect, store, or process personal identifiable data (PII) on our servers, there is no user data stored to export, sell, or delete. If you have questions regarding privacy compliance, reach out to our team at <a href="mailto:support@vidland.app" className="legal-link">support@vidland.app</a>.</p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
