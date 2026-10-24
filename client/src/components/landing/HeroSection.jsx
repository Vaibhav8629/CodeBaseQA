import { Fragment, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, GitBranch } from 'lucide-react';
import { Link } from 'react-router-dom';
import DependencyGraphPreview from './DependencyGraphPreview';
import { EASE, GITHUB_URL } from './constants';

const WORDS = [{ t: 'Understand' }, { t: 'any' }, { br: true }, { t: 'codebase.', hl: true }];

export default function HeroSection() {
  const ref = useRef(null);
  const raf = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Writes CSS variables directly: no React re-render on pointer move. Mouse only.
  const onMove = (event) => {
    if (reduce || event.pointerType !== 'mouse' || !ref.current) return;
    const { clientX, clientY } = event;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (clientX - r.left) / r.width;
      const y = (clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      el.style.setProperty('--px', (x - 0.5).toFixed(3));
      el.style.setProperty('--py', (y - 0.5).toFixed(3));
    });
  };

  return (
    <section className="lp-hero" ref={ref} onPointerMove={onMove}>
      <div className="lp-hero-bg" aria-hidden="true">
        <div className="lp-ambient" />
        <div className="lp-dots" />
        <div className="lp-orbit lp-orbit-a" />
        <div className="lp-orbit lp-orbit-b" />
        <div className="lp-glow" />
      </div>
      <div className="lp-wrap">
        <motion.span className="lp-eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}>
          <i className="lp-status" /> Dependency graph + codebase chat
        </motion.span>

        <h1 className="lp-h1" aria-label="Understand any codebase.">
          {WORDS.map((w, i) => w.br ? <br key="br" aria-hidden="true" /> : (
            <Fragment key={w.t}>
              <span className="lp-word-mask" aria-hidden="true">
                <motion.span
                  className={`lp-word ${w.hl ? 'lp-hl' : ''}`}
                  initial={{ y: '105%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.75, ease: EASE, delay: 0.15 + i * 0.1 }}
                >{w.t}</motion.span>
              </span>{' '}
            </Fragment>
          ))}
        </h1>

        <div className="lp-hero-sub">
          <motion.p className="lp-lede" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.55 }}>
            Explore architecture, trace dependencies, and ask questions about any repository — with answers grounded in the code itself.
          </motion.p>
          <motion.div className="lp-actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.65 }}>
            <Link className="lp-btn lp-btn-lime" to="/workspace">Explore Your Codebase <ArrowRight size={17} className="lp-arrow" /></Link>
            <a className="lp-btn lp-btn-ghost" href={GITHUB_URL} target="_blank" rel="noreferrer"><GitBranch size={17} /> View on GitHub</a>
          </motion.div>
        </div>

        <motion.div className="lp-hero-graph" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.75 }}>
          <DependencyGraphPreview />
        </motion.div>
      </div>
    </section>
  );
}