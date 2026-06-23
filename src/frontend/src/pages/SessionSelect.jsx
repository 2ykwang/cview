import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageIcon, SearchIcon, FolderIcon } from '../components/Icon';
import OpenSessionCommand from '../components/OpenSessionCommand';
import ThemeToggle from '../components/ThemeToggle';
import { color, radius, space, fontSize, fontWeight, motion, font } from '../styles/tokens';

const AVATAR_TINTS = [
  '#3182f6', '#00C2C8', '#6F7BFF', '#4ECCB5', '#FFB940', '#FF7676',
];
const PAGE_SIZE = 40;

function renderHighlightedText(text, query) {
  if (!text) return '';
  const needle = (query || '').trim();
  if (!needle) return text;
  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const nodes = [];
  let cursor = 0;
  let key = 0;

  while (cursor < text.length) {
    const hit = lowerText.indexOf(lowerNeedle, cursor);
    if (hit === -1) {
      nodes.push(<span key={`t-${key++}`}>{text.slice(cursor)}</span>);
      break;
    }
    if (hit > cursor) nodes.push(<span key={`t-${key++}`}>{text.slice(cursor, hit)}</span>);
    nodes.push(<mark key={`m-${key++}`} style={styles.mark}>{text.slice(hit, hit + needle.length)}</mark>);
    cursor = hit + needle.length;
  }

  return <>{nodes}</>;
}

// Deterministic dot-grid identicon, keyed per project folder. A 5x5 grid
// mirrored left-right (GitHub-style). The pattern carries the uniqueness, so
// even when two folders draw the same tint they stay distinguishable — fixing
// the old "same initial + 1 of 6 colors" collisions.
function Identicon({ seed, size = 40 }) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const fg = AVATAR_TINTS[h % AVATAR_TINTS.length];
  let state = h || 1;
  const next = () => { state = (state * 1664525 + 1013904223) >>> 0; return state; };
  const cells = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if ((next() & 0xff) > 120) {
        cells.push([x, y]);
        if (x < 2) cells.push([4 - x, y]);
      }
    }
  }
  const cell = size / 5;
  const pad = cell * 0.14;
  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"
      style={{ borderRadius: '50%', background: color.bgAlt, flexShrink: 0, marginTop: 2 }}
    >
      {cells.map(([x, y], i) => (
        <rect
          key={i}
          x={x * cell + pad} y={y * cell + pad}
          width={cell - pad * 2} height={cell - pad * 2}
          rx={(cell - pad * 2) * 0.3} fill={fg}
        />
      ))}
    </svg>
  );
}

