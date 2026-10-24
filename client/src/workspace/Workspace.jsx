import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, ArrowUpRight, Check, Code2, Copy, GitBranch, Layers3,
  MessageSquare, Network, RefreshCw, Send, ShieldCheck, Sparkles, Trash2,
} from 'lucide-react';
import { askRepository, connectRepository, getGraphNode } from '../services/api';
import GraphView from './GraphView';
import './workspace.css';

const EASE = [0.2, 0.7, 0.2, 1];

const SUGGESTIONS = [
  { text: 'Explain the overall architecture.', icon: Layers3 },
  { text: 'Trace the authentication flow.', icon: ShieldCheck },
  { text: 'Where is this feature implemented?', icon: Code2 },
  { text: 'Which files depend on this module?', icon: GitBranch },
];

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

const textOf = (node) => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return textOf(node.props?.children);
};

const lineRange = (s) => (s.start_line
  ? `L${s.start_line}${s.end_line && s.end_line !== s.start_line ? `–${s.end_line}` : ''}`
  : null);

/* ---------- small shared pieces ---------- */

function IconButton({ label, children, ...props }) {
  return <button type="button" className="cq-icon-btn" aria-label={label} title={label} {...props}>{children}</button>;
}

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const code = Array.isArray(children) ? children[0] : children;
  const lang = /language-([\w+-]+)/.exec(code?.props?.className || '')?.[1];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textOf(code?.props?.children).replace(/\n$/, ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };
  return <div className="cq-code">
    <div className="cq-code-head">
      <span>{lang || ''}</span>
      <button type="button" className={copied ? 'is-copied' : ''} onClick={copy} aria-label="Copy code">
        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
      </button>
    </div>
    <pre tabIndex={0}>{children}</pre>
  </div>;
}

const MarkdownAnswer = memo(function MarkdownAnswer({ content }) {
  return <div className="cq-md"><ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeHighlight]}
    components={{
      a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
      pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
      table: ({ children }) => <div className="cq-table-wrap"><table>{children}</table></div>,
    }}
  >{content}</ReactMarkdown></div>;
});

/* ---------- sources ---------- */

function Snippet({ state, source }) {
  if (state.status === 'loading') return <div className="cq-snippet-note"><RefreshCw size={12} className="cq-spin" /> Loading preview…</div>;
  if (state.status === 'error') return <div className="cq-snippet-note is-error">Preview unavailable: {state.message}</div>;
  if (!state.lines.length) return <div className="cq-snippet-note">The backend returned no preview for this file.</div>;
  const end = source.end_line || source.start_line;
  const inRange = source.start_line ? state.lines.filter((l) => l.line >= source.start_line && l.line <= end) : [];
  const shown = inRange.length ? inRange : state.lines.slice(0, 14);
  return <>
    {!inRange.length && <div className="cq-snippet-note">Showing the start of the file; the cited range isn’t in the available preview.</div>}
    <pre className="cq-snippet" tabIndex={0}>{shown.map((l) => `${String(l.line).padStart(3, ' ')}  ${l.content}`).join('\n')}</pre>
  </>;
}

function Sources({ sources, repoId, onViewInGraph }) {
  const [openKey, setOpenKey] = useState(null);
  const [previews, setPreviews] = useState({});
  const toggle = async (source, key) => {
    if (openKey === key) { setOpenKey(null); return; }
    setOpenKey(key);
    if (previews[key]) return;
    setPreviews((p) => ({ ...p, [key]: { status: 'loading' } }));
    try {
      const data = await getGraphNode(repoId, source.file_path);
      setPreviews((p) => ({ ...p, [key]: { status: 'ok', lines: data?.source_preview || [] } }));
    } catch (err) {
      setPreviews((p) => ({ ...p, [key]: { status: 'error', message: err.message || 'request failed' } }));
    }
  };
  return <div className="cq-sources">
    <div className="cq-sources-title"><Code2 size={13} /> Relevant sources</div>
    {sources.map((s, i) => {
      const key = `${s.file_path}-${s.start_line ?? ''}-${s.end_line ?? ''}-${i}`;
      const range = lineRange(s);
      return <div key={key} className="cq-source">
        <div className="cq-source-row">
          <button type="button" className="cq-source-main" aria-expanded={openKey === key} onClick={() => toggle(s, key)}>
            <span className="cq-source-path">{s.file_path}</span>
            {range && <span className="cq-source-lines">{range}</span>}
          </button>
          <IconButton label="View in Graph" onClick={() => onViewInGraph(s.file_path)}><Network size={14} /></IconButton>
        </div>
        <AnimatePresence initial={false}>
          {openKey === key && <motion.div className="cq-source-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}>
            <Snippet state={previews[key] || { status: 'loading' }} source={s} />
          </motion.div>}
        </AnimatePresence>
      </div>;
    })}
  </div>;
}

