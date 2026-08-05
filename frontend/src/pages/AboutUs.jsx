import Header from '../components/Header';
import Footer from '../components/Footer';

export default function AboutUs() {
  return (
    <div className="app-layout">
      <Header currentPath="/about" />
      <main className="page-container">
        <article className="legal-article">
          <header className="page-header">
            <span className="page-badge">About VidLand</span>
            <h1 className="page-title">Video Downloads, Refined & Secure.</h1>
            <p className="page-subtitle">Elevating the online media tool experience with zero bloat, high-speed 4K streaming, and total privacy.</p>
          </header>

          <div className="legal-grid">
            <section className="legal-section">
              <h2>Our Mission</h2>
              <p>VidLand was born out of frustration with existing web converters — slow loading times, invasive malware ads, broken download links, and dubious privacy practices. We built VidLand as a sleek, reliable, and museum-grade web application where media processing is instantaneous and beautiful.</p>
            </section>

            <section className="legal-section">
              <h2>Core Technical Capabilities</h2>
              <div className="features-grid-cards">
                <div className="about-card">
                  <div className="about-card-icon">⚡</div>
                  <h3>4K & 1080p Ultra HD Downloads</h3>
                  <p>Fetch original, uncompressed YouTube video streams up to 4K 60fps with full audio muxing in MP4 format.</p>
                </div>
                <div className="about-card">
                  <div className="about-card-icon">🎵</div>
                  <h3>High Bitrate MP3 Extraction</h3>
                  <p>Convert music videos, podcasts, and audio clips into crisp 320kbps MP3 audio files with automated meta tags.</p>
                </div>
                <div className="about-card">
                  <div className="about-card-icon">✂️</div>
                  <h3>Shorts & Clip Trimmer</h3>
                  <p>Select exact start and end timestamps, and convert horizontal videos into 9:16 vertical clips for TikTok and Instagram Reels.</p>
                </div>
                <div className="about-card">
                  <div className="about-card-icon">🔒</div>
                  <h3>Zero-Log Memory Streaming</h3>
                  <p>All processing is executed in RAM memory buffers with zero disk writes, ensuring complete user privacy.</p>
                </div>
              </div>
            </section>

            <section className="legal-section">
              <h2>Design Philosophy</h2>
              <p>Inspired by Apple's human interface guidelines and SF Pro aesthetics, VidLand prioritizes typography, subtle micro-animations, glassmorphism, and instant responsiveness. The tool recedes into the background so your media content takes center stage.</p>
            </section>

            <section className="legal-section">
              <h2>Built for All Devices</h2>
              <p>Whether you're downloading on an iPhone using Safari, an Android phone on Chrome, a Mac, or a Windows PC, VidLand works natively without software or app installation.</p>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
