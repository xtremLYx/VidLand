import Header from '../components/Header';
import Footer from '../components/Footer';

export default function TermsConditions() {
  return (
    <div className="app-layout">
      <Header currentPath="/terms" />
      <main className="page-container">
        <article className="legal-article">
          <header className="page-header">
            <span className="page-badge">Terms of Service</span>
            <h1 className="page-title">Terms & Conditions</h1>
            <p className="page-subtitle">Last updated: August 2026</p>
          </header>

          <div className="legal-grid">
            <section className="legal-section">
              <h2>1. Agreement to Terms</h2>
              <p>By accessing or using the VidLand web application (accessible via web browser), you agree to be bound by these Terms and Conditions and our Privacy Policy. If you disagree with any part of these terms, you must discontinue use of the service immediately.</p>
            </section>

            <section className="legal-section">
              <h2>2. Permitted Use & Fair Use Policy</h2>
              <p>VidLand is provided strictly for personal, non-commercial, educational, and fair-use purposes. Acceptable uses include:</p>
              <ul>
                <li>Downloading royalty-free or Creative Commons licensed videos.</li>
                <li>Downloading content that you own or have explicit written permission from the creator to save offline.</li>
                <li>Backing up educational materials, speeches, or fair-use audio clips for offline viewing.</li>
              </ul>
              <p>You agree not to use VidLand to infringe upon intellectual property rights, copyright laws, or trademark protections in your country of residence.</p>
            </section>

            <section className="legal-section">
              <h2>3. Prohibited Conduct</h2>
              <p>When using VidLand, you explicitly agree that you will not:</p>
              <ol>
                <li>Use automated scripts, bots, or scrapers to overload our memory proxy streaming servers.</li>
                <li>Attempt to re-sell, commercialize, or charge third parties for downloading YouTube media via VidLand.</li>
                <li>Bypass network rate limits or security measures designed to preserve platform stability.</li>
              </ol>
            </section>

            <section className="legal-section">
              <h2>4. Intellectual Property & DMCA Notice</h2>
              <p>VidLand respects creator rights. VidLand does not host, store, or archive copyrighted media files on its servers. We act solely as a user-initiated browser proxy tool. If you believe your copyrighted work is being improperly accessed, please contact our support team at <a href="mailto:support@vidland.app" className="legal-link">support@vidland.app</a>.</p>
            </section>

            <section className="legal-section">
              <h2>5. Disclaimer & Limitation of Liability</h2>
              <p>VidLand is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied. We do not guarantee that third-party streaming APIs will remain accessible without interruption. In no event shall VidLand be liable for damages arising out of your use of or inability to use the service.</p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
