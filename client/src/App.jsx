import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import {
  ArrowRight,
  Check,
  Code2,
  Copy,
  ExternalLink,
  GitBranch,
  Globe2,
  Layers3,
  Menu,
  MessageSquare,
  Network,
  PanelRight,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
  Zap,
} from 'lucide-react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { askRepository, connectRepository } from './services/api';

const questions = [
  { title: 'Explain Structure', text: 'Explain the structure of this codebase', icon: Layers3, tone: 'violet' },
  { title: 'Auth Flow', text: 'How does authentication work?', icon: ShieldCheck, tone: 'rose' },
  { title: 'Tech Stack', text: 'What technologies and libraries are used?', icon: Network, tone: 'blue' },
  { title: 'Key Features', text: 'What are the main features of this application?', icon: Zap, tone: 'amber' },
];

const features = [
  { eyebrow: '01 / MAP', title: 'Interactive dependency graph', copy: 'See how modules connect before you make your first change.', icon: Network, tone: 'violet' },
  { eyebrow: '02 / ASK', title: 'AI-powered codebase chat', copy: 'Get grounded answers that follow the paths your code actually takes.', icon: MessageSquare, tone: 'mint' },
  { eyebrow: '03 / LEARN', title: 'Personalized learning paths', copy: 'Turn unfamiliar repositories into a focused, navigable curriculum.', icon: Layers3, tone: 'blue' },
  { eyebrow: '04 / PRACTICE', title: 'Interactive coding challenges', copy: 'Build confidence by testing what you understand, not just reading it.', icon: Terminal, tone: 'amber' },
];

function Brand({ light = false }) {
  return <Link to="/" className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-mark"><span>⌁</span></span><span>Codebase<span className="brand-accent">QA</span></span></Link>;
}

function Button({ children, variant = 'primary', ...props }) {
  return <button className={`button button-${variant}`} type="button" {...props}>{children}</button>;
}