/* ---------- messages ---------- */

function Message({ message, repoId, onViewInGraph, onRetry }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  if (message.role === 'user') {
    return <motion.div className="cq-msg cq-msg-user" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22, ease: EASE }}>
      <div className="cq-bubble">{message.content}</div>
    </motion.div>;
  }
  if (message.role === 'error') {
    return <motion.div className="cq-msg cq-msg-ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }}>
      <div className="cq-avatar is-error"><AlertCircle size={14} /></div>
      <div className="cq-ai-body"><div className="cq-error-card" role="alert"><strong>Couldn’t get an answer</strong><span>{message.content}</span>
        <button type="button" className="cq-btn cq-btn-ghost" onClick={() => onRetry(message)}><RefreshCw size={13} /> Retry</button></div></div>
    </motion.div>;
  }
  return <motion.div className="cq-msg cq-msg-ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE }}>
    <div className="cq-avatar"><Code2 size={14} /></div>
    <div className="cq-ai-body">
      <div className="cq-ai-name">Codebase<b>QA</b></div>
      <MarkdownAnswer content={message.content} />
      {message.sources?.length > 0 && <Sources sources={message.sources} repoId={repoId} onViewInGraph={onViewInGraph} />}
      <div className="cq-msg-actions">
        <button type="button" className={copied ? 'is-copied' : ''} onClick={copy}>{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}</button>
      </div>
    </div>
  </motion.div>;
}

/* ---------- connect form ---------- */

function ConnectForm({ value, onChange, onSubmit, busy, error, onDismiss, reindex }) {
  return <form className="cq-connect" onSubmit={onSubmit}>
    <div className="cq-connect-notice" role="note">
      <p><strong>Note:</strong> Please submit small repositories only, as this demo uses the Gemini Free API tier, which has limited usage quotas. Indexing large repositories may quickly exhaust the available quota and temporarily prevent further requests.</p>
      <p>For larger repositories or unrestricted usage, please clone <a href="https://github.com/Vaibhav8629/CodeBaseQA" target="_blank" rel="noreferrer">this project</a> and run it locally with your own API key. You can replace the free-tier Gemini API key with a paid-tier API key to access higher usage limits.</p>
    </div>
    <div className="cq-connect-field">
      <GitBranch size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://github.com/owner/repository" aria-label="GitHub repository URL" disabled={busy} />
      <button type="submit" className="cq-btn cq-btn-primary" disabled={busy}>
        {busy ? <><RefreshCw size={14} className="cq-spin" /> Indexing…</> : <>{reindex ? 'Re-index' : 'Connect'} <ArrowRight size={14} /></>}
      </button>
    </div>
    {error && <div className="cq-inline-error" role="alert"><span>{error}</span><button type="button" onClick={onDismiss}>Dismiss</button></div>}
  </form>;
}

/* ---------- workspace ---------- */

