import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MessageBubble from '../components/MessageBubble';
import ExportBar from '../components/ExportBar';
import { useExport } from '../hooks/useExport';
import { processMessages, fmtDate, isSameDay } from '../utils/parseSession';
import { ArrowLeftIcon, FileIcon, FolderIcon } from '../components/Icon';

function senderKey(msg) {
  return msg.type === 'user' ? '__user__' : (msg.agentName || '__unknown__');
}

function breakGroup(a, b) {
  if (!a || !b) return true;
  if (senderKey(a) !== senderKey(b)) return true;
  return Math.abs(new Date(b.timestamp) - new Date(a.timestamp)) >= 60_000;
}

export default function Messenger() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const project = searchParams.get('project');
  const sessionId = searchParams.get('sessionId');
  const isTranscript = searchParams.get('transcript') === '1';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const messageListRef = useRef(null);

  const msgIds = messages.map((m, i) => m.uuid || `msg-${i}`);
  const { captureMode, selected, handleMsgClick, startCapture, cancelCapture, exportHTML, saveCapture } = useExport(messageListRef, msgIds);

  useEffect(() => {
    if (!sessionId) return;
    const url = isTranscript
      ? `/api/transcripts/${encodeURIComponent(sessionId)}/stream`
      : `/api/projects/${encodeURIComponent(project)}/sessions/${encodeURIComponent(sessionId)}/stream`;

    const es = new EventSource(url);
    es.onmessage = (e) => {
      setMessages(processMessages(JSON.parse(e.data)));
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

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/')}>
          <ArrowLeftIcon size={13} />
          <span>Back</span>
        </button>
        <div style={s.headerInfo}>
          <div style={s.sessionTitle}>
            <span style={s.sessionIcon}>{isTranscript ? <FileIcon size={14} /> : <FolderIcon size={14} />}</span>
            <span>{isTranscript ? 'Transcript' : decodeURIComponent(project || '')}</span>
          </div>
          <div style={s.sessionId}>{sessionId}</div>
        </div>
        <div style={s.count}>{messages.length} msgs</div>
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
        {loading && <div style={s.hint}>Loading session...</div>}
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
          const msgId = msg.uuid || `msg-${i}`;
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
                <MessageBubble record={msg} isFirst={isFirst} isLast={isLast} />
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
  backBtn: { padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#5ab3ef', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  headerInfo: { flex: 1, minWidth: 0 },
  sessionTitle: { fontSize: '15px', fontWeight: '700', color: '#e8e8e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' },
  sessionIcon: { color: '#8ca0b3', display: 'inline-flex', alignItems: 'center', flexShrink: 0 },
  sessionId: { fontSize: '11px', color: '#6c7883', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  count: { fontSize: '12px', color: '#6c7883', whiteSpace: 'nowrap' },
  captureBanner: { padding: '6px 16px', background: '#1c2d3e', borderBottom: '1px solid #293340', fontSize: '12px', color: '#5ab3ef', textAlign: 'center', flexShrink: 0 },
  messageList: { flex: 1, overflowY: 'auto', padding: '20px 16px' },
  dateSep: { display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0 12px' },
  dateLine: { flex: 1, height: '1px', background: '#293340' },
  dateLabel: { padding: '2px 12px', borderRadius: '12px', background: '#17212b', color: '#6c7883', fontSize: '12px', border: '1px solid #293340', whiteSpace: 'nowrap' },
  captureWrapper: { borderRadius: '8px', cursor: 'pointer', transition: 'background 0.1s', userSelect: 'none' },
  hint: { color: '#6c7883', textAlign: 'center', padding: '40px' },
  error: { background: '#2d1515', color: '#f87171', padding: '12px', borderRadius: '8px' },
};
