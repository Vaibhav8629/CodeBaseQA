import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, GitBranch, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EASE, GITHUB_URL } from './constants';

const LINKS = [
  ['Product', '#product'],
  ['Features', '#features'],
  ['How it works', '#how'],
];

export function Logo() {
  return (
    <Link to="/" className="lp-logo" aria-label="CodebaseQA home">
      <span className="lp-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="9" r="2.2" /><circle cx="10" cy="18" r="2.2" />
          <path d="M8 6.5l7.9 2M7 8l2.2 8M16.8 10.8l-5.3 5.8" />
        </svg>
      </span>
      <span>Codebase<b>QA</b></span>
    </Link>
  );
}

export default function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <motion.header
      className={`lp-nav ${scrolled || open ? 'scrolled' : ''}`}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <div className="lp-nav-in">
        <Logo />
        <nav className="lp-links" aria-label="Primary">
          {LINKS.map(([label, href]) => <a key={label} className="lp-link" href={href}>{label}</a>)}
        </nav>
        <div className="lp-nav-right">
          <a className="lp-link lp-hide-m lp-gh" href={GITHUB_URL} target="_blank" rel="noreferrer"><GitBranch size={15} /> GitHub</a>
          <Link className="lp-btn lp-btn-lime lp-btn-sm lp-hide-m" to="/workspace">Open Workspace <ArrowRight size={15} className="lp-arrow" /></Link>
          <button className="lp-burger" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="lp-mobile-menu" onClick={() => setOpen((v) => !v)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="lp-mobile-menu"
            className="lp-mobile"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <div className="lp-mobile-in">
              {LINKS.map(([label, href]) => <a key={label} className="lp-mlink" href={href} onClick={() => setOpen(false)}>{label}</a>)}
              <a className="lp-mlink" href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
              <Link className="lp-btn lp-btn-lime" to="/workspace">Open Workspace <ArrowRight size={16} className="lp-arrow" /></Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}