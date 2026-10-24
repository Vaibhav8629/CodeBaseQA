import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, ArrowRight, ChevronDown, Code2, Crosshair, FileCode2, FolderTree, LocateFixed,
  Map as MapIcon, Network, PanelRight, RefreshCw, Search, Settings2, X, ZoomIn, ZoomOut, Layers3,
} from 'lucide-react';
import { getGraphNode, getGraphStatus, getRepositoryGraph, regenerateRepositoryGraph } from '../services/api';

const EASE = [0.2, 0.7, 0.2, 1];
const NODE_W = 224;
const NODE_H = 72;
const COL = 300;
const ROW = 100;
const PAD = 60;
const MIN_K = 0.2;
const MAX_K = 1.8;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));

const TYPE_COLOR = {
  component: '#a78bfa', page: '#60a5fa', store: '#fbbf24', api: '#fb7185',
  utility: '#34d399', schema: '#38bdf8', config: '#f59e0b', file: '#94a3b8',
};
const TYPE_ICON = {
  component: Layers3, page: FileCode2, store: Settings2, api: Network,
  utility: FolderTree, schema: Code2, config: Settings2, file: FileCode2,
};
const colorOf = (t) => TYPE_COLOR[t] || TYPE_COLOR.file;
const dirOf = (path = '') => {
  const d = path.split('/').slice(0, -1).join('/');
  if (!d) return 'root';
  return d.length > 30 ? `…${d.slice(-29)}` : d;
};

function MiniMap({ nodes, edges, positions, width, height, view, vp, selectedId, onNavigate }) {
  const MW = 176;
  const MH = clamp((MW * height) / Math.max(width, 1), 64, 120);
  const scale = Math.min(MW / width, MH / height);
  const offX = (MW - width * scale) / 2;
  const offY = (MH - height * scale) / 2;
  const dragging = useRef(false);
  const go = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onNavigate((e.clientX - r.left - offX) / scale, (e.clientY - r.top - offY) / scale);
  };
  return <svg className="cq-minimap-svg" width={MW} height={MH} viewBox={`${-offX / scale} ${-offY / scale} ${MW / scale} ${MH / scale}`}
    onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); go(e); }}
    onPointerMove={(e) => { if (dragging.current) go(e); }}
    onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }} aria-label="Graph minimap">
    {edges.map((e) => {
      const s = positions.get(e.source); const t = positions.get(e.target);
      return s && t ? <line key={e.id} x1={s.x + NODE_W / 2} y1={s.y + NODE_H / 2} x2={t.x + NODE_W / 2} y2={t.y + NODE_H / 2} className="cq-mm-edge" /> : null;
    })}
    {nodes.map((n) => { const p = positions.get(n.id); return p ? <rect key={n.id} x={p.x} y={p.y} width={NODE_W} height={NODE_H} rx="10" className={`cq-mm-node ${n.id === selectedId ? 'is-sel' : ''}`} /> : null; })}
    {vp.w > 0 && <rect className="cq-mm-view" x={-view.x / view.k} y={-view.y / view.k} width={vp.w / view.k} height={vp.h / view.k} vectorEffect="non-scaling-stroke" />}
  </svg>;
}

function DepList({ title, hint, items, emptyText, tone, onSelect }) {
  return <section className="cq-dep">
    <div className="cq-dep-title"><span className={`cq-dep-dot ${tone}`} />{title}<em>{items.length}</em></div>
    <div className="cq-dep-hint">{hint}</div>
    {items.length ? <ul>{items.map((p) => <li key={p}><button type="button" onClick={() => onSelect(p)} title={p}><span>{p}</span><ArrowRight size={12} /></button></li>)}</ul> : <div className="cq-dep-empty">{emptyText}</div>}
  </section>;
}

