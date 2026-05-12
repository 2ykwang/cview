import { useState, useEffect, useRef, useCallback } from 'react';
import { ClipboardIcon } from './Icon';
import { color, radius, space, fontSize, fontWeight, motion, font, shadow } from '../styles/tokens';

function TerminalIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

export function buildOpenCommand(cwd, sessionId) {
  if (!sessionId) return '';
  if (cwd) return `cd "${cwd}" && claude --resume ${sessionId}`;
  return `claude --resume ${sessionId}`;
}

// Icon button → click reveals a popover with the draggable command + copy.
// `align` controls which side the popover anchors to (right by default,
// since this lives in the upper-right of headers / rows).
export default function OpenSessionCommand({ cwd, sessionId, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const command = buildOpenCommand(cwd, sessionId);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    const t = setTimeout(() => inputRef.current?.select(), 0);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      clearTimeout(t);
    };
  }, [open]);

  const handleCopy = useCallback(async (e) => {
    e.stopPropagation();
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      const ta = inputRef.current;
      if (ta) { ta.select(); try { document.execCommand('copy'); } catch { /* ignore */ } }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }, [command]);

  const stopAnd = useCallback((fn) => (e) => { e.stopPropagation(); fn?.(e); }, []);

  if (!command) return null;

  const popoverStyle = align === 'left'
    ? { ...s.popover, left: 0 }
    : { ...s.popover, right: 0 };

  return (
    <div style={s.container} ref={containerRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ ...s.iconBtn, ...(open ? s.iconBtnActive : {}) }}
        title="Open this session in terminal"
        aria-label="Show command to open this session"
        aria-expanded={open}
      >
        <TerminalIcon size={14} />
      </button>
      {open && (
        <div style={popoverStyle} role="dialog" aria-label="Open command">
          <div style={s.row}>
            <span style={s.prompt}>$</span>
            <input
              ref={inputRef}
              type="text"
              readOnly
              value={command}
              style={s.input}
              onClick={(e) => e.currentTarget.select()}
              onKeyDown={stopAnd()}
            />
            <button type="button" onClick={handleCopy} style={s.copyBtn} title="Copy to clipboard">
              <ClipboardIcon size={12} />
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div style={s.hint}>Paste in a terminal to resume this session.</div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { position: 'relative', display: 'inline-flex', flexShrink: 0 },
  iconBtn: {
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    border: `1px solid ${color.border}`,
    background: 'transparent',
    color: color.textDim,
    cursor: 'pointer',
    padding: 0,
    transition: `color ${motion.fast}, border-color ${motion.fast}, background ${motion.fast}`,
  },
  iconBtnActive: {
    color: color.accent,
    borderColor: color.accent,
    background: color.accentBg,
  },
  popover: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    minWidth: 360,
    maxWidth: 'min(560px, 90vw)',
    padding: 10,
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    boxShadow: shadow.sm,
    zIndex: 50,
  },
  row: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  prompt: { color: color.textMuted, fontFamily: font.mono, fontSize: fontSize.sm, fontWeight: fontWeight.bold, flexShrink: 0 },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '6px 9px',
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    background: color.bgAlt,
    color: color.text,
    fontFamily: font.mono,
    fontSize: fontSize.sm,
    outline: 'none',
  },
  copyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    border: `1px solid ${color.accent}`,
    borderRadius: radius.sm,
    background: color.accent,
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: 'inherit',
    flexShrink: 0,
    transition: `background ${motion.fast}`,
  },
  hint: { marginTop: 6, fontSize: fontSize.xs, color: color.textMuted },
};
