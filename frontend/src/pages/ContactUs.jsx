import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function ContactUs() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'general',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;

    setSubmitting(true);
    // Simulate contact form submission
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 800);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="app-layout">
      <Header currentPath="/contact" />
      <main className="page-container">
        <article className="legal-article">
          <header className="page-header">
            <span className="page-badge">Support & Inquiries</span>
            <h1 className="page-title">Contact Us</h1>
            <p className="page-subtitle">Have a question, feature request, or technical issue? We'd love to hear from you.</p>
          </header>

          <div className="contact-grid">
            <div className="contact-info-card">
              <h2>Get in Touch</h2>
              <p>Our engineering and support team is dedicated to keeping VidLand fast, ad-free, and secure.</p>
              
              <div className="contact-methods">
                <div className="contact-method-item">
                  <div className="contact-icon">✉️</div>
                  <div>
                    <h4>Direct Support Email</h4>
                    <p><a href="mailto:support@vidland.app" className="legal-link">support@vidland.app</a></p>
                  </div>
                </div>

                <div className="contact-method-item">
                  <div className="contact-icon">⏱️</div>
                  <div>
                    <h4>Response Time Promise</h4>
                    <p>We typically respond within 24 to 48 business hours.</p>
                  </div>
                </div>

                <div className="contact-method-item">
                  <div className="contact-icon">🔒</div>
                  <div>
                    <h4>Privacy & Security Inquiries</h4>
                    <p>Contact our privacy officer at <a href="mailto:privacy@vidland.app" className="legal-link">privacy@vidland.app</a></p>
                  </div>
                </div>
              </div>
            </div>

            <div className="contact-form-card">
              {submitted ? (
                <div className="contact-success-state">
                  <div className="success-icon">✓</div>
                  <h3>Message Sent Successfully!</h3>
                  <p>Thank you for reaching out to VidLand. A member of our support team will get back to you at <strong>{formData.email}</strong> shortly.</p>
                  <button 
                    className="submit-btn" 
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ name: '', email: '', subject: 'general', message: '' });
                    }}
                    style={{ marginTop: '20px' }}
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="contact-form">
                  <h3>Send a Message</h3>
                  
                  <div className="form-group">
                    <label htmlFor="name">Full Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your name"
                      required
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      required
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="subject">Inquiry Subject</label>
                    <select
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      className="form-input"
                    >
                      <option value="general">General Support</option>
                      <option value="bug">Report a Bug / Download Issue</option>
                      <option value="feature">Feature Suggestion</option>
                      <option value="dmca">Copyright / DMCA Notice</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="message">Your Message</label>
                    <textarea
                      id="message"
                      name="message"
                      rows="5"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Describe your question or issue in detail..."
                      required
                      className="form-input"
                    ></textarea>
                  </div>

                  <button type="submit" className="submit-btn" disabled={submitting}>
                    <span>{submitting ? 'Sending...' : 'Send Message'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