export default function GraphView({ repoId, active, focusRequest }) {
  const [graph, setGraph] = useState(null);
  const [loadedMode, setLoadedMode] = useState(null);
  const [gen, setGen] = useState(0);
  const [mode, setMode] = useState('file_graph');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [gStatus, setGStatus] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsError, setDetailsError] = useState('');
  const [panelOpen, setPanelOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 900);
  const [mapOpen, setMapOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 900);

  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTypes, setActiveTypes] = useState([]); // types currently shown; empty = all
  const [focus, setFocus] = useState(false);

  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [smooth, setSmooth] = useState(false);
  const [vp, setVp] = useState({ w: 0, h: 0 });

  const viewportRef = useRef(null);
  const panRef = useRef(null);
  const fittedGen = useRef(-1);
  const pendingCenter = useRef(null);
  const handledNonce = useRef(null);
  const detailsReq = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /* ----- data ----- */
  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getRepositoryGraph(repoId, { mode });
      if (!mounted.current) return;
      setGraph(result);
      setLoadedMode(mode);
      setGen((g) => g + 1);
    } catch (err) {
      if (mounted.current) setError(err.message || 'Failed to load the graph.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [mode, repoId]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  useEffect(() => {
    let off = false;
    getGraphStatus(repoId).then((s) => { if (!off) setGStatus(s); }).catch(() => {});
    return () => { off = true; };
  }, [repoId]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(t);
  }, [notice]);

  const regenerate = async () => {
    setRegenerating(true);
    setError('');
    try {
      await regenerateRepositoryGraph(repoId);
      let final = null;
      for (let i = 0; i < 120; i += 1) {
        const s = await getGraphStatus(repoId);
        if (!mounted.current) return;
        setGStatus(s);
        if (s.status === 'complete' || s.status === 'failed') { final = s; break; }
        await sleep(700);
      }
      if (!final) throw new Error('Graph generation is taking longer than expected. Try again shortly.');
      if (final.status === 'failed') throw new Error(final.error || final.message || 'Graph generation failed.');
      await loadGraph();
      if (mounted.current) setNotice('Graph regenerated');
    } catch (err) {
      if (mounted.current) setError(err.message || 'Graph regeneration failed.');
    } finally {
      if (mounted.current) setRegenerating(false);
    }
  };

  const select = useCallback(async (id) => {
    const req = ++detailsReq.current;
    setSelectedId(id);
    setDetailsError('');
    setPanelOpen(true);
    try {
      const data = await getGraphNode(repoId, id);
      if (req === detailsReq.current) setDetails(data);
    } catch (err) {
      if (req === detailsReq.current) { setDetails(null); setDetailsError(err.message || 'Details unavailable.'); }
    }
  }, [repoId]);

  const clearSelection = () => { detailsReq.current += 1; setSelectedId(null); setDetails(null); setDetailsError(''); };

  /* ----- derived graph ----- */
  const nodes = useMemo(() => graph?.nodes || [], [graph]);
  const edges = useMemo(() => graph?.edges || [], [graph]);
  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const idByPath = useMemo(() => new Map(nodes.map((n) => [n.path || n.id, n.id])), [nodes]);
  const activeId = selectedId && nodeIds.has(selectedId) ? selectedId : null;
  const categories = useMemo(() => Object.entries(graph?.categories || {}), [graph]);

  const { outSet, inSet } = useMemo(() => {
    const o = new Set(); const i = new Set();
    if (activeId) edges.forEach((e) => { if (e.source === activeId) o.add(e.target); if (e.target === activeId) i.add(e.source); });
    return { outSet: o, inSet: i };
  }, [edges, activeId]);

  const visibleNodes = useMemo(() => nodes.filter((n) => {
    if (activeTypes.length && !activeTypes.includes(n.type)) return false;
    if (focus && activeId && n.id !== activeId && !outSet.has(n.id) && !inSet.has(n.id)) return false;
    return true;
  }), [nodes, activeTypes, focus, activeId, outSet, inSet]);
  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map((n) => n.id));
    return edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }, [edges, visibleNodes]);

  const layout = useMemo(() => {
    const incoming = new Map(visibleNodes.map((n) => [n.id, []]));
    visibleEdges.forEach((e) => incoming.get(e.target)?.push(e.source));
    const layers = new Map(); const resolving = new Set();
    const layerOf = (id) => {
      if (layers.has(id)) return layers.get(id);
      if (resolving.has(id)) return 0;
      resolving.add(id);
      const l = Math.min(6, Math.max(0, ...(incoming.get(id) || []).map((s) => layerOf(s) + 1)));
      resolving.delete(id);
      layers.set(id, l);
      return l;
    };
    visibleNodes.forEach((n) => layerOf(n.id));
    const byLayer = new Map();
    visibleNodes.forEach((n) => { const l = layers.get(n.id) ?? 0; if (!byLayer.has(l)) byLayer.set(l, []); byLayer.get(l).push(n); });
    const positions = new Map();
    let maxCol = 0; let maxRows = 0;
    [...byLayer.entries()].sort(([a], [b]) => a - b).forEach(([l, list]) => {
      list.sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0) || String(a.label).localeCompare(String(b.label)));
      maxCol = Math.max(maxCol, l); maxRows = Math.max(maxRows, list.length);
      list.forEach((n, i) => positions.set(n.id, { x: PAD + l * COL, y: PAD + i * ROW }));
    });
    return { positions, width: maxCol * COL + NODE_W + PAD * 2, height: Math.max(1, maxRows) * ROW - (ROW - NODE_H) + PAD * 2 };
  }, [visibleNodes, visibleEdges]);

  const q = search.trim().toLowerCase();
  const matches = useMemo(() => (q ? nodes.filter((n) => `${n.label} ${n.path}`.toLowerCase().includes(q)) : []), [nodes, q]);
  const matchIds = useMemo(() => new Set(matches.map((n) => n.id)), [matches]);

  const edgeItems = useMemo(() => visibleEdges.map((e) => {
    let state = 'base';
    if (activeId) state = e.source === activeId ? 'out' : e.target === activeId ? 'in' : 'dim';
    return { e, state };
  }).sort((a, b) => (a.state === 'dim' ? 0 : a.state === 'base' ? 1 : 2) - (b.state === 'dim' ? 0 : b.state === 'base' ? 1 : 2)), [visibleEdges, activeId]);

  /* ----- viewport ----- */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setVp({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !el.clientWidth || !el.clientHeight || !layout.width || !layout.height) return false;
    const k = clamp(Math.min((el.clientWidth - 80) / layout.width, (el.clientHeight - 80) / layout.height, 1.2), MIN_K, MAX_K);
    setSmooth(true);
    setView({ k, x: (el.clientWidth - layout.width * k) / 2, y: (el.clientHeight - layout.height * k) / 2 });
    return true;
  }, [layout]);

  useEffect(() => {
    if (!active || !graph || fittedGen.current === gen || !vp.w || !vp.h) return undefined;
    const frame = window.requestAnimationFrame(() => {
      if (fit()) fittedGen.current = gen;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, graph, gen, fit, vp.w, vp.h]);

  const centerOn = useCallback((id) => {
    const p = layout.positions.get(id); const el = viewportRef.current;
    if (!p || !el) return false;
    setSmooth(true);
    setView((v) => ({ ...v, x: el.clientWidth / 2 - (p.x + NODE_W / 2) * v.k, y: el.clientHeight / 2 - (p.y + NODE_H / 2) * v.k }));
    return true;
  }, [layout]);

  useEffect(() => {
    if (pendingCenter.current && active && centerOn(pendingCenter.current)) pendingCenter.current = null;
  }, [layout, active, centerOn]);

  const focusNode = (id) => {
    select(id);
    pendingCenter.current = id;
    if (activeTypes.length || (focus && !layout.positions.has(id))) { setActiveTypes([]); setFocus(false); }
    else if (centerOn(id)) pendingCenter.current = null;
  };

  const zoomAt = (factor, cx, cy, animate) => {
    setSmooth(animate);
    setView((v) => { const k = clamp(v.k * factor, MIN_K, MAX_K); const r = k / v.k; return { k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r }; });
  };
  const zoomCenter = (factor) => zoomAt(factor, vp.w / 2, vp.h / 2, true);

  const onWheel = (e) => {
    const r = viewportRef.current.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0012), e.clientX - r.left, e.clientY - r.top, false);
  };
  const onPointerDown = (e) => {
    if (e.button !== 0 || e.target.closest?.('.cq-node, .cq-overlay')) return;
    panRef.current = { sx: e.clientX, sy: e.clientY, x: view.x, y: view.y, moved: false };
    viewportRef.current.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const p = panRef.current;
    if (!p) return;
    const dx = e.clientX - p.sx; const dy = e.clientY - p.sy;
    if (!p.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    p.moved = true;
    setSmooth(false);
    setView((v) => ({ ...v, x: p.x + dx, y: p.y + dy }));
  };
  const onPointerUp = () => {
    const p = panRef.current; panRef.current = null;
    if (p && !p.moved && selectedId) clearSelection();
  };
  const miniNavigate = (gx, gy) => { setSmooth(false); setView((v) => ({ ...v, x: vp.w / 2 - gx * v.k, y: vp.h / 2 - gy * v.k })); };

  /* ----- request from Chat: "View in Graph" ----- */
  useEffect(() => {
    if (!focusRequest || !graph || loading || loadedMode !== mode || handledNonce.current === focusRequest.nonce) return;
    const clean = focusRequest.path.replace(/^\.?\//, '');
    const id = idByPath.get(focusRequest.path) ?? idByPath.get(clean) ?? (nodeIds.has(focusRequest.path) ? focusRequest.path : null);
    if (id) { handledNonce.current = focusRequest.nonce; focusNode(id); return; }
    if (mode !== 'file_graph') { setMode('file_graph'); return; }
    handledNonce.current = focusRequest.nonce;
    setNotice(`No graph node found for ${focusRequest.path}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest, graph, loading, loadedMode, mode, idByPath, nodeIds]);

  /* ----- derived UI ----- */
  const toggleType = (t) => setActiveTypes((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]));
  const incomingPaths = (details?.imported_by || []).map((i) => i.source).filter(Boolean);
  const outgoingPaths = (details?.imports_from || []).map((i) => i.target).filter(Boolean);
  const selectPath = (p) => select(idByPath.get(p) ?? p);
  const detailNode = details?.node;
  const statusLabel = regenerating ? `Generating${gStatus?.progress != null ? ` ${gStatus.progress}%` : '…'}` : gStatus?.status ? String(gStatus.status).replace(/_/g, ' ') : null;
  const empty = !loading && graph && nodes.length === 0;
  const notReady = empty && gStatus && gStatus.status !== 'complete';

  return <div className="cq-graph">
    <div className="cq-gtoolbar">
      <div className="cq-seg" role="group" aria-label="Graph mode">
        <button type="button" className={mode === 'file_graph' ? 'active' : ''} aria-pressed={mode === 'file_graph'} onClick={() => setMode('file_graph')}>File graph</button>
        <button type="button" className={mode === 'overview' ? 'active' : ''} aria-pressed={mode === 'overview'} onClick={() => setMode('overview')}>Overview</button>
      </div>

      <div className="cq-gsearch">
        <Search size={14} />
        <input value={search} placeholder="Search files…" aria-label="Search graph nodes"
          onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); e.currentTarget.blur(); } if (e.key === 'Enter' && matches[0]) { focusNode(matches[0].id); setSearchOpen(false); } }} />
        {search && <button type="button" className="cq-clear" aria-label="Clear search" onClick={() => setSearch('')}><X size={13} /></button>}
        <AnimatePresence>
          {searchOpen && q && <motion.div className="cq-results" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            {matches.length ? matches.slice(0, 8).map((n) => <button type="button" key={n.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { focusNode(n.id); setSearchOpen(false); }}>
              <strong>{n.label}</strong><span>{n.path}</span></button>) : <div className="cq-results-empty">No files match “{search}”.</div>}
            {matches.length > 8 && <div className="cq-results-empty">+{matches.length - 8} more highlighted on the graph</div>}
          </motion.div>}
        </AnimatePresence>
      </div>

      <button type="button" className={`cq-btn cq-btn-ghost ${focus ? 'is-active' : ''}`} aria-pressed={focus} onClick={() => setFocus((v) => !v)} disabled={!activeId} title={activeId ? 'Show only the selected file and its direct connections' : 'Select a file to use focus'}><Crosshair size={14} /> Focus</button>

      <div className="cq-gtoolbar-end">
        <span className="cq-gstat"><b>{visibleNodes.length}</b> nodes · <b>{visibleEdges.length}</b> edges</span>
        {statusLabel && <span className={`cq-chip ${regenerating ? 'is-busy' : gStatus?.status === 'failed' ? 'is-error' : ''}`}>{statusLabel}</span>}
        <button type="button" className="cq-btn cq-btn-ghost" onClick={regenerate} disabled={regenerating || loading}><RefreshCw size={14} className={regenerating ? 'cq-spin' : ''} /> <span className="cq-hide-sm">{regenerating ? 'Generating…' : 'Regenerate'}</span></button>
        <button type="button" className="cq-icon-btn" aria-label="Toggle details panel" title="Toggle details panel" aria-pressed={panelOpen} onClick={() => setPanelOpen((v) => !v)}><PanelRight size={15} /></button>
      </div>
    </div>

    {categories.length > 0 && <div className="cq-filters" role="group" aria-label="Filter by node type">
      <button type="button" className={!activeTypes.length ? 'active' : ''} aria-pressed={!activeTypes.length} onClick={() => setActiveTypes([])}>All <em>{nodes.length}</em></button>
      {categories.map(([t, count]) => {
        const Icon = TYPE_ICON[t] || FileCode2; const on = activeTypes.includes(t);
        return <button key={t} type="button" className={on ? 'active' : ''} aria-pressed={on} onClick={() => toggleType(t)}><Icon size={12} style={{ color: colorOf(t) }} /> {t} <em>{count}</em></button>;
      })}
    </div>}

    <div className="cq-gbody">
      <div className="cq-canvas" ref={viewportRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { panRef.current = null; }} onWheel={onWheel}>
        <svg className="cq-svg" width={layout.width} height={layout.height} role="group" aria-label="Repository dependency graph"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transition: smooth ? 'transform .3s cubic-bezier(.2,.7,.2,1)' : 'none' }}>
          <defs>
            {['base', 'out', 'in', 'dim'].map((s) => <marker key={s} id={`cq-arrow-${s}`} className={`cq-arrow cq-arrow-${s}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 z" /></marker>)}
          </defs>
          <g key={gen} className="cq-layer">
            {edgeItems.map(({ e, state }) => {
              const s = layout.positions.get(e.source); const t = layout.positions.get(e.target);
              if (!s || !t) return null;
              const sx = s.x + NODE_W; const sy = s.y + NODE_H / 2; const tx = t.x; const ty = t.y + NODE_H / 2;
              const bend = Math.max(60, Math.abs(tx - sx) * 0.45);
              return <path key={e.id} className={`cq-edge is-${state}`} d={`M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`} markerEnd={`url(#cq-arrow-${state})`} />;
            })}
            {visibleNodes.map((n) => {
              const p = layout.positions.get(n.id);
              if (!p) return null;
              const Icon = TYPE_ICON[n.type] || FileCode2;
              const isSel = n.id === activeId;
              const rel = isSel ? '' : outSet.has(n.id) ? 'is-out' : inSet.has(n.id) ? 'is-in' : '';
              const dim = (activeId && !isSel && !rel) || (q && !matchIds.has(n.id));
              const match = q && matchIds.has(n.id);
              const path = n.path || n.label || n.id;
              return <foreignObject key={n.id} x={p.x} y={p.y} width={NODE_W} height={NODE_H} className="cq-node-fo">
                <div className={`cq-node ${isSel ? 'is-sel' : ''} ${rel} ${dim ? 'is-dim' : ''} ${match ? 'is-match' : ''}`} role="button" tabIndex={0} aria-pressed={isSel} title={path}
                  onClick={(ev) => { ev.stopPropagation(); select(n.id); }}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(n.id); } }}>
                  <span className="cq-node-icon" style={{ color: colorOf(n.type) }}><Icon size={15} /></span>
                  <span className="cq-node-text"><strong>{n.label}</strong><small>{dirOf(path)}</small></span>
                  {(n.in_degree != null || n.out_degree != null) && <span className="cq-node-deg" title="imported by · imports">{n.in_degree ?? 0}↙ {n.out_degree ?? 0}↗</span>}
                </div>
              </foreignObject>;
            })}
          </g>
        </svg>

        <div className="cq-overlay cq-zoom" role="group" aria-label="Zoom controls">
          <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomCenter(1.25)}><ZoomIn size={15} /></button>
          <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomCenter(0.8)}><ZoomOut size={15} /></button>
          <button type="button" aria-label="Fit to view" title="Fit to view" onClick={fit}><LocateFixed size={15} /></button>
          <span>{Math.round(view.k * 100)}%</span>
        </div>

        <div className="cq-overlay cq-legend"><span><i className="out" /> imports</span><span><i className="in" /> imported by</span><span className="cq-hide-sm">Scroll to zoom · drag to pan</span></div>

        <div className="cq-overlay cq-minimap">
          <button type="button" className="cq-minimap-toggle" aria-expanded={mapOpen} onClick={() => setMapOpen((v) => !v)} title="Toggle minimap"><MapIcon size={13} /> Map <ChevronDown size={12} className={mapOpen ? '' : 'is-flipped'} /></button>
          <AnimatePresence initial={false}>
            {mapOpen && visibleNodes.length > 0 && <motion.div className="cq-minimap-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}>
              <MiniMap nodes={visibleNodes} edges={visibleEdges} positions={layout.positions} width={layout.width} height={layout.height} view={view} vp={vp} selectedId={activeId} onNavigate={miniNavigate} />
            </motion.div>}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {notice && <motion.div className="cq-overlay cq-toast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{notice}</motion.div>}
        </AnimatePresence>

        {/* states */}
        {loading && !graph && <div className="cq-state"><RefreshCw size={18} className="cq-spin" /><strong>Building dependency map…</strong></div>}
        {loading && graph && <div className="cq-state is-soft"><RefreshCw size={16} className="cq-spin" /><span>Loading…</span></div>}
        {regenerating && <div className="cq-state is-soft"><RefreshCw size={16} className="cq-spin" /><span>{statusLabel}</span>
          {gStatus?.progress != null && <div className="cq-progress"><div style={{ width: `${clamp(gStatus.progress, 0, 100)}%` }} /></div>}</div>}
        {error && !loading && <div className="cq-state cq-overlay" role="alert"><AlertCircle size={18} /><strong>{graph ? 'Something went wrong' : 'Couldn’t load the graph'}</strong><span>{error}</span>
          <div className="cq-state-actions"><button type="button" className="cq-btn cq-btn-primary" onClick={graph ? regenerate : loadGraph}>{graph ? 'Try regenerating' : 'Retry'}</button><button type="button" className="cq-btn cq-btn-ghost" onClick={() => setError('')}>Dismiss</button></div></div>}
        {empty && !error && <div className="cq-state"><Network size={18} /><strong>{notReady ? 'Graph not ready' : 'No files in the graph'}</strong>
          <span>{notReady ? `Current status: ${String(gStatus.status).replace(/_/g, ' ')}.` : 'The backend returned an empty graph for this repository.'}</span>
          <button type="button" className="cq-btn cq-btn-primary" onClick={regenerate} disabled={regenerating}>Generate graph</button></div>}
        {!loading && graph && nodes.length > 0 && visibleNodes.length === 0 && <div className="cq-state"><Search size={18} /><strong>No nodes to show</strong><span>The current filters hide every file.</span>
          <button type="button" className="cq-btn cq-btn-ghost" onClick={() => { setActiveTypes([]); setFocus(false); }}>Reset filters</button></div>}
        {!loading && visibleNodes.length > 0 && visibleEdges.length === 0 && <div className="cq-overlay cq-note"><Network size={14} /> No internal dependencies among the visible files.</div>}
        {q && matches.length === 0 && visibleNodes.length > 0 && <div className="cq-overlay cq-note is-warn"><Search size={14} /> No files match “{search}”.</div>}
      </div>

      <AnimatePresence initial={false}>
        {panelOpen && <motion.aside className="cq-details" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2, ease: EASE }} aria-label="Selected file details">
          {!selectedId ? <div className="cq-details-empty"><FileCode2 size={20} /><strong>No file selected</strong><span>Select a node to inspect what it imports and what imports it.</span></div> : <>
            <div className="cq-details-head">
              <div>
                {detailNode?.type && <span className="cq-type" style={{ color: colorOf(detailNode.type) }}>{detailNode.type}</span>}
                <h2>{detailNode?.label ?? nodes.find((n) => n.id === selectedId)?.label ?? selectedId}</h2>
                <p>{detailNode?.path ?? nodes.find((n) => n.id === selectedId)?.path ?? selectedId}</p>
              </div>
              <button type="button" className="cq-icon-btn" aria-label="Clear selection" title="Clear selection" onClick={clearSelection}><X size={14} /></button>
            </div>
            {detailsError && <div className="cq-inline-error" role="alert"><span>Details unavailable: {detailsError}</span></div>}
            {details && <>
              <div className="cq-stats">
                {detailNode?.loc != null && <span><b>{detailNode.loc}</b><small>LOC</small></span>}
                <span><b>{incomingPaths.length}</b><small>Imported by</small></span>
                <span><b>{outgoingPaths.length}</b><small>Imports</small></span>
              </div>
              <div className="cq-details-scroll">
                <DepList title="Imported by" tone="in" hint="Files that depend on this file" items={incomingPaths} emptyText="No files import this file." onSelect={selectPath} />
                <DepList title="Imports from" tone="out" hint="Files this file depends on" items={outgoingPaths} emptyText="This file imports no tracked files." onSelect={selectPath} />
                {details.source_preview?.length > 0 && <section className="cq-dep"><div className="cq-dep-title">Source preview</div>
                  <pre className="cq-snippet" tabIndex={0}>{details.source_preview.slice(0, 40).map((l) => `${String(l.line).padStart(3, ' ')}  ${l.content}`).join('\n')}</pre></section>}
              </div>
            </>}
            {!details && !detailsError && <div className="cq-snippet-note"><RefreshCw size={12} className="cq-spin" /> Loading details…</div>}
          </>}
        </motion.aside>}
      </AnimatePresence>
    </div>
  </div>;
}