function Landing() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Brand />
        <div className={`nav-links ${mobileOpen ? 'open' : ''}`}>
          <a href="#features" onClick={() => setMobileOpen(false)}>Product</a>
          <a href="#principles" onClick={() => setMobileOpen(false)}>Why CodebaseQA</a>
          <a href="https://github.com" target="_blank" rel="noreferrer">GitHub <ExternalLink size={13} /></a>
          <Button onClick={() => navigate('/workspace')}>Get started <ArrowRight size={15} /></Button>
        </div>
        <button className="mobile-menu" type="button" aria-label="Toggle navigation" onClick={() => setMobileOpen((value) => !value)}>{mobileOpen ? <X /> : <Menu />}</button>
      </nav>

      <main>
        <section className="hero">
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
          <motion.div className="eyebrow-pill" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}> <span className="live-dot" /> Open-source code intelligence</motion.div>
          <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>Understand any<br /><span className="gradient-text">codebase</span> with clarity.</motion.h1>
          <motion.p className="hero-copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}>Stop searching blindly. Ask questions, trace architecture, and turn unfamiliar repositories into something you can confidently own.</motion.p>
          <motion.div className="hero-actions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
            <Button onClick={() => navigate('/workspace')}>Start learning <ArrowRight size={17} /></Button>
            <a className="button button-secondary" href="https://github.com" target="_blank" rel="noreferrer"><GitBranch size={17} /> View on GitHub</a>
          </motion.div>
          <div className="trust-strip" id="principles">
            <div><GitBranch size={16} /><strong>100% open source</strong><span>Inspect every layer</span></div>
            <div><Globe2 size={16} /><strong>Run it locally</strong><span>Your code stays yours</span></div>
            <div><ShieldCheck size={16} /><strong>Bring your keys</strong><span>No vendor lock-in</span></div>
          </div>
        </section>

        <section className="feature-section" id="features">
          <div className="section-intro"><span className="section-kicker">A better way in</span><h2>More than just a chatbot.</h2><p>Deep understanding needs more than text. Visualize structure, ask better questions, and learn at the speed of the code.</p></div>
          <div className="feature-grid">
            <div className="feature-hero-card">
              <div className="graph-status-row"><span className="micro-badge"><span className="live-dot" /> Live analysis</span><span className="graph-mode">Monorepo mode</span><span className="graph-mode">9 language parsers</span></div>
              <div className="feature-card-top"><span className="feature-icon violet"><Network /></span><button className="inspect-button" type="button">Inspect map <ArrowRight size={14} /></button></div>
              <h3>Interactive Dependency Graph</h3><p>Don't just read code, map the system. Explore ownership boundaries, API traffic, and data flow with contextual nodes that mirror your real architecture.</p>
              <div className="graph-visual">
                <div className="graph-orbit" /><svg className="graph-connections" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="50" y1="51" x2="50" y2="20" /><line x1="50" y1="51" x2="81" y2="35" /><line x1="50" y1="51" x2="19" y2="39" /><line x1="50" y1="51" x2="26" y2="73" /><line x1="50" y1="51" x2="79" y2="73" /></svg>
                <span className="graph-node node-core"><strong>Core App</strong><small>12 domains</small></span><span className="graph-node node-workers"><strong>Workers</strong><small>Jobs</small></span><span className="graph-node node-api"><strong>API</strong><small>REST Routes</small></span><span className="graph-node node-ui"><strong>UI Layer</strong><small>React</small></span><span className="graph-node node-auth"><strong>Auth</strong><small>JWT + RBAC</small></span><span className="graph-node node-data"><strong>Storage</strong><small>Postgres</small></span>
                <div className="graph-metrics"><span><strong>42</strong><small>COMPONENTS</small></span><span><strong>87</strong><small>API CALLS</small></span><span><strong>15</strong><small>DB TABLES</small></span><span><strong>4</strong><small>BOUNDED CONTEXTS</small></span></div>
              </div>
              <div className="feature-tags"><span>Service boundaries</span><span>Hotspot discovery</span><span>Schema relationships</span></div>
            </div>
            <div className="feature-stack">{features.slice(1).map(({ title, copy, icon: Icon, tone, eyebrow }) => <motion.article whileHover={{ y: -4 }} key={title} className="small-feature"><div className={`feature-icon ${tone}`}><Icon /></div><span className="feature-eyebrow">{eyebrow}</span><h3>{title}</h3><p>{copy}</p><ArrowRight size={16} className="card-arrow" /></motion.article>)}</div>
          </div>
        </section>
      </main>
      <footer><Brand /><span>Built for curious engineers.</span><span>© 2026 CodebaseQA</span></footer>
    </div>
  );
}

function MarkdownAnswer({ content }) {
  return <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeHighlight]}
    components={{
      a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
      code: ({ className, children, ...props }) => {
        const isBlock = Boolean(className);
        return isBlock
          ? <pre><code className={className} {...props}>{children}</code></pre>
          : <code className="inline-code" {...props}>{children}</code>;
      },
    }}
  >
    {content}
  </ReactMarkdown>;
}

