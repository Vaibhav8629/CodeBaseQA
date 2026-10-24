import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import Reveal from './Reveal';
import { EASE } from './constants';

function Cell({ span, delay = 0, children }) {
  return (
    <motion.div
      className={`lp-fcell ${span}`}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.75, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function MiniGraph() {
  const nodes = [['App', 200, 100], ['UI', 68, 44], ['API', 332, 44], ['DB', 332, 158], ['Utils', 68, 158]];
  const edges = ['M200 100Q120 60 68 44', 'M200 100Q270 60 332 44', 'M332 44Q372 100 332 158', 'M68 44Q30 100 68 158', 'M200 100Q120 140 68 158'];
  return (
    <svg viewBox="0 0 400 200" className="mg" aria-hidden="true">
      {edges.map((d) => <path key={d} d={d} className="mg-edge" />)}
      {nodes.map(([t, x, y]) => (
        <g key={t} className="mg-node" transform={`translate(${x} ${y})`}><rect x="-34" y="-14" width="68" height="28" rx="6" /><text textAnchor="middle" y="4">{t}</text></g>
      ))}
    </svg>
  );
}

const TYPES = [['component', '#C6FF4D'], ['page', '#e8efe2'], ['store', '#d9b25f'], ['api', '#8fb7a8'], ['utility', '#9aa596'], ['schema', '#b7c98a'], ['config', '#c7b27a'], ['file', '#6d776a']];

export default function FeaturesSection() {
  return (
    <section className="lp-section" id="features">
      <div className="lp-wrap">
        <div className="lp-sec-head">
          <Reveal><span className="lp-kicker">Features</span><h2 className="lp-h2">More than a chat box over your code.</h2></Reveal>
          <Reveal delay={0.1}><p>Structure, conversation, and evidence in one workspace, so you can see how a repository fits together and check every answer against its source.</p></Reveal>
        </div>

        <div className="lp-fgrid">
          <Cell span="s7">
            <article className="lp-feat">
              <span className="lp-ftag">Map</span>
              <h3>Interactive dependency graph</h3>
              <p>See which files import which. Search nodes, filter by type, and switch between a file graph and a module overview.</p>
              <div className="lp-fvis lp-minigraph"><MiniGraph /></div>
            </article>
          </Cell>

          <Cell span="s5" delay={0.08}>
            <article className="lp-feat">
              <span className="lp-ftag">Ask</span>
              <h3>AI-powered codebase chat</h3>
              <p>Once a repository is indexed, ask about its architecture, flow, or features in plain language.</p>
              <div className="lp-fvis lp-chatvis">
                <span className="lp-example">example</span>
                <div className="cv-q">How does authentication work?</div>
                <div className="cv-a">
                  <span className="cv-badge"><Sparkles size={13} /></span>
                  <div><b>Codebase AI</b><p>Requests pass through session middleware before they reach protected routes.</p></div>
                </div>
                <div className="cv-input"><span>Ask anything about this codebase…</span><i className="cv-caret" /></div>
              </div>
            </article>
          </Cell>

          <Cell span="s5">
            <article className="lp-feat">
              <span className="lp-ftag">Verify</span>
              <h3>Source-aware answers</h3>
              <p>Each answer lists the files and line ranges it drew from, so you can check it against the code.</p>
              <div className="lp-fvis lp-srcvis">
                <span className="lp-example">example</span>
                <div className="sv-lines"><i /><i /><i className="short" /></div>
                <div className="sv-label">Retrieved context</div>
                <div className="sv-chips"><span>server/auth/session.js:12-15</span><span>server/routes/index.js:8-31</span></div>
                <pre className="sv-code">{`12  export function verifySession(req) {\n13    const token = readToken(req);\n14    return token && decode(token);\n15  }`}</pre>
              </div>
            </article>
          </Cell>

          <Cell span="s7" delay={0.08}>
            <article className="lp-feat">
              <span className="lp-ftag">Explore</span>
              <h3>Repository architecture exploration</h3>
              <p>Select any node to see what imports it, what it imports, and a preview of its source.</p>
              <div className="lp-fvis lp-archvis">
                <div className="ar-filters">
                  <span className="ar-title">Type filters</span>
                  {TYPES.map(([t, c]) => <span className="ar-row" key={t}><i style={{ background: c }} />{t}</span>)}
                </div>
                <div className="ar-detail">
                  <span className="lp-tag">component</span>
                  <b>Message.jsx</b>
                  <code>src/components/Message.jsx</code>
                  <div className="ar-cols"><div><small>Imported by</small><span className="lp-chip">App.jsx</span></div><div><small>Imports from</small><span className="lp-chip">api.js</span><span className="lp-chip">Markdown.jsx</span></div></div>
                </div>
              </div>
            </article>
          </Cell>
        </div>
      </div>
    </section>
  );
}