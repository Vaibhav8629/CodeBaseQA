import { motion } from 'framer-motion';
import { GitBranch } from 'lucide-react';
import Reveal from './Reveal';
import { EASE } from './constants';

const view = { once: true, margin: '-80px' };

export default function HowItWorks() {
  const item = (i) => ({ initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: view, transition: { duration: 0.7, ease: EASE, delay: 0.25 + i * 0.2 } });
  return (
    <section className="lp-section lp-how" id="how">
      <div className="lp-wrap">
        <div className="lp-sec-head">
          <Reveal><span className="lp-kicker">How it works</span><h2 className="lp-h2">From a GitHub URL to answers.</h2></Reveal>
          <Reveal delay={0.1}><p>Three steps, all inside the workspace.</p></Reveal>
        </div>

        <div className="lp-steps">
          <motion.div className="lp-line-h" aria-hidden="true" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={view} transition={{ duration: 1.4, ease: EASE, delay: 0.2 }} />
          <motion.div className="lp-line-v" aria-hidden="true" initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={view} transition={{ duration: 1.4, ease: EASE, delay: 0.2 }} />
          <i className="lp-travel lp-travel-h" aria-hidden="true" />
          <i className="lp-travel lp-travel-v" aria-hidden="true" />

          <motion.div className="lp-step" {...item(0)}>
            <span className="lp-badge">1</span>
            <h3>Connect a repository</h3>
            <p>Paste a GitHub repository URL into the workspace.</p>
            <div className="lp-sv"><div className="sv-input"><GitBranch size={14} /><span>https://github.com/owner/repository</span></div></div>
          </motion.div>

          <motion.div className="lp-step" {...item(1)}>
            <span className="lp-badge">2</span>
            <h3>Index and analyze the code</h3>
            <p>CodebaseQA scans the source files and builds the context used for answers and the graph.</p>
            <div className="lp-sv"><div className="sv-row"><span>Indexing…</span><span>files · chunks</span></div><div className="sv-bar"><i /></div></div>
          </motion.div>

          <motion.div className="lp-step" {...item(2)}>
            <span className="lp-badge">3</span>
            <h3>Explore and ask</h3>
            <p>Trace dependencies in the graph, or ask questions and check the sources behind each answer.</p>
            <div className="lp-sv"><div className="sv-tabs"><span className="on">Chat</span><span>Graph</span></div><div className="sv-q">How does authentication work?</div></div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}