function relativeTime(mtime) {
  const now = new Date();
  const date = new Date(mtime);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shortenPath(p) {
  if (!p) return '';
  return p.replace(/^\/Users\/[^/]+/, '~');
}

export default function SessionSelect() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextOffset, setNextOffset] = useState(0);
  // Seed the search from the URL so it survives navigating away and back.
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(() => searchParams.get('q') || '');
  const [hovered, setHovered] = useState(null);
  const [expandedRows, setExpandedRows] = useState(() => new Set());

  const toggleExpanded = useCallback((key) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const listRef = useRef(null);
  const sentinelRef = useRef(null);
  const requestIdRef = useRef(0);

  const fetchSessionsPage = useCallback(async ({ offset = 0, reset = false, requestId }) => {
    const activeRequestId = requestId ?? requestIdRef.current;
    const isCurrentRequest = () => activeRequestId === requestIdRef.current;

    if (reset) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(PAGE_SIZE),
      });
      if (debouncedQuery) params.set('q', debouncedQuery);

      const response = await fetch(`/api/sessions?${params.toString()}`);
      if (!response.ok) throw new Error(`Failed to load sessions (${response.status})`);
      const data = await response.json();
      if (!isCurrentRequest()) return;

      const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
      const pagination = Array.isArray(data) ? null : data.pagination;

      setSessions(prev => {
        const base = reset ? [] : prev;
        const seen = new Set(base.map(s => `${s.project}/${s.id}`));
        const merged = [...base];
        for (const session of items) {
          const key = `${session.project}/${session.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(session);
        }
        return merged;
      });

      setNextOffset(pagination?.nextOffset ?? (offset + items.length));
      setHasMore(pagination?.hasMore ?? (items.length === PAGE_SIZE));
    } catch (e) {
      if (!isCurrentRequest()) return;
      setError(e.message);
      if (reset) {
        setSessions([]);
        setHasMore(false);
      }
    } finally {
      if (!isCurrentRequest()) return;
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Mirror the debounced query into the URL so a back-navigation restores
  // it. `replace` keeps it from piling up history entries on every keystroke.
  useEffect(() => {
    setSearchParams(debouncedQuery ? { q: debouncedQuery } : {}, { replace: true });
  }, [debouncedQuery, setSearchParams]);

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setSessions([]);
    setError(null);
    setLoadingMore(false);
    setHasMore(true);
    setNextOffset(0);
    if (listRef.current) listRef.current.scrollTop = 0;
    fetchSessionsPage({ offset: 0, reset: true, requestId });
  }, [fetchSessionsPage]);

  const loadNextPage = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    fetchSessionsPage({ offset: nextOffset, requestId: requestIdRef.current });
  }, [fetchSessionsPage, hasMore, loading, loadingMore, nextOffset]);

  useEffect(() => {
    if (!hasMore || loading) return;
    const root = listRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadNextPage();
      },
      { root, rootMargin: '220px 0px' }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadNextPage, sessions.length]);

  const openSession = (s) => {
    const params = new URLSearchParams({ project: s.project, sessionId: s.id });
    // `fromList` lets Messenger's back button do a real history.back().
    // `matchQuery` lets Messenger scroll to the first message matching the search.
    navigate(`/session?${params.toString()}`, { state: { fromList: true, matchQuery: debouncedQuery || null } });
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.logo}>cview</span>
        <span style={styles.tagline}>Claude Code session viewer</span>
        <span style={styles.headerSpacer} />
        <ThemeToggle />
      </div>
      <div style={styles.searchWrap}>
        <div style={styles.searchInner}>
          <span style={styles.searchIcon}><SearchIcon size={13} /></span>
          <input
            style={styles.search}
            placeholder="Search sessions, project, or content..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div style={styles.list} ref={listRef}>
        {loading && <div style={styles.hint}>Loading...</div>}
        {error && <div style={styles.hint}>Error: {error}</div>}
        {!loading && sessions.length === 0 && !error && <div style={styles.hint}>No sessions</div>}
        {sessions.map(s => {
          const previewText = (query && s.matchSnippet) ? s.matchSnippet : (s.preview || s.projectDisplay);
          const colorKey = s.projectDisplay || s.id;
          const itemKey = `${s.project}/${s.id}`;
          const isHovered = hovered === itemKey;
          const isOrphan = s.kind === 'orphan';
          const cwdLabel = s.cwd ? shortenPath(s.cwd) : null;
          return (
            <div
              key={itemKey}
              role="button"
              tabIndex={0}
              style={{ ...styles.item, ...(isHovered ? styles.itemHover : {}) }}
              onClick={() => openSession(s)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSession(s); } }}
              onMouseEnter={() => setHovered(itemKey)}
              onMouseLeave={() => setHovered(null)}
            >
              <Identicon seed={colorKey} size={40} />
              <div style={styles.body}>
                <div style={styles.row1}>
                  <span style={styles.title}>{renderHighlightedText(s.title, query)}</span>
                  <span style={styles.time}>{relativeTime(s.mtime)}</span>
                </div>
                <div style={styles.row2}>
                  <span style={styles.preview}>{renderHighlightedText(previewText, query)}</span>
                </div>
                <div style={styles.row3}>
                  {cwdLabel && (
                    <span style={styles.cwdChip} title={s.cwd}>
                      <FolderIcon size={10} />
                      <span style={styles.cwdText}>{cwdLabel}</span>
                    </span>
                  )}
                  {s.gitBranch && <span style={styles.branchChip}>{s.gitBranch}</span>}
                  {s.version && <span style={styles.versionChip} title={`Created with Claude Code ${s.version}`}>v{s.version}</span>}
                  {isOrphan && <span style={styles.orphanChip}>orphan</span>}
                  {s.messageCount > 0 && (
                    <span style={styles.msgChip} title={`${s.messageCount} message${s.messageCount > 1 ? 's' : ''}`}>
                      <MessageIcon size={10} />
                      {s.messageCount}
                    </span>
                  )}
                  {s.matchSnippets?.length > 0 && (
                    <button
                      type="button"
                      style={styles.matchesChip}
                      onClick={(e) => { e.stopPropagation(); toggleExpanded(itemKey); }}
                      title={`${s.matchSnippets.length} match${s.matchSnippets.length > 1 ? 'es' : ''}`}
                    >
                      {s.matchSnippets.length} {s.matchSnippets.length > 1 ? 'matches' : 'match'}
                    </button>
                  )}
                  <span style={styles.actionsSpacer} />
                  <OpenSessionCommand cwd={s.cwd} sessionId={s.id} />
                </div>
                {expandedRows.has(itemKey) && s.matchSnippets?.length > 0 && (
                  <div style={styles.snippetList} onClick={(e) => e.stopPropagation()}>
                    {s.matchSnippets.map((snip, i) => (
                      <div key={i} style={styles.snippetItem}>
                        <span style={styles.snippetSource}>{snip.source}</span>
                        <span style={styles.snippetText}>{renderHighlightedText(snip.text, query)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!loading && hasMore && <div ref={sentinelRef} style={styles.sentinel} />}
        {loadingMore && <div style={styles.hint}>Loading more...</div>}
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: color.bg, color: color.text },
  header: {
    padding: '14px 20px',
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: space.px5,
    background: color.surface,
  },
  logo: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: color.accent, letterSpacing: '-0.01em' },
  tagline: { fontSize: fontSize.sm, color: color.textMuted },
  headerSpacer: { flex: 1 },
  searchWrap: { padding: '10px 16px', borderBottom: `1px solid ${color.border}`, flexShrink: 0, background: color.surface },
  searchInner: {
    display: 'flex',
    alignItems: 'center',
    gap: space.px4,
    padding: '8px 14px',
    borderRadius: radius.lg,
    border: `1px solid ${color.border}`,
    background: color.bgAlt,
    transition: `border-color ${motion.fast}, background ${motion.fast}`,
  },
  searchIcon: { color: color.textMuted, display: 'inline-flex', alignItems: 'center' },
  search: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    color: color.text,
    fontSize: fontSize.md,
    outline: 'none',
    fontFamily: 'inherit',
  },
  list: { flex: 1, overflowY: 'auto' },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: space.px5,
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    borderBottom: `1px solid ${color.border}`,
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    transition: `background ${motion.fast}`,
    fontFamily: 'inherit',
    outline: 'none',
  },
  itemHover: { background: color.bgAlt },
  body: { flex: 1, minWidth: 0 },
  row1: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2, gap: space.px4 },
  row2: { marginBottom: 4 },
  row3: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 },
  time: { fontSize: fontSize.xs, color: color.textMuted, flexShrink: 0 },
  preview: { fontSize: fontSize.base, color: color.textMuted, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, wordBreak: 'break-word' },
  cwdChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 10,
    lineHeight: 1.4,
    color: color.textMuted,
    fontFamily: font.mono,
    background: color.bgAlt,
    border: `1px solid ${color.border}`,
    padding: '0 6px',
    borderRadius: radius.xs,
    maxWidth: 280,
    minWidth: 0,
  },
  cwdText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  branchChip: {
    fontSize: 10,
    lineHeight: 1.4,
    color: color.textMuted,
    background: color.bgAlt,
    border: `1px solid ${color.border}`,
    padding: '0 6px',
    borderRadius: radius.xs,
    fontFamily: font.mono,
    maxWidth: 140,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  versionChip: {
    fontSize: 10,
    lineHeight: 1.4,
    color: color.textMuted,
    background: color.bgAlt,
    border: `1px solid ${color.border}`,
    padding: '0 6px',
    borderRadius: radius.xs,
    fontFamily: font.mono,
    flexShrink: 0,
  },
  orphanChip: {
    fontSize: 10,
    lineHeight: 1.4,
    color: color.warning,
    background: 'transparent',
    border: `1px solid ${color.warning}`,
    padding: '0 6px',
    borderRadius: radius.pill,
    fontWeight: fontWeight.medium,
  },
  msgChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 10,
    lineHeight: 1.4,
    color: color.textMuted,
    background: color.bgAlt,
    border: `1px solid ${color.border}`,
    padding: '0 6px',
    borderRadius: radius.pill,
  },
  matchesChip: {
    fontSize: 10,
    lineHeight: 1.4,
    fontWeight: fontWeight.semibold,
    color: color.accent,
    background: color.accentBg,
    border: `1px solid ${color.accent}`,
    padding: '0 6px',
    borderRadius: radius.pill,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  snippetList: {
    marginTop: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '6px 8px',
    background: color.bgAlt,
    border: `1px solid ${color.border}`,
    borderRadius: radius.xs,
  },
  snippetItem: {
    display: 'flex',
    gap: space.px3,
    fontSize: fontSize.xs,
    lineHeight: 1.5,
    color: color.text,
  },
  snippetSource: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: color.textMuted,
    background: color.surface,
    border: `1px solid ${color.border}`,
    padding: '0 5px',
    borderRadius: radius.xs,
    height: 'fit-content',
    fontFamily: font.mono,
  },
  snippetText: {
    flex: 1,
    minWidth: 0,
    wordBreak: 'break-word',
    fontFamily: font.mono,
  },
  actionsSpacer: { flex: 1 },
  mark: { background: color.accentBg, color: color.accent, borderRadius: 3, padding: '0 2px', fontWeight: fontWeight.semibold },
  hint: { padding: 40, textAlign: 'center', color: color.textMuted, fontSize: fontSize.md },
  sentinel: { height: 1 },
};
