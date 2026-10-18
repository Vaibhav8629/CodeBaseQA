import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import {
  ArrowRight,
  ChevronDown,
  Check,
  Code2,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  ExternalLink,
  FileCode2,
  FolderTree,
  GitBranch,
  Globe2,
  Layers3,
  LocateFixed,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Network,
  PanelRight,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { askRepository, connectRepository, getGraphNode, getGraphStatus, getRepositoryGraph, regenerateRepositoryGraph } from './services/api';

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

const graphTypeColors = {
  component: 'violet',
  page: 'blue',
  store: 'amber',
  api: 'rose',
  utility: 'mint',
  schema: 'blue',
  config: 'amber',
  file: 'slate',
};

const graphTypeIcons = {
  component: Layers3,
  page: FileCode2,
  store: Settings2,
  api: Network,
  utility: FolderTree,
  schema: Code2,
  config: Settings2,
  file: FileCode2,
};

function GraphView({ repoId }) {
  const [graph, setGraph] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTypes, setActiveTypes] = useState([]);
  const [mode, setMode] = useState('file_graph');
  const [focus, setFocus] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const viewportRef = useRef(null);
  const panRef = useRef(null);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getRepositoryGraph(repoId, { mode });
      setGraph(result);
      if (result.nodes?.[0]) {
        const firstNode = await getGraphNode(repoId, result.nodes[0].id);
        setSelected((current) => current || firstNode);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [mode, repoId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { loadGraph(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadGraph]);

  const regenerate = async () => {
    setRegenerating(true);
    setStatusText('Starting analysis…');
    try {
      await regenerateRepositoryGraph(repoId);
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const status = await getGraphStatus(repoId);
        setStatusText(status.status === 'complete' ? 'Analysis complete' : `Analyzing… ${status.progress ?? 0}%`);
        if (status.status === 'complete' || status.status === 'failed') break;
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
      await loadGraph();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRegenerating(false);
      window.setTimeout(() => setStatusText(''), 1800);
    }
  };

  const toggleType = (type) => setActiveTypes((current) => current.includes(type)
    ? current.filter((item) => item !== type)
    : [...current, type]);
  const filteredNodes = (graph?.nodes || []).filter((node) => {
    const matchesSearch = !search || `${node.label} ${node.path}`.toLowerCase().includes(search.toLowerCase());
    const matchesType = !activeTypes.length || activeTypes.includes(node.type);
    return matchesSearch && matchesType;
  });
  const allEdges = useMemo(() => graph?.edges || [], [graph]);
  const selectedId = selected?.node?.id;
  const focusIds = useMemo(() => {
    if (!focus || !selectedId) return null;
    const ids = new Set([selectedId]);
    allEdges.forEach((edge) => {
      if (edge.source === selectedId) ids.add(edge.target);
      if (edge.target === selectedId) ids.add(edge.source);
    });
    return ids;
  }, [allEdges, focus, selectedId]);
  const visibleNodes = filteredNodes.filter((node) => !focusIds || focusIds.has(node.id));
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = allEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const maxDegree = Math.max(1, ...visibleNodes.map((node) => node.degree ?? (node.in_degree ?? 0) + (node.out_degree ?? 0)));
  const layout = useMemo(() => {
    const incoming = new Map(visibleNodes.map((node) => [node.id, []]));
    visibleEdges.forEach((edge) => incoming.get(edge.target)?.push(edge.source));
    const layers = new Map();
    const resolving = new Set();
    const getLayer = (id) => {
      if (layers.has(id)) return layers.get(id);
      if (resolving.has(id)) return 0;
      resolving.add(id);
      const layer = Math.min(5, Math.max(0, ...(incoming.get(id) || []).map(getLayer).map((value) => value + 1)));
      resolving.delete(id);
      layers.set(id, layer);
      return layer;
    };
    visibleNodes.forEach((node) => getLayer(node.id));
    const byLayer = new Map();
    visibleNodes.forEach((node) => {
      const layer = layers.get(node.id) ?? 0;
      if (!byLayer.has(layer)) byLayer.set(layer, []);
      byLayer.get(layer).push(node);
    });
    const positions = new Map();
    [...byLayer.entries()].sort(([a], [b]) => a - b).forEach(([layer, nodes]) => {
      nodes.sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0) || a.label.localeCompare(b.label));
      nodes.forEach((node, index) => positions.set(node.id, {
        x: 80 + layer * 310,
        y: 70 + index * 168,
      }));
    });
    const width = Math.max(1100, (Math.max(0, ...layers.values()) + 1) * 310 + 260);
    const height = Math.max(720, Math.max(0, ...[...byLayer.values()].map((nodes) => nodes.length)) * 168 + 160);
    return { positions, width, height };
  }, [visibleEdges, visibleNodes]);
  const categories = Object.entries(graph?.categories || {});

  const selectNode = async (node) => {
    try {
      setSelected(await getGraphNode(repoId, node.id));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const edgeState = (edge) => {
    if (!selectedId) return 'normal';
    if (edge.source === selectedId) return 'outgoing';
    if (edge.target === selectedId) return 'incoming';
    return 'dimmed';
  };

  const handleCanvasPointerDown = (event) => {
    if (event.target.closest?.('.graph-card')) return;
    panRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
    viewportRef.current?.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (event) => {
    if (!panRef.current) return;
    setPan({
      x: panRef.current.panX + event.clientX - panRef.current.startX,
      y: panRef.current.panY + event.clientY - panRef.current.startY,
    });
  };

  const stopCanvasPan = () => { panRef.current = null; };
  const resetViewport = () => { setPan({ x: 0, y: 0 }); setZoom(1); };
  const fitGraph = () => {
    const viewport = viewportRef.current;
    if (!viewport || !layout.width || !layout.height) return;
    const scale = Math.min((viewport.clientWidth - 80) / layout.width, (viewport.clientHeight - 80) / layout.height, 1);
    setZoom(Math.max(0.35, scale));
    setPan({ x: 40, y: 40 });
  };

  if (loading) return <div className="graph-loading"><RefreshCw className="spin" /> Building dependency map…</div>;
  return <div className="graph-shell">
    <div className="graph-toolbar">
      <div className="graph-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search nodes…" /><kbd>⌘ K</kbd></div>
      <div className="graph-stat-bar"><strong>{visibleNodes.length}</strong> nodes <i /> <strong>{visibleEdges.length}</strong> edges <i /> <span>{graph?.metrics?.density?.toFixed(2) ?? '0.00'} density</span></div>
      <div className="graph-view-toggle"><span>VIEW</span><button className={mode === 'file_graph' ? 'active' : ''} type="button" onClick={() => setMode('file_graph')}>File Graph</button><button className={mode === 'overview' ? 'active' : ''} type="button" onClick={() => setMode('overview')}>Overview</button></div>
      <button className={`graph-focus-button ${focus ? 'active' : ''}`} type="button" onClick={() => setFocus((value) => !value)}><Crosshair size={13} /> Focus <span>{focus ? 'On' : 'Off'}</span></button>
      <button className="graph-tool-button" type="button" onClick={fitGraph}><LocateFixed size={14} /> Fit</button>
      <button className="graph-tool-button" type="button" onClick={resetViewport}><Crosshair size={14} /> Center</button>
      <button className="graph-tool-button" type="button" onClick={regenerate} disabled={regenerating}><RefreshCw size={14} className={regenerating ? 'spin' : ''} /> {regenerating ? 'Generating…' : 'Regenerate'}</button>
      <button className="graph-tool-button graph-more-button" type="button" title="More graph actions"><MoreHorizontal size={16} /></button>
    </div>
    {statusText && <div className="graph-status-message">{statusText}</div>}
    {error && <div className="graph-error">{error}</div>}
    <div className="graph-content">
      <aside className="graph-filters">
        <span className="graph-panel-title"><Settings2 size={13} /> Type filters <small>{categories.length}/8</small></span>
        <p>Toggle a type to show or hide its nodes and edges.</p>
        {categories.map(([type, count]) => {
          const Icon = graphTypeIcons[type] || FileCode2;
          const hidden = activeTypes.includes(type);
          return <button key={type} className={`type-filter ${hidden ? 'is-hidden' : ''}`} type="button" onClick={() => toggleType(type)}><span className={`type-icon ${graphTypeColors[type] || 'slate'}`}><Icon size={12} /></span><span>{type}</span><strong>{count}</strong><small>{hidden ? <><EyeOff size={10} /> Hidden</> : <><Eye size={10} /> Shown</>}</small></button>;
        })}
        {activeTypes.length > 0 && <button type="button" className="reset-filters" onClick={() => setActiveTypes([])}>Reset show all</button>}
      </aside>
      <div className="graph-canvas" ref={viewportRef} onPointerDown={handleCanvasPointerDown} onPointerMove={handleCanvasPointerMove} onPointerUp={stopCanvasPan} onPointerCancel={stopCanvasPan} onWheel={(event) => { setZoom((value) => Math.min(1.8, Math.max(.35, value - event.deltaY * .001))); }}>
        <div className="graph-canvas-label"><span>{mode === 'overview' ? 'MODULE OVERVIEW' : 'FILE GRAPH'}</span><span>{focus && selectedId ? 'FOCUS MODE' : `${graph?.metrics?.visible_nodes ?? 0} / ${graph?.metrics?.total_nodes ?? 0} shown`}</span></div>
        {visibleEdges.length === 0 && <div className="empty-graph-note"><Network size={17} /><strong>{visibleNodes.length ? 'No internal dependencies' : 'No matching files'}</strong><span>{visibleNodes.length ? 'The repository contains isolated files, so no connections are fabricated.' : 'Adjust search or filters to show nodes.'}</span></div>}
        <svg className="dependency-svg" width={layout.width} height={layout.height} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }} aria-label="Repository dependency graph">
          <defs><marker id="graph-arrow-normal" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#5966b7" /></marker><marker id="graph-arrow-active" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#a991ff" /></marker></defs>
          {visibleEdges.map((edge) => {
            const source = layout.positions.get(edge.source);
            const target = layout.positions.get(edge.target);
            if (!source || !target) return null;
            const state = edgeState(edge);
            const sx = source.x + 246;
            const sy = source.y + 64;
            const tx = target.x;
            const ty = target.y + 64;
            const bend = Math.max(70, Math.abs(tx - sx) * .42);
            const path = `M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`;
            return <g key={edge.id} className={`dependency-edge ${state}`}><path d={path} markerEnd={`url(#graph-arrow-${state === 'normal' ? 'normal' : 'active'})`} /><text x={(sx + tx) / 2} y={(sy + ty) / 2 - 8}>{state !== 'dimmed' && 'imports'}</text></g>;
          })}
          {visibleNodes.map((node) => {
            const point = layout.positions.get(node.id);
            if (!point) return null;
            const type = graphTypeColors[node.type] || 'slate';
            const Icon = graphTypeIcons[node.type] || FileCode2;
            const isSelected = selectedId === node.id;
            const isHovered = hovered === node.id;
            const isDimmed = selectedId && focus && !focusIds.has(node.id);
            const degree = node.degree ?? (node.in_degree ?? 0) + (node.out_degree ?? 0);
            const rank = maxDegree ? Math.max(1, Math.round((degree / maxDegree) * 9)) : 1;
            const nodePath = node.path || node.label || node.id;
            return <foreignObject key={node.id} x={point.x} y={point.y} width="246" height="128" className={`graph-node-object ${isDimmed ? 'dimmed' : ''}`} onMouseEnter={() => setHovered(node.id)} onMouseLeave={() => setHovered(null)} onClick={(event) => { event.stopPropagation(); selectNode(node); }}><div className={`graph-card ${type} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`} title={`${node.label}\n${nodePath}`}><span className="node-port left" /><span className="node-port right" /><div className="graph-card-header"><strong>{node.label}</strong><span className={`node-category ${type}`}><Icon size={10} /> {node.type || 'file'}</span></div><span className="graph-card-path">{nodePath}</span><div className="graph-card-metrics"><span><b>{node.loc ?? 0}</b><small>LOC</small></span><span><b>{degree}</b><small>DEGREE</small></span><span><b>{rank}</b><small>RANK</small></span></div><div className="graph-card-footer"><span>{nodePath.split('/').slice(0, -1).join('/') || 'root'}</span><i><span className="node-status" /> active</i></div></div></foreignObject>;
          })}
        </svg>
        <div className="graph-zoom-controls"><button type="button" onClick={() => setZoom((value) => Math.min(1.8, value + .1))}><ZoomIn size={14} /></button><button type="button" onClick={() => setZoom((value) => Math.max(.35, value - .1))}><ZoomOut size={14} /></button><span>{Math.round(zoom * 100)}%</span></div>
        <MiniMap nodes={visibleNodes} edges={visibleEdges} positions={layout.positions} width={layout.width} height={layout.height} zoom={zoom} pan={pan} />
        <div className="graph-legend"><span><i className="edge-key" /> imports</span><span>Scroll to zoom · drag canvas to pan</span></div>
      </div>
      <aside className="graph-details">
        {selected ? <><div className="details-heading"><div><span className={`file-type ${graphTypeColors[selected.node.type] || 'slate'}`}>{selected.node.type || 'file'}</span><h2>{selected.node.label}</h2><p>{selected.node.path}</p></div><ChevronDown size={16} /></div><div className="details-stats"><span><strong>{selected.node.loc ?? 0}</strong><small>LOC</small></span><span><strong>{selected.node.degree ?? 0}</strong><small>DEGREE</small></span><span><strong>{selected.imported_by?.length ?? 0}</strong><small>IN</small></span><span><strong>{selected.imports_from?.length ?? 0}</strong><small>OUT</small></span></div><DependencyList title="Imported by" items={selected.imported_by} onSelect={selectNode} /><DependencyList title="Imports from" items={selected.imports_from} onSelect={selectNode} /><div className="source-preview"><span>Source preview</span><pre>{selected.source_preview?.slice(0, 40).map((line) => `${String(line.line).padStart(3, ' ')}  ${line.content}`).join('\n')}</pre></div></> : <div className="empty-details">Select a file node to inspect its dependencies.</div>}
      </aside>
    </div>
  </div>;
}

function MiniMap({ nodes, edges, positions, width, height, zoom, pan }) {
  const scale = 150 / Math.max(width, height);
  return <div className="graph-minimap"><div className="minimap-label">MAP</div><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">{edges.map((edge) => { const source = positions.get(edge.source); const target = positions.get(edge.target); return source && target ? <line key={edge.id} x1={source.x + 123} y1={source.y + 64} x2={target.x + 123} y2={target.y + 64} /> : null; })}{nodes.map((node) => { const point = positions.get(node.id); return point ? <rect key={node.id} x={point.x} y={point.y} width="246" height="128" className={graphTypeColors[node.type] || 'slate'} /> : null; })}</svg><span className="minimap-viewport" style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, left: `${Math.max(0, -pan.x / scale / width * 100)}%`, top: `${Math.max(0, -pan.y / scale / height * 100)}%` }} /></div>;
}

function DependencyList({ title, items = [], onSelect }) {
  return <section className="dependency-list"><span>{title}</span>{items.length ? items.slice(0, 8).map((item) => { const path = title === 'Imported by' ? item.source : item.target; return <button type="button" key={item.id} onClick={() => onSelect?.({ id: path, path, label: path, type: 'file' })}>{path} <ArrowRight size={11} /></button>; }) : <small>None detected</small>}</section>;
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
  const [activeTab, setActiveTab] = useState('chat');

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
        {repo && <div className="workspace-tabs"><button className={activeTab === 'chat' ? 'active' : ''} type="button" onClick={() => setActiveTab('chat')}><MessageSquare size={14} /> Chat</button><button className={activeTab === 'graph' ? 'active' : ''} type="button" onClick={() => setActiveTab('graph')}><Network size={14} /> Graph</button></div>}
        {activeTab === 'graph' && repo?.repo_id ? <GraphView repoId={repo.repo_id} /> : <>
        <AnimatePresence mode="wait">
          {messages.length === 0 ? <motion.div key="welcome" className="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div className="welcome-icon"><Sparkles /></div><span className="section-kicker">Codebase intelligence</span><h1>How can I help?</h1><p>Connect a repository, then ask anything about its architecture, flow, or features.</p><form className="connect-form" onSubmit={connect}><div className="input-wrap"><GitBranch size={17} /><input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/owner/repository" aria-label="GitHub repository URL" /><button type="submit" disabled={status === 'connecting'}>{status === 'connecting' ? 'Indexing…' : repo ? 'Re-index' : 'Connect'} <ArrowRight size={15} /></button></div>{error && <div className="error-message">{error}<button type="button" onClick={() => setError('')}>Dismiss</button></div>}</form><div className="suggestion-grid">{questions.map(({ title, text, icon: Icon, tone }) => <button key={title} className="suggestion-card" type="button" onClick={() => { setDraft(text); if (status === 'ready') sendQuestion(text); }} disabled={!repo || status === 'asking'}><span className={`suggestion-icon ${tone}`}><Icon /></span><span><strong>{title}</strong><small>{text}</small></span><ArrowRight size={15} /></button>)}</div>{!repo && <span className="suggestion-hint">Connect a repository to unlock questions</span>}</motion.div> : <motion.div key="chat" className="chat-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{messages.map((message, index) => <Message key={`${message.role}-${index}`} message={message} onCopy={copyAnswer} />)}{status === 'asking' && <div className="typing"><span /><span /><span /> Thinking through the codebase</div>}</motion.div>}
        </AnimatePresence>
        {repo && <form className="composer" onSubmit={(event) => { event.preventDefault(); sendQuestion(); }}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendQuestion(); } }} placeholder="Ask anything about this codebase…" rows={1} disabled={status === 'asking'} /><div className="composer-bottom"><span>Enter to send · Shift + Enter for a new line</span><button type="submit" disabled={!draft.trim() || status === 'asking'}><Send size={16} /></button></div></form>}
        {copied && <div className="toast"><Check size={14} /> Copied to clipboard</div>}
        </>}
      </main>
    </div>
  </div>;
}

export default function App() {
  return <Routes><Route path="/" element={<Landing />} /><Route path="/workspace" element={<Workspace />} /><Route path="*" element={<Landing />} /></Routes>;
}
