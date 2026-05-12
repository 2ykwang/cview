import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MessageBubble from '../components/MessageBubble';
import ExportBar from '../components/ExportBar';
import OpenSessionCommand from '../components/OpenSessionCommand';
import DateNavigator from '../components/DateNavigator';
import ThemeToggle from '../components/ThemeToggle';
import { useExport } from '../hooks/useExport';
import { processMessages, fmtDate, isSameDay } from '../utils/parseSession';
import { ArrowLeftIcon, FileIcon, FolderIcon, BotIcon } from '../components/Icon';
import { color, radius, space, fontSize, fontWeight, motion, font } from '../styles/tokens';

function senderKey(msg) {
  return msg.type === 'user' ? '__user__' : (msg.agentName || '__unknown__');
}

function breakGroup(a, b) {
  if (!a || !b) return true;
  if (senderKey(a) !== senderKey(b)) return true;
  return Math.abs(new Date(b.timestamp) - new Date(a.timestamp)) >= 60_000;
}

// For each `Agent` / `Task` tool_use in the master transcript, in order,
// consume the first un-used subagent with matching description (and
// agentType when given).
function matchSubagents(records, subagents) {
  if (!subagents?.length) return {};
  const remaining = subagents.map(s => ({ ...s, _used: false }));
  const map = {};
  for (const rec of records) {
    if (rec.type !== 'assistant' || !Array.isArray(rec.message?.content)) continue;
    for (const block of rec.message.content) {
      if (block.type !== 'tool_use') continue;
      if (block.name !== 'Agent' && block.name !== 'Task') continue;
      const desc = block.input?.description || null;
      const subType = block.input?.subagent_type || block.input?.name || null;
      let cand = remaining.find(s => !s._used && desc && s.description === desc && (!subType || s.agentType === subType));
      if (!cand) cand = remaining.find(s => !s._used && desc && s.description === desc);
      if (!cand) continue;
      cand._used = true;
      map[block.id] = { agentId: cand.agentId, agentType: cand.agentType, description: cand.description };
    }
  }
  return map;
}

function shortenPath(p) {
  if (!p) return '';
  return p.replace(/^\/Users\/[^/]+/, '~');
}

