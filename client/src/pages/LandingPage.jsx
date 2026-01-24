import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, Zap, Shield, BarChart3, ChevronRight } from 'lucide-react';
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
          <span>refractive<span className="accent">GPT</span></span>
        </div>
        <div className="nav-links">
          <Link to="/login" className="login-btn">App Login</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero">
        <div className="badge">Trusted by Refractive Practices</div>
        <h1 className="hero-title">
          Stop Losing Patients to <br />
          <span className="gradient-text">Information Gaps</span>
        </h1>
        <p className="hero-subtitle">
          The first AI clinical coach designed exclusively for refractive surgery. <br />
          <span className="subtitle-line-2">Convert more consultations with expert-level clinical reasoning, available 24/7.</span>
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
          <Zap className="feature-icon" />
          <h3>Instant Expertise</h3>
          <p>Advanced neural retrieval delivers precise clinical insights from your practice's medical content in milliseconds.</p>
        </div>
        <div className="feature-card">
          <Shield className="feature-icon" />
          <h3>Safety First</h3>
          <p>Zero hallucinations. Our precision-tuned AI only speaks from your verified medical knowledge base.</p>
        </div>
        <div className="feature-card">
          <BarChart3 className="feature-icon" />
          <h3>Conversion Driven</h3>
          <p>Intelligent intent detection and optimized conversational flows turn inquiries into consultations.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>© 2024 refractiveGPT. Built for better patient care.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