function Message({ message, onCopy }) {
  return <motion.div className={`chat-message ${message.role}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
    {message.role === 'assistant' && <div className="assistant-badge"><Sparkles size={14} /></div>}
    <div className="message-content">
      {message.role === 'user'
        ? <p>{message.content}</p>
        : <><div className="assistant-label">Codebase AI</div><MarkdownAnswer content={message.content} />{message.sources?.length > 0 && <div className="source-list"><span>Retrieved context</span>{message.sources.map((source) => <button key={`${source.file_path}-${source.start_line ?? 'file'}`} type="button">{source.file_path}{source.start_line ? `:${source.start_line}${source.end_line ? `-${source.end_line}` : ''}` : ''}</button>)}</div>}<button className="copy-answer" type="button" onClick={() => onCopy(message.content)}><Copy size={13} /> Copy answer</button></>}
    </div>
  </motion.div>;
}

function Workspace() {
  const [repoUrl, setRepoUrl] = useState('');
  const [repo, setRepo] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const connect = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('connecting');
    try {
      const result = await connectRepository(repoUrl);
      setRepo({ url: repoUrl.trim(), ...result });
      setStatus('ready');
    } catch (requestError) {
      setStatus('error');
      setError(requestError.message);
    }
  };

  const sendQuestion = async (question = draft) => {
    const text = question.trim();
    if (!text || status !== 'ready') return;
    setDraft('');
    setMessages((current) => [...current, { role: 'user', content: text }]);
    setStatus('asking');
    try {
      const result = await askRepository(text);
      setMessages((current) => [...current, { role: 'assistant', content: result.content, sources: result.sources }]);
      setStatus('ready');
    } catch (requestError) {
      setError(requestError.message);
      setStatus('ready');
    }
  };

  const copyAnswer = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return <div className="workspace-page">
    <header className="workspace-nav"><Brand light /><div className="workspace-nav-center"><span className={`connection-dot ${status === 'ready' || status === 'asking' ? 'on' : ''}`} />{repo ? <><strong>{repoUrl.replace('https://github.com/', '')}</strong><span className="nav-divider">/</span><span className="muted">main</span></> : <span className="muted">No repository connected</span>}</div><div className="workspace-actions"><button type="button" className="panel-button" onClick={() => setPanelOpen((value) => !value)}><PanelRight size={15} /> Sources</button><Link to="/" className="leave-link">Exit <ArrowRight size={14} /></Link></div></header>
    <div className="workspace-body">
      <aside className={`workspace-side ${panelOpen ? 'visible' : ''}`}><div className="side-label">Repository</div><div className="repo-side-card"><Code2 size={17} /><div><strong>{repo ? repoUrl.replace('https://github.com/', '') : 'Connect a repository'}</strong><span>{repo ? `${repo.files_scanned ?? '—'} files indexed` : 'GitHub URL required'}</span></div></div>{repo && <div className="side-stats"><div><strong>{repo.files_scanned ?? '—'}</strong><span>files</span></div><div><strong>{repo.total_chunks ?? '—'}</strong><span>chunks</span></div></div>}<div className="side-note"><ShieldCheck size={15} /><span>Answers use your indexed repository context.</span></div></aside>
      <main className="chat-main">
        <AnimatePresence mode="wait">
          {messages.length === 0 ? <motion.div key="welcome" className="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="welcome-icon"><Sparkles /></div><span className="section-kicker">Codebase intelligence</span><h1>How can I help?</h1><p>Connect a repository, then ask anything about its architecture, flow, or features.</p><form className="connect-form" onSubmit={connect}><div className="input-wrap"><GitBranch size={17} /><input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/owner/repository" aria-label="GitHub repository URL" /><button type="submit" disabled={status === 'connecting'}>{status === 'connecting' ? 'Indexing…' : repo ? 'Re-index' : 'Connect'} <ArrowRight size={15} /></button></div>{error && <div className="error-message">{error}<button type="button" onClick={() => setError('')}>Dismiss</button></div>}</form><div className="suggestion-grid">{questions.map(({ title, text, icon: Icon, tone }) => <button key={title} className="suggestion-card" type="button" onClick={() => { setDraft(text); if (status === 'ready') sendQuestion(text); }} disabled={!repo || status === 'asking'}><span className={`suggestion-icon ${tone}`}><Icon /></span><span><strong>{title}</strong><small>{text}</small></span><ArrowRight size={15} /></button>)}</div>{!repo && <span className="suggestion-hint">Connect a repository to unlock questions</span>}</motion.div> : <motion.div key="chat" className="chat-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{messages.map((message, index) => <Message key={`${message.role}-${index}`} message={message} onCopy={copyAnswer} />)}{status === 'asking' && <div className="typing"><span /><span /><span /> Thinking through the codebase</div>}</motion.div>}
        </AnimatePresence>
        {repo && <form className="composer" onSubmit={(event) => { event.preventDefault(); sendQuestion(); }}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendQuestion(); } }} placeholder="Ask anything about this codebase…" rows={1} disabled={status === 'asking'} /><div className="composer-bottom"><span>Enter to send · Shift + Enter for a new line</span><button type="submit" disabled={!draft.trim() || status === 'asking'}><Send size={16} /></button></div></form>}
        {copied && <div className="toast"><Check size={14} /> Copied to clipboard</div>}
      </main>
    </div>
  </div>;
}

export default function App() {
  return <Routes><Route path="/" element={<Landing />} /><Route path="/workspace" element={<Workspace />} /><Route path="*" element={<Landing />} /></Routes>;
}
