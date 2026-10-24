import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from './LandingNavbar';
import { EASE, GITHUB_URL } from './constants';

export function FinalCta() {
  return (
    <section className="lp-wrap lp-cta-wrap">
      <motion.div
        className="lp-cta"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <div className="lp-cta-dots" aria-hidden="true" />
        <h2 className="lp-h2">Stop guessing where things live.</h2>
        <div className="lp-cta-side">
          <p>Connect a GitHub repository and explore its structure in the workspace.</p>
          <Link className="lp-btn lp-btn-lime" to="/workspace">Explore Your Codebase <ArrowRight size={17} className="lp-arrow" /></Link>
        </div>
      </motion.div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-in">
        <Logo />
        <nav className="lp-flinks" aria-label="Footer">
          <a href="#product">Product</a>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
          <Link to="/workspace">Open Workspace</Link>
        </nav>
        <span className="lp-copy">© 2026 CodebaseQA</span>
      </div>
    </footer>
  );
}