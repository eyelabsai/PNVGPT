import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, Users, Mic, Phone, ChevronRight } from 'lucide-react';
import './LandingPage.css';

const LandingPage = () => {
  return (
    <div className="landing-container">
      {/* Background Elements */}
      <div className="grid-overlay"></div>
      <div className="glow-sphere glow-1"></div>
      <div className="glow-sphere glow-2"></div>

      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-logo">
          <Bot className="logo-icon" />
          <span>Medly<span className="accent">One</span></span>
        </div>
        <div className="nav-links">
          <Link to="/coach" className="coach-nav-link">Coach</Link>
          <Link to="/login" className="login-btn">App Login</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero">
        <div className="badge">Built INSIDE a Refractive Practice</div>
        <h1 className="hero-title">
          Informed Decisions <br />
          <span className="gradient-text">Start Here</span>
        </h1>
        <p className="hero-subtitle">
          The first AI client designed exclusively by refractive surgeons. Over 50 years of medical education at your fingertips.
        </p>
        <div className="hero-actions">
          <Link to="/login" className="primary-btn">
            Get Started <ChevronRight className="btn-icon" />
          </Link>
          <button className="secondary-btn">Book a Demo</button>
        </div>
      </header>

      {/* Features Grid */}
      <section className="features">
        <div className="feature-card">
          <Users className="feature-icon" />
          <h3>Patient-Facing AI Client</h3>
          <p>AI client with the training of an expert refractive surgeon allows patients to converse and be educated by an advanced model that speaks, reasons, and reassures like someone performing these procedures for decades. The training includes flag words (e.g., &quot;flap&quot;), sales resistance, and disc profiling. This patient-facing client establishes trust with patients and allows them to obtain information and eventually schedule in a comfortable and familiar way.</p>
        </div>
        <div className="feature-card">
          <Mic className="feature-icon" />
          <h3>Scheduling Coach</h3>
          <p>Uses &quot;audio to answer&quot; system to monitor consultations and provides critical talking points in real time. Provides feedback de-brief checklist delivering concise and relevant feedback about missed talking points, sales resistance feedback, and strategies for closing.</p>
          <Link to="/coach" className="feature-cta">
            Go to Coach <ChevronRight className="cta-icon" />
          </Link>
        </div>
        <div className="feature-card">
          <Phone className="feature-icon" />
          <h3>Call Center Assistant</h3>
          <p>Every hire from answering the phones to greeting patients have real-time access to 13 years&apos; worth of higher education to confidently answer questions. Specific questions regarding anesthesia, insurance, or doctors are tailored to your office. This HIPAA-compliant system doesn&apos;t collect information or store PHI. This also provides practical feedback to your call center team.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>© 2024 MedlyOne. Built for better patient care.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
