import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Avatar, { getAvatarColor } from '../components/Avatar';
import ToolCard, { MessageContent } from '../components/ToolCard';
import ExportBar from '../components/ExportBar';
import { useExport } from '../hooks/useExport';
import { fmtTime, fmtDate, isSameDay, fmtModel, hasRenderableAssistantContent } from '../utils/parseSession';
import { ArrowLeftIcon } from '../components/Icon';
import MarkdownRenderer from '../components/MarkdownRenderer';

const HIDDEN_TYPES = new Set(['user', 'teammate_incoming', 'idle_notification', 'progress', 'system', 'file-history-snapshot', 'queue-operation']);
const USER_INPUT_TYPE = 'user_input';

function senderKey(msg) {
  return msg.type === USER_INPUT_TYPE ? '__user__' : (msg.agentName || '__unknown__');
}

function breakGroup(a, b) {
  if (!a || !b) return true;
  if (senderKey(a) !== senderKey(b)) return true;
  return Math.abs(new Date(b.timestamp) - new Date(a.timestamp)) >= 60_000;
}

export default function TeamTimeline() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const teamName = searchParams.get('name');

  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const messageListRef = useRef(null);

  const msgIds = messages.map((m, i) => m.uuid || `${m.sessionId}-${i}`);
  const { captureMode, selected, handleMsgClick, startCapture, cancelCapture, exportHTML, saveCapture } = useExport(messageListRef, msgIds);

  useEffect(() => {
    if (!teamName) return;
    setLoading(true);
    setError(null);

    fetch('/api/teams')
      .then(r => r.json())
      .then(teams => {
        const team = teams.find(t => t.teamName === teamName);
        if (team) setMembers(team.members || []);
      })
      .catch(() => {});

    const es = new EventSource(`/api/teams/${encodeURIComponent(teamName)}/timeline/stream`);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const msgs = Array.isArray(data) ? data : (data.messages || []);
        setMessages(msgs.filter(m => {
          if (HIDDEN_TYPES.has(m.type)) return false;
          if (m.type === USER_INPUT_TYPE) {
            const text = typeof m.message?.content === 'string' ? m.message.content.trim() : '';
            if (!text) return false;
          } else if (m.type === 'assistant') {
            if (!hasRenderableAssistantContent(m.message?.content)) return false;
          }
          return true;
        }));
        setLoading(false);
      } catch {
        setError('Invalid stream payload');
        setLoading(false);
      }
    };
    es.onerror = () => {
      setError('Stream connection error');
      setLoading(false);
      es.close();
    };

    return () => es.close();
  }, [teamName]);

  useEffect(() => {
    if (!captureMode) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, captureMode]);

  const memberLabel = members.slice(0, 3).join(' · ') + (members.length > 3 ? ` +${members.length - 3} more` : '');

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/')}>
          <ArrowLeftIcon size={13} />
          <span>Back</span>
        </button>
        <div style={s.headerInfo}>
          <div style={s.teamName}>{teamName}</div>
          <div style={s.memberList}>{memberLabel}</div>
        </div>
        <ExportBar
          onExportHTML={exportHTML}
          captureMode={captureMode}
          onStartCapture={startCapture}
          onCancelCapture={cancelCapture}
          selectedCount={selected.size}
          onSavePng={() => saveCapture('png')}
          onSaveJpg={() => saveCapture('jpg')}
        />
      </div>

      {captureMode && (
        <div style={s.captureBanner}>
          Click to select · Shift+click to select range · Save as PNG or JPG
        </div>
      )}

      <div style={s.messageList} ref={messageListRef}>
        {loading && <div style={s.hint}>Loading timeline...</div>}
        {error && <div style={s.error}>Error: {error}</div>}
        {!loading && messages.length === 0 && !error && (
          <div style={s.hint}>No messages</div>
        )}
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const showDate = !prev || !isSameDay(prev.timestamp, msg.timestamp);
          const isFirst = breakGroup(prev, msg);
          const isLast = breakGroup(msg, next);
          const isUser = msg.type === USER_INPUT_TYPE;
          const msgId = msg.uuid || `${msg.sessionId}-${i}`;
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
                style={captureMode ? { ...s.captureWrapper, background: isSelected ? 'rgba(90,179,239,0.13)' : 'transparent' } : {}}
              >
              {isUser ? (
                /* User message — right-aligned */
                <div style={{ ...s.userRow, marginBottom: isLast ? 16 : 3 }}>
                  <div
                    className={isLast ? 'bubble-out' : ''}
                    style={s.userBubble}
                  >
                    {msg.agentName && msg.agentName !== 'team-lead' && (
                      <div style={s.userTo}>→ <span style={{ color: getAvatarColor(msg.agentName), fontWeight: '700' }}>@{msg.agentName}</span></div>
                    )}
                    <MarkdownRenderer
                      style={s.mdWrap}
                      text={typeof msg.message?.content === 'string' ? msg.message.content : ''}
                    />
                    <div style={s.bubbleMeta}>
                      <span style={s.bubbleTime}>{fmtTime(msg.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Agent message — left-aligned */
                <div style={{ ...s.msgRow, marginBottom: isLast ? 16 : 3 }}>
                  <div style={s.avatarCol}>
                    {isFirst ? <Avatar agentName={msg.agentName} size={32} /> : <div style={s.avatarSpacer} />}
                  </div>
                  <div style={s.msgBody}>
                    {isFirst && (
                      <div style={s.agentNameRow}>
                        <span style={s.agentName}>{msg.agentName}</span>
                        {msg.message?.model && <span style={s.modelTag}>({fmtModel(msg.message.model)})</span>}
                      </div>
                    )}
                    <div
                      className={isLast ? 'bubble-in' : ''}
                      style={s.bubble}
                    >
                      <MessageContent content={msg.message?.content} />
                      <div style={s.bubbleMeta}>
                        <span style={s.bubbleTime}>{fmtTime(msg.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#17212b' },
  header: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 20px',
    background: '#1c2733',
    borderBottom: '1px solid #293340', flexShrink: 0,
  },
  backBtn: { padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#5ab3ef', cursor: 'pointer', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  headerInfo: { flex: 1, minWidth: 0 },
  teamName: { fontSize: '15px', fontWeight: '700', color: '#e8e8e8' },
  memberList: { fontSize: '12px', color: '#6c7883' },
  messageList: { flex: 1, overflowY: 'auto', padding: '20px 16px' },
  dateSep: { display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0 12px' },
  dateLine: { flex: 1, height: '1px', background: '#293340' },
  dateLabel: { padding: '2px 12px', borderRadius: '12px', background: '#17212b', color: '#6c7883', fontSize: '12px', border: '1px solid #293340', whiteSpace: 'nowrap' },
  /* Agent message */
  msgRow: { display: 'flex', gap: '8px', alignItems: 'flex-start' },
  avatarCol: { flexShrink: 0, width: 32 },
  avatarSpacer: { width: 32, height: 32 },
  msgBody: { flex: 1, minWidth: 0, maxWidth: '75%' },
  agentNameRow: { display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '3px', paddingLeft: '2px' },
  agentName: { fontSize: '13px', fontWeight: '600', color: '#5ab3ef' },
  modelTag: { fontSize: '11px', color: '#6c7883', fontWeight: '400' },
  bubble: { background: '#232e3c', borderRadius: '6px 18px 18px 18px', padding: '8px 12px', minWidth: 0, overflow: 'hidden' },
  /* User message */
  userRow: { display: 'flex', justifyContent: 'flex-end' },
  userBubble: { maxWidth: '75%', background: '#2b5278', borderRadius: '18px 6px 18px 18px', padding: '8px 12px' },
  userTo: { fontSize: '11px', color: '#aab2ba', marginBottom: '3px', fontWeight: '600' },
  /* Common */
  mdWrap: { color: '#e8e8e8', fontSize: '14px', lineHeight: '1.65', wordBreak: 'break-word', overflowX: 'auto' },
  bubbleMeta: { display: 'flex', justifyContent: 'flex-end', marginTop: '3px' },
  bubbleTime: { fontSize: '11px', color: '#6c7883' },
  captureBanner: { padding: '6px 16px', background: '#1c2d3e', borderBottom: '1px solid #293340', fontSize: '12px', color: '#5ab3ef', textAlign: 'center', flexShrink: 0 },
  captureWrapper: { borderRadius: '8px', cursor: 'pointer', transition: 'background 0.1s', userSelect: 'none' },
  hint: { color: '#6c7883', textAlign: 'center', padding: '40px' },
  error: { background: '#2d1515', color: '#f87171', padding: '12px', borderRadius: '8px' },
};
