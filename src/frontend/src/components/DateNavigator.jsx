import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { color, radius, space, fontSize, fontWeight, motion } from '../styles/tokens';

function fmtDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (sameDay(d, today)) return `Today ${time}`;
  if (sameDay(d, yesterday)) return `Yesterday ${time}`;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Mark positions where the calendar date changes — small dots on the track.
function extractDayMarkers(messages) {
  const out = [];
  let lastKey = null;
  for (let i = 0; i < messages.length; i++) {
    const ts = messages[i]?.timestamp;
    if (!ts) continue;
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (key !== lastKey) {
      out.push({ index: i, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
      lastKey = key;
    }
  }
  return out;
}

export default function DateNavigator({ messages, msgIds, scrollRoot }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const trackRef = useRef(null);

  const markers = useMemo(() => extractDayMarkers(messages), [messages]);

  // Track scroll → which message is at the top of the viewport.
  useEffect(() => {
    const root = scrollRoot?.current;
    if (!root || messages.length === 0) return;

    const updateActive = () => {
      if (draggingRef.current) return;
      const rootTop = root.getBoundingClientRect().top;
      const elements = root.querySelectorAll('[data-msg-id]');
      let chosen = 0;
      for (let i = 0; i < elements.length; i++) {
        const rect = elements[i].getBoundingClientRect();
        if (rect.bottom >= rootTop + 40) { chosen = i; break; }
        if (i === elements.length - 1) chosen = i;
      }
      setActiveIdx(chosen);
    };

    root.addEventListener('scroll', updateActive, { passive: true });
    updateActive();
    return () => root.removeEventListener('scroll', updateActive);
  }, [messages.length, scrollRoot]);

  const seekToIndex = useCallback((idx) => {
    const root = scrollRoot?.current;
    if (!root || !msgIds.length) return;
    const clamped = Math.max(0, Math.min(msgIds.length - 1, Math.round(idx)));
    const id = msgIds[clamped];
    const target = root.querySelector(`[data-msg-id="${CSS.escape(id)}"]`);
    if (target) target.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [msgIds, scrollRoot]);

  const pointToIndex = useCallback((clientX) => {
    const track = trackRef.current;
    if (!track || messages.length === 0) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * (messages.length - 1));
  }, [messages.length]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    const idx = pointToIndex(e.clientX);
    setActiveIdx(idx);
    seekToIndex(idx);

    const onMove = (ev) => {
      if (!draggingRef.current) return;
      const i = pointToIndex(ev.clientX);
      setActiveIdx(i);
      seekToIndex(i);
    };
    const onUp = () => {
      draggingRef.current = false;
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [pointToIndex, seekToIndex]);

  const handleKeyDown = useCallback((e) => {
    let step = 0;
    if (e.key === 'ArrowLeft') step = -1;
    else if (e.key === 'ArrowRight') step = 1;
    else if (e.key === 'PageUp') step = -10;
    else if (e.key === 'PageDown') step = 10;
    else if (e.key === 'Home') { setActiveIdx(0); seekToIndex(0); e.preventDefault(); return; }
    else if (e.key === 'End') { const last = messages.length - 1; setActiveIdx(last); seekToIndex(last); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    setActiveIdx((idx) => {
      const next = Math.max(0, Math.min(messages.length - 1, idx + step));
      seekToIndex(next);
      return next;
    });
  }, [messages.length, seekToIndex]);

  if (messages.length < 2) return null;

  const total = messages.length - 1;
  const progress = total > 0 ? activeIdx / total : 0;
  const currentMsg = messages[activeIdx];
  const firstMsg = messages[0];
  const lastMsg = messages[messages.length - 1];

  return (
    <div style={s.wrapper} aria-label="Conversation timeline">
      <div style={s.labels}>
        <span style={s.edgeLabel}>{fmtDateTime(firstMsg?.timestamp)}</span>
        <span style={s.activeLabel}>
          {fmtDateTime(currentMsg?.timestamp)}
          <span style={s.activeCount}>{activeIdx + 1} / {messages.length}</span>
        </span>
        <span style={s.edgeLabel}>{fmtDateTime(lastMsg?.timestamp)}</span>
      </div>
      <div
        ref={trackRef}
        style={s.track}
        onPointerDown={handlePointerDown}
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={messages.length - 1}
        aria-valuenow={activeIdx}
        aria-valuetext={fmtDateTime(currentMsg?.timestamp)}
        onKeyDown={handleKeyDown}
      >
        <div style={{ ...s.trackFill, width: `${progress * 100}%` }} />
        {markers.map((m) => {
          const left = total > 0 ? (m.index / total) * 100 : 0;
          return (
            <div key={`m-${m.index}`} style={{ ...s.dayMark, left: `${left}%` }} title={m.label} />
          );
        })}
        <div
          style={{
            ...s.handle,
            left: `${progress * 100}%`,
            transform: dragging ? 'translate(-50%, -50%) scale(1.1)' : 'translate(-50%, -50%)',
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

const s = {
  wrapper: {
    padding: '8px 16px 10px',
    background: color.surface,
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
    userSelect: 'none',
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    fontSize: fontSize.xs,
    color: color.textMuted,
    gap: space.px4,
  },
  edgeLabel: { fontVariantNumeric: 'tabular-nums' },
  activeLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: color.text,
    fontWeight: fontWeight.semibold,
    fontVariantNumeric: 'tabular-nums',
  },
  activeCount: {
    fontSize: 10,
    fontWeight: fontWeight.medium,
    color: color.textMuted,
    background: color.bgAlt,
    border: `1px solid ${color.border}`,
    padding: '0 6px',
    borderRadius: radius.pill,
  },
  track: {
    position: 'relative',
    height: 6,
    borderRadius: radius.pill,
    background: color.surface3,
    cursor: 'pointer',
    touchAction: 'none',
    outline: 'none',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    background: color.accent,
    borderRadius: radius.pill,
    transition: `width 60ms linear`,
  },
  handle: {
    position: 'absolute',
    top: '50%',
    width: 14,
    height: 14,
    background: color.accent,
    border: `2px solid ${color.surface}`,
    borderRadius: '50%',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.18)',
    transition: `transform ${motion.fast}`,
  },
  dayMark: {
    position: 'absolute',
    top: '50%',
    width: 2,
    height: 10,
    transform: 'translate(-50%, -50%)',
    background: color.textFaint,
    borderRadius: 1,
    pointerEvents: 'none',
  },
};