export default function Workspace() {
  const [repoUrl, setRepoUrl] = useState('');
  const [repo, setRepo] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | connecting | ready | asking | error
  const [connectError, setConnectError] = useState('');
  const [showConnect, setShowConnect] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [tab, setTab] = useState('chat');
  const [graphMounted, setGraphMounted] = useState(false);
  const [focusRequest, setFocusRequest] = useState(null);

  const epochRef = useRef(0);
  const scrollRef = useRef(null);
  const stickRef = useRef(true);
  const textareaRef = useRef(null);

  const repoName = repo ? repo.url.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '') : '';

  const connect = async (event) => {
    event?.preventDefault();
    const url = repoUrl.trim();
    if (!url) { setConnectError('Enter a GitHub repository URL.'); return; }
    setConnectError('');
    setStatus('connecting');
    try {
      const result = await connectRepository(url);
      if (repo && repo.url !== url) { epochRef.current += 1; setMessages([]); }
      setRepo({ url, ...result });
      setStatus('ready');
      setShowConnect(false);
    } catch (err) {
      setStatus(repo ? 'ready' : 'error');
      setConnectError(err.message || 'Could not connect to the repository.');
    }
  };

  const send = useCallback(async (question, retryOf) => {
    const text = (question ?? draft).trim();
    if (!text || status !== 'ready') return;
    const epoch = epochRef.current;
    stickRef.current = true;
    if (retryOf) setMessages((c) => c.filter((m) => m.id !== retryOf));
    else { setDraft(''); setMessages((c) => [...c, { id: nextId(), role: 'user', content: text }]); }
    setStatus('asking');
    try {
      const result = await askRepository(text);
      if (epoch !== epochRef.current) return;
      const answer = [result?.content, result?.answer].find((v) => typeof v === 'string');
      if (answer === undefined) throw new Error('The server returned an unexpected response format.');
      const sources = Array.isArray(result.sources) ? result.sources.filter((s) => s && typeof s.file_path === 'string') : [];
      setMessages((c) => [...c, { id: nextId(), role: 'assistant', content: answer, sources }]);
    } catch (err) {
      if (epoch !== epochRef.current) return;
      setMessages((c) => [...c, { id: nextId(), role: 'error', content: err.message || 'The request failed.', retry: text }]);
    } finally {
      if (epoch === epochRef.current) setStatus('ready');
    }
  }, [draft, status]);

  const clearChat = () => {
    epochRef.current += 1;
    setMessages([]);
    setDraft('');
    setStatus((s) => (s === 'asking' ? 'ready' : s));
  };

  const viewInGraph = (path) => {
    setGraphMounted(true);
    setTab('graph');
    setFocusRequest({ path, nonce: Date.now() });
  };

  const switchTab = (next) => { if (next === 'graph') setGraphMounted(true); setTab(next); };

  // keep the user's reading position unless they're already at the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft, repo]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const connected = status === 'ready' || status === 'asking';
  const stateLabel = status === 'connecting' ? 'Indexing…' : connected ? 'Connected' : status === 'error' ? 'Failed' : 'Not connected';
  const stateClass = status === 'connecting' ? 'is-busy' : connected ? 'is-on' : status === 'error' ? 'is-error' : '';
  const busy = status === 'connecting';

  return <MotionConfig reducedMotion="user"><div className="cq-ws">
    <header className="cq-header">
      <Link to="/" className="cq-brand" aria-label="CodebaseQA home"><span className="cq-brand-mark"><Code2 size={16} /></span><span>Codebase<b>QA</b></span></Link>
      <div className="cq-repo" title={repoName || undefined}>
        <span className={`cq-dot ${stateClass}`} aria-hidden="true" />
        <span className="cq-repo-name">{repo ? repoName : 'No repository'}</span>
        <span className="cq-repo-state">{stateLabel}{repo?.files_scanned != null && connected ? ` · ${repo.files_scanned} files` : ''}</span>
      </div>
      {repo && <div className="cq-tabs" role="tablist" aria-label="Workspace views">
        <button type="button" role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'active' : ''} onClick={() => switchTab('chat')}><MessageSquare size={14} /> Chat</button>
        <button type="button" role="tab" aria-selected={tab === 'graph'} className={tab === 'graph' ? 'active' : ''} onClick={() => switchTab('graph')}><Network size={14} /> Graph</button>
      </div>}
      <div className="cq-header-actions">
        {repo && <IconButton label="Re-index repository" aria-expanded={showConnect} onClick={() => setShowConnect((v) => !v)}><RefreshCw size={15} /></IconButton>}
        {tab === 'chat' && repo && <button type="button" className="cq-btn cq-btn-ghost" onClick={clearChat} disabled={!messages.length}><Trash2 size={14} /> <span className="cq-hide-sm">Clear chat</span></button>}
        <Link to="/" className="cq-btn cq-btn-ghost">Exit <ArrowRight size={13} /></Link>
      </div>
    </header>

    <AnimatePresence initial={false}>
      {showConnect && repo && <motion.div className="cq-connect-bar" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}>
        <ConnectForm value={repoUrl} onChange={setRepoUrl} onSubmit={connect} busy={busy} error={connectError} onDismiss={() => setConnectError('')} reindex />
      </motion.div>}
    </AnimatePresence>

    <div className="cq-main">
      <section className={`cq-pane ${tab === 'chat' ? 'active' : ''}`} hidden={tab !== 'chat'}>
        {!repo ? <div className="cq-center"><motion.div className="cq-welcome" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
          <div className="cq-welcome-icon"><Sparkles size={22} /></div>
          <h1>Understand your codebase.</h1>
          <p>Connect a GitHub repository to start asking questions.</p>
          <ConnectForm value={repoUrl} onChange={setRepoUrl} onSubmit={connect} busy={busy} error={connectError} onDismiss={() => setConnectError('')} />
          {busy && <p className="cq-hint">Indexing can take a little while for larger repositories.</p>}
        </motion.div></div> : <>
          <div className="cq-scroll" ref={scrollRef} onScroll={onScroll}>
            <AnimatePresence mode="wait" initial>
              {messages.length === 0 ? <div className="cq-center" key="welcome-wrap"><motion.div key="welcome" className="cq-welcome" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }}>
                <div className="cq-welcome-icon"><Sparkles size={22} /></div>
                <h1>Understand your codebase.</h1>
                <p>Ask questions. Trace logic. Explore connections.</p>
                <motion.div className="cq-suggestions" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } } }}>
                  {SUGGESTIONS.map(({ text, icon: Icon }) => <motion.button key={text} type="button" className="cq-suggestion" disabled={status !== 'ready'} onClick={() => send(text)} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE } } }}>
                    <Icon size={16} /><span>{text}</span><ArrowUpRight size={14} className="cq-suggestion-arrow" />
                  </motion.button>)}
                </motion.div>
              </motion.div></div> : <motion.div key="thread" className="cq-thread" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                {messages.map((m) => <Message key={m.id} message={m} repoId={repo.repo_id} onViewInGraph={viewInGraph} onRetry={(msg) => send(msg.retry, msg.id)} />)}
                <AnimatePresence>
                  {status === 'asking' && <motion.div className="cq-msg cq-msg-ai" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} role="status" aria-label="Generating answer">
                    <div className="cq-avatar"><Code2 size={14} /></div>
                    <div className="cq-typing"><span /><span /><span /></div>
                  </motion.div>}
                </AnimatePresence>
              </motion.div>}
            </AnimatePresence>
          </div>
          <div className="cq-composer-wrap">
            <form className="cq-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <textarea ref={textareaRef} rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask anything about this repository..." aria-label="Message" disabled={status !== 'ready'}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
              <div className="cq-composer-bottom">
                <span>Enter to send · Shift + Enter for newline</span>
                <button type="submit" className="cq-send" aria-label="Send message" disabled={!draft.trim() || status !== 'ready'}>
                  {status === 'asking' ? <RefreshCw size={16} className="cq-spin" /> : <Send size={16} />}
                </button>
              </div>
            </form>
          </div>
        </>}
      </section>

      {graphMounted && repo?.repo_id && <section className={`cq-pane ${tab === 'graph' ? 'active' : ''}`} hidden={tab !== 'graph'}>
        <GraphView key={repo.repo_id} repoId={repo.repo_id} active={tab === 'graph'} focusRequest={focusRequest} />
      </section>}
    </div>
  </div></MotionConfig>;
}