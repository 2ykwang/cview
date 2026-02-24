import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TeamChatItem from '../components/TeamChatItem';

const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#F87171'];
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

function avatarColor(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
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

export default function SessionSelect() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextOffset, setNextOffset] = useState(0);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [hovered, setHovered] = useState(null);
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
        excludeTeamSessions: '1',
      });
      if (debouncedQuery) params.set('q', debouncedQuery);

      const response = await fetch(`/api/sessions?${params.toString()}`);
      if (!response.ok) throw new Error(`Failed to load sessions (${response.status})`);
      const data = await response.json();
      if (!isCurrentRequest()) return;

      const items = Array.isArray(data)
        ? data.filter(s => !s.teamName)
        : (Array.isArray(data.items) ? data.items : []);
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
    fetch('/api/teams')
      .then(r => r.json())
      .then(data => setTeams(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

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
    navigate(`/session?${params.toString()}`);
  };

  const openTeam = (teamName) => {
    navigate(`/team?name=${encodeURIComponent(teamName)}`);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.logo}>Claude Chatview</span>
      </div>
      <div style={styles.searchWrap}>
        <input
          style={styles.search}
          placeholder="Search sessions..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      <div style={styles.list} ref={listRef}>
        {teams.length > 0 && (
          <>
            <div style={styles.sectionLabel}>Team Chats</div>
            {teams.map(team => (
              <TeamChatItem
                key={team.teamName}
                team={team}
                onClick={() => openTeam(team.teamName)}
                isHovered={hovered === `team:${team.teamName}`}
                onMouseEnter={() => setHovered(`team:${team.teamName}`)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
            <div style={styles.sectionLabel}>Individual Sessions</div>
          </>
        )}
        {loading && <div style={styles.hint}>Loading...</div>}
        {error && <div style={styles.hint}>Error: {error}</div>}
        {!loading && sessions.length === 0 && !error && <div style={styles.hint}>No sessions</div>}
        {sessions.map(s => {
          const previewText = (query && s.matchSnippet) ? s.matchSnippet : (s.preview || s.projectDisplay);
          const colorKey = s.agentName || s.projectDisplay || s.id;
          const bg = avatarColor(colorKey);
          const initial = (s.agentName || s.projectDisplay || '?')[0].toUpperCase();
          const itemKey = `${s.project}/${s.id}`;
          const isHovered = hovered === itemKey;
          return (
            <button
              key={itemKey}
              style={{ ...styles.item, ...(isHovered ? styles.itemHover : {}) }}
              onClick={() => openSession(s)}
              onMouseEnter={() => setHovered(itemKey)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{ ...styles.avatar, background: bg }}>{initial}</div>
              <div style={styles.body}>
                <div style={styles.row1}>
                  <span style={styles.title}>{renderHighlightedText(s.title, query)}</span>
                  <span style={styles.time}>{relativeTime(s.mtime)}</span>
                </div>
                <div style={styles.preview}>{renderHighlightedText(previewText, query)}</div>
              </div>
            </button>
          );
        })}
        {!loading && hasMore && <div ref={sentinelRef} style={styles.sentinel} />}
        {loadingMore && <div style={styles.hint}>Loading more...</div>}
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#17212b', color: '#e8e8e8' },
  header: { padding: '16px 20px', borderBottom: '1px solid #293340', flexShrink: 0 },
  logo: { fontSize: '18px', fontWeight: '700', color: '#5ab3ef' },
  searchWrap: { padding: '10px 16px', borderBottom: '1px solid #293340', flexShrink: 0 },
  search: { width: '100%', padding: '8px 14px', borderRadius: '20px', border: '1px solid #293340', background: '#1c2733', color: '#e8e8e8', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  list: { flex: 1, overflowY: 'auto' },
  item: { display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 16px', border: 'none', borderBottom: '1px solid #1c2733', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' },
  itemHover: { background: '#1f2936' },
  avatar: { width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px', fontWeight: '700', flexShrink: 0 },
  body: { flex: 1, minWidth: 0 },
  row1: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' },
  title: { fontSize: '15px', fontWeight: '600', color: '#e8e8e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  time: { fontSize: '12px', color: '#6c7883', marginLeft: '8px', flexShrink: 0 },
  preview: { fontSize: '13px', color: '#6c7883', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  mark: { background: '#facc15', color: '#111827', borderRadius: '3px', padding: '0 1px' },
  hint: { padding: '40px', textAlign: 'center', color: '#6c7883', fontSize: '14px' },
  sectionLabel: { padding: '8px 16px 4px', fontSize: '11px', fontWeight: '600', color: '#6c7883', textTransform: 'uppercase', letterSpacing: '0.08em' },
  sentinel: { height: '1px' },
};
