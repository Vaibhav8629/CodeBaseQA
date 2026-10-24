import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { EASE } from './constants';

// Sample graph in a 1000x520 coordinate space. Nodes are HTML buttons placed by percentage.
const HW = 76;
const HH = 30;
const NODES = [
  { id: 'app', label: 'Application', path: 'src/App.jsx', type: 'component', x: 470, y: 215 },
  { id: 'ui', label: 'UI Components', path: 'src/components/', type: 'component', x: 140, y: 105 },
  { id: 'utils', label: 'Utilities', path: 'src/utils/', type: 'utility', x: 170, y: 395 },
  { id: 'routes', label: 'API Routes', path: 'server/routes/', type: 'api', x: 840, y: 100 },
  { id: 'auth', label: 'Authentication', path: 'server/auth/', type: 'api', x: 870, y: 290 },
  { id: 'db', label: 'Database', path: 'server/models/', type: 'schema', x: 600, y: 425 },
];
const LINKS = [['app', 'ui'], ['app', 'routes'], ['ui', 'utils'], ['routes', 'auth'], ['routes', 'db'], ['auth', 'db'], ['app', 'utils']];
const TOUR = ['app', 'routes', 'auth', 'db', 'ui', 'utils'];
const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

// Point where the line from a toward b leaves a's rectangle, so arrows land on node borders.
const clip = (a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.min(HW / Math.abs(dx || 1e-6), HH / Math.abs(dy || 1e-6));
  return { x: a.x + dx * t, y: a.y + dy * t };
};

const EDGES = LINKS.map(([s, t], i) => {
  const p = clip(byId[s], byId[t]);
  const q = clip(byId[t], byId[s]);
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const cx = (p.x + q.x) / 2 - dy * 0.16;
  const cy = (p.y + q.y) / 2 + dx * 0.16;
  const f = (n) => n.toFixed(1);
  return { id: `${s}-${t}`, s, t, i, d: `M${f(p.x)} ${f(p.y)} Q${f(cx)} ${f(cy)} ${f(q.x)} ${f(q.y)}` };
});

export default function DependencyGraphPreview() {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState(null);
  const [tour, setTour] = useState(0);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDrawn(true), reduce ? 0 : 2300);
    return () => window.clearTimeout(t);
  }, [reduce]);

  // Slow guided highlight; pauses while the visitor is interacting.
  useEffect(() => {
    if (reduce || hover) return undefined;
    const t = window.setInterval(() => setTour((i) => (i + 1) % TOUR.length), 3200);
    return () => window.clearInterval(t);
  }, [reduce, hover]);

  const active = hover ?? (drawn ? TOUR[reduce ? 0 : tour] : null);
  const near = new Set(EDGES.filter((e) => e.s === active || e.t === active).flatMap((e) => [e.s, e.t]));
  const cur = byId[active ?? 'app'];
  const importsFrom = EDGES.filter((e) => e.s === cur.id).map((e) => byId[e.t]);
  const importedBy = EDGES.filter((e) => e.t === cur.id).map((e) => byId[e.s]);

  return (
    <div className="lp-window" id="product">
      <div className="lp-window-bar">
        <span className="lp-wdots" aria-hidden="true"><i /><i /><i /></span>
        <span className="lp-wtitle">owner/repository</span>
        <span className="lp-wmode">file graph</span>
        <span className="lp-wlive"><i className="lp-status" /> sample data</span>
      </div>
      <div className="lp-window-body">
        <div className="lp-stage-scroll">
          <div className="lp-stage" role="group" aria-label="Sample dependency graph. Hover or focus a node to trace its imports.">
            <svg className="lp-edges" viewBox="0 0 1000 520" aria-hidden="true">
              <defs>
                <marker id="lp-arrow-off" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="#5d6a59" /></marker>
                <marker id="lp-arrow-on" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="#C6FF4D" /></marker>
              </defs>
              {EDGES.map((e) => {
                const on = e.s === active || e.t === active;
                return (
                  <g key={e.id} className={`lp-edge ${on ? 'on' : ''} ${active && !on ? 'dim' : ''}`}>
                    <motion.path
                      d={e.d}
                      fill="none"
                      markerEnd={drawn ? `url(#lp-arrow-${on ? 'on' : 'off'})` : undefined}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.9, ease: EASE, delay: 1 + e.i * 0.12 }}
                    />
                    {on && drawn && !reduce && (
                      <circle r="3.2" className="lp-pulse"><animateMotion dur="1.6s" repeatCount="indefinite" path={e.d} /></circle>
                    )}
                  </g>
                );
              })}
            </svg>
            {NODES.map((n, i) => {
              const on = n.id === active;
              return (
                <div key={n.id} className={`lp-node-pos ${active && !near.has(n.id) ? 'dim' : ''}`} style={{ left: `${n.x / 10}%`, top: `${n.y / 5.2}%` }}>
                  <motion.button
                    type="button"
                    className={`lp-node ${on ? 'on' : near.has(n.id) ? 'near' : ''}`}
                    aria-label={`${n.label}, ${n.path}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: EASE, delay: 0.8 + i * 0.1 }}
                    onPointerEnter={(e) => e.pointerType !== 'touch' && setHover(n.id)}
                    onPointerLeave={(e) => e.pointerType !== 'touch' && setHover(null)}
                    onFocus={() => setHover(n.id)}
                    onBlur={() => setHover(null)}
                    onClick={() => setHover(n.id)}
                  >
                    <span className="lp-node-top"><i className="lp-dot" />{n.label}</span>
                    <span className="lp-node-path">{n.path}</span>
                  </motion.button>
                </div>
              );
            })}
          </div>
        </div>
        <aside className="lp-detail" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={cur.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
              <span className="lp-tag">{cur.type}</span>
              <h3>{cur.label}</h3>
              <code>{cur.path}</code>
              <dl className="lp-rel"><dt>Imports from</dt><dd>{importsFrom.length ? importsFrom.map((n) => <span className="lp-chip" key={n.id}>{n.label}</span>) : <span className="lp-none">None detected</span>}</dd></dl>
              <dl className="lp-rel"><dt>Imported by</dt><dd>{importedBy.length ? importedBy.map((n) => <span className="lp-chip" key={n.id}>{n.label}</span>) : <span className="lp-none">None detected</span>}</dd></dl>
            </motion.div>
          </AnimatePresence>
        </aside>
      </div>
      <div className="lp-window-foot"><span>Hover or focus a node to trace its imports</span><span>Illustrative sample, not your repository</span></div>
    </div>
  );
}