export default function Messenger() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const project = searchParams.get('project');
  const sessionId = searchParams.get('sessionId');
  const isTranscript = searchParams.get('transcript') === '1';

  const [messages, setMessages] = useState([]);
  const [subagents, setSubagents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const messageListRef = useRef(null);

  const msgIds = useMemo(() => messages.map((m, i) => m.uuid || `msg-${i}`), [messages]);
  const { captureMode, selected, handleMsgClick, startCapture, cancelCapture, exportHTML, saveCapture } = useExport(messageListRef, msgIds);

  useEffect(() => {
    if (!sessionId || isTranscript || !project) { setSubagents([]); return; }
    fetch(`/api/projects/${encodeURIComponent(project)}/sessions/${encodeURIComponent(sessionId)}/subagents`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSubagents(Array.isArray(data) ? data : []))
      .catch(() => setSubagents([]));
  }, [sessionId, project, isTranscript]);

  useEffect(() => {
    if (!sessionId) return;
    const url = isTranscript
      ? `/api/transcripts/${encodeURIComponent(sessionId)}/stream`
      : `/api/projects/${encodeURIComponent(project)}/sessions/${encodeURIComponent(sessionId)}/stream`;

    const es = new EventSource(url);
    es.onmessage = (e) => {
      try { setMessages(processMessages(JSON.parse(e.data))); }
      catch { setError('Invalid stream payload'); }
      setLoading(false);
    };
    es.onerror = () => {
      setError('Stream connection error');
      setLoading(false);
      es.close();
    };
    return () => es.close();
  }, [sessionId, project, isTranscript]);

  useEffect(() => {
    if (!captureMode) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, captureMode]);

  const matchedSubagents = useMemo(() => matchSubagents(messages, subagents), [messages, subagents]);
  const agentContext = useMemo(() => ({
    project,
    masterSessionId: sessionId,
    matchedSubagents,
  }), [project, sessionId, matchedSubagents]);

  const cwd = useMemo(() => messages.find(m => m.cwd)?.cwd || null, [messages]);
  const gitBranch = useMemo(() => messages.find(m => m.gitBranch)?.gitBranch || null, [messages]);
  const subagentCount = subagents.length;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/')} title="Back to sessions">
          <ArrowLeftIcon size={13} />
          <span>Back</span>
        </button>
        <div style={s.headerInfo}>
          <div style={s.titleRow}>
            <span style={s.sessionIcon}>{isTranscript ? <FileIcon size={14} /> : <FolderIcon size={14} />}</span>
            <span style={s.titleText}>{isTranscript ? 'Transcript' : (cwd ? shortenPath(cwd).split('/').pop() : decodeURIComponent(project || ''))}</span>
            {gitBranch && <span style={s.branchBadge}>{gitBranch}</span>}
            {subagentCount > 0 && (
              <span style={s.subBadge} title={`${subagentCount} subagent run${subagentCount > 1 ? 's' : ''}`}>
                <BotIcon size={11} />
                {subagentCount}
              </span>
            )}
          </div>
          {cwd && (
            <div style={s.subRow}>
              <span style={s.cwdText} title={cwd}>{shortenPath(cwd)}</span>
              <span style={s.dot}>·</span>
              <span style={s.countInline}>{messages.length} msgs</span>
            </div>
          )}
          {!cwd && <div style={s.subRow}><span style={s.countInline}>{messages.length} msgs</span></div>}
        </div>
        <div style={s.toolbar} role="toolbar" aria-label="Session actions">
          {!isTranscript && <OpenSessionCommand cwd={cwd} sessionId={sessionId} />}
          <ExportBar
            onExportHTML={exportHTML}
            captureMode={captureMode}
            onStartCapture={startCapture}
            onCancelCapture={cancelCapture}
            selectedCount={selected.size}
            onSavePng={() => saveCapture('png')}
            onSaveJpg={() => saveCapture('jpg')}
          />
          <ThemeToggle />
        </div>
      </div>

      {captureMode && (
        <div style={s.captureBanner}>
          Click to select · Shift+click to select range · Save as PNG or JPG
        </div>
      )}

      <DateNavigator messages={messages} msgIds={msgIds} scrollRoot={messageListRef} />

      <div style={s.messageList} ref={messageListRef}>
        {loading && <div style={s.hint}>Loading session...</div>}
        {error && <div style={s.error}>Error: {error}</div>}
        {!loading && messages.length === 0 && !error && <div style={s.hint}>No messages</div>}
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const showDate = !prev || !isSameDay(prev.timestamp, msg.timestamp);
          const isFirst = breakGroup(prev, msg);
          const isLast = breakGroup(msg, next);
          const msgId = msgIds[i];
          const isSelected = captureMode && selected.has(msgId);

          return (
            <div key={msgId}>
              {showDate && (
                <div style={s.dateSep}>
                  <div style={s.dateLine} />
                  <span style={s.dateLabel}>{fmtDate(msg.timestamp)}</span>
                  <div style={s.dateLine} />
                </div>
              )}
              <div
                data-msg-id={msgId}
                onClick={captureMode ? (e) => handleMsgClick(msgId, e) : undefined}
                style={captureMode ? { ...s.captureWrapper, background: isSelected ? color.accentBg : 'transparent' } : null}
              >
                <MessageBubble record={msg} isFirst={isFirst} isLast={isLast} agentContext={agentContext} />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

const s = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: color.bg },
  header: {
    display: 'flex', alignItems: 'center', gap: space.px5,
    padding: '10px 16px',
    background: color.surface,
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
  },
  backBtn: {
    padding: '6px 12px',
    borderRadius: radius.sm,
    border: `1px solid ${color.border}`,
    background: 'transparent',
    color: color.textDim,
    cursor: 'pointer',
    fontSize: fontSize.base,
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.px3,
    transition: `border-color ${motion.fast}, color ${motion.fast}, background ${motion.fast}`,
  },
  headerInfo: { flex: 1, minWidth: 0 },
  titleRow: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: color.text, display: 'flex', alignItems: 'center', gap: space.px3, minWidth: 0 },
  titleText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sessionIcon: { color: color.textMuted, display: 'inline-flex', alignItems: 'center', flexShrink: 0 },
  subRow: { display: 'flex', gap: space.px3, alignItems: 'center', marginTop: 2, fontSize: fontSize.xs, color: color.textMuted, minWidth: 0 },
  cwdText: { fontFamily: font.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  dot: { color: color.textFaint, flexShrink: 0 },
  countInline: { flexShrink: 0 },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  branchBadge: {
    fontSize: fontSize.xs,
    color: color.textMuted,
    background: color.bgAlt,
    border: `1px solid ${color.border}`,
    padding: '1px 7px',
    borderRadius: radius.xs,
    fontFamily: font.mono,
    fontWeight: fontWeight.medium,
    flexShrink: 0,
  },
  subBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: color.accent,
    background: color.accentBg,
    border: `1px solid ${color.accent}`,
    padding: '1px 7px',
    borderRadius: radius.pill,
    flexShrink: 0,
  },
  count: { fontSize: fontSize.sm, color: color.textMuted, whiteSpace: 'nowrap' },
  captureBanner: { padding: '6px 16px', background: color.accentBg, borderBottom: `1px solid ${color.border}`, fontSize: fontSize.sm, color: color.accent, textAlign: 'center', flexShrink: 0 },
  messageList: { flex: 1, overflowY: 'auto', padding: '20px 16px' },
  dateSep: { display: 'flex', alignItems: 'center', gap: space.px5, margin: '20px 0 12px' },
  dateLine: { flex: 1, height: 1, background: color.border },
  dateLabel: {
    padding: '2px 12px',
    borderRadius: radius.lg,
    background: color.surface,
    color: color.textMuted,
    fontSize: fontSize.sm,
    border: `1px solid ${color.border}`,
    whiteSpace: 'nowrap',
  },
  captureWrapper: { borderRadius: radius.md, cursor: 'pointer', transition: `background ${motion.fast}`, userSelect: 'none' },
  hint: { color: color.textMuted, textAlign: 'center', padding: 40 },
  error: { background: color.diffDelBg, color: color.diffDelFg, padding: 12, borderRadius: radius.md, border: `1px solid ${color.danger}` },
};
