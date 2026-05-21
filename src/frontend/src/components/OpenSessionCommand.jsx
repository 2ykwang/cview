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

// `claude --permission-mode` choices. "default" emits no flag.
const PERMISSION_MODES = ['default', 'plan', 'acceptEdits', 'dontAsk', 'auto', 'bypassPermissions'];

// One-line help shown when a row's `?` button is clicked.
const OPTION_HELP = {
  fork: 'Resume into a new session instead of continuing the original one. Your original conversation is kept unchanged.',
  permission: 'Permission mode for the session. "plan" is read-only; "bypassPermissions" skips every check.',
  skip: 'Bypass ALL permission checks for the whole session. Use only in trusted, sandboxed directories.',
};

export function buildOpenCommand(cwd, sessionId, opts = {}) {
  if (!sessionId) return '';
  const flags = [];
  if (opts.forkSession) flags.push('--fork-session');
  // --dangerously-skip-permissions and --permission-mode overlap, so only
  // one is ever emitted (the UI keeps them mutually exclusive).
  if (opts.skipPermissions) {
    flags.push('--dangerously-skip-permissions');
  } else if (opts.permissionMode && opts.permissionMode !== 'default') {
    flags.push(`--permission-mode ${opts.permissionMode}`);
  }
  const tail = flags.length ? ` ${flags.join(' ')}` : '';
  const base = `claude --resume ${sessionId}${tail}`;
  return cwd ? `cd "${cwd}" && ${base}` : base;
}

// One option line: a control on the left, a `?` toggle on the right that
// reveals an inline help blurb below the row.
function OptionRow({ tipKey, openTip, setOpenTip, children }) {
  const tipOpen = openTip === tipKey;
  return (
    <div>
      <div style={s.optRow}>
        <div style={s.optMain}>{children}</div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpenTip(tipOpen ? null : tipKey); }}
          style={{ ...s.helpBtn, ...(tipOpen ? s.helpBtnActive : {}) }}
          title="What is this?"
          aria-label="Explain this option"
          aria-expanded={tipOpen}
        >
          ?
        </button>
      </div>
      {tipOpen && <div style={s.tip}>{OPTION_HELP[tipKey]}</div>}
    </div>
  );
}

// Icon button → click reveals a popover with the draggable command + copy.
// `align` controls which side the popover anchors to (right by default,
// since this lives in the upper-right of headers / rows).
export default function OpenSessionCommand({ cwd, sessionId, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [forkSession, setForkSession] = useState(false);
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [permissionMode, setPermissionMode] = useState('default');
  const [openTip, setOpenTip] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const command = buildOpenCommand(cwd, sessionId, { forkSession, skipPermissions, permissionMode });

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

  // --permission-mode and --dangerously-skip-permissions overlap. Keep the
  // two controls mutually exclusive: a non-default mode disables the skip
  // checkbox, and a checked skip disables the mode dropdown.
  const modeActive = permissionMode !== 'default';

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

          <div style={s.divider} />

          <div style={s.options}>
            <OptionRow tipKey="fork" openTip={openTip} setOpenTip={setOpenTip}>
              <label style={s.checkLabel}>
                <input
                  type="checkbox"
                  checked={forkSession}
                  onChange={(e) => setForkSession(e.target.checked)}
                  style={s.checkbox}
                />
                <span>Fork session <span style={s.flag}>(--fork-session)</span></span>
              </label>
            </OptionRow>

            <OptionRow tipKey="permission" openTip={openTip} setOpenTip={setOpenTip}>
              <div style={{ ...s.fieldRow, ...(skipPermissions ? s.fieldDisabled : {}) }}>
                <span>Permission mode <span style={s.flag}>(--permission-mode)</span></span>
                <select
                  value={permissionMode}
                  disabled={skipPermissions}
                  onChange={(e) => setPermissionMode(e.target.value)}
                  style={s.select}
                >
                  {PERMISSION_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </OptionRow>

            <OptionRow tipKey="skip" openTip={openTip} setOpenTip={setOpenTip}>
              <label style={{ ...s.checkLabel, ...(modeActive ? s.fieldDisabled : {}), ...(skipPermissions ? s.dangerLabel : {}) }}>
                <input
                  type="checkbox"
                  checked={skipPermissions}
                  disabled={modeActive}
                  onChange={(e) => setSkipPermissions(e.target.checked)}
                  style={{ ...s.checkbox, accentColor: color.danger }}
                />
                <span>Skip all permissions <span style={s.flag}>(--dangerously-skip-permissions)</span></span>
              </label>
            </OptionRow>
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
    minWidth: 400,
    maxWidth: 'min(560px, 90vw)',
    padding: 10,
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    boxShadow: shadow.sm,
    zIndex: 50,
  },
  row: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  prompt: { color: color.textMuted, fontFamily: font.mono, fontSize: fontSize.xs, fontWeight: fontWeight.bold, flexShrink: 0 },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '6px 9px',
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    background: color.bgAlt,
    color: color.text,
    fontFamily: font.mono,
    fontSize: fontSize.xs,
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
  divider: { height: 1, background: color.border, margin: `${space.px5}px 0` },
  options: { display: 'flex', flexDirection: 'column', gap: space.px6 },
  optRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.px4 },
  optMain: { display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 },
  checkLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.px3,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: color.text,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  checkbox: { width: 14, height: 14, accentColor: color.accent, cursor: 'pointer', margin: 0, flexShrink: 0 },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: space.px4,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: color.text,
    whiteSpace: 'nowrap',
  },
  // Greyed-out + click-blocked when the paired control is active.
  fieldDisabled: { opacity: 0.45, pointerEvents: 'none' },
  dangerLabel: { color: color.danger, fontWeight: fontWeight.semibold },
  flag: { fontFamily: font.mono, fontSize: fontSize.xs, color: color.textMuted, whiteSpace: 'nowrap' },
  select: {
    padding: '3px 6px',
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    background: color.bgAlt,
    color: color.text,
    fontSize: fontSize.sm,
    fontFamily: 'inherit',
    cursor: 'pointer',
    outline: 'none',
  },
  helpBtn: {
    width: 18,
    height: 18,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    border: `1px solid ${color.border}`,
    background: 'transparent',
    color: color.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    fontFamily: 'inherit',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
    transition: `color ${motion.fast}, border-color ${motion.fast}`,
  },
  helpBtnActive: { color: color.accent, borderColor: color.accent },
  tip: {
    marginTop: space.px2,
    padding: `${space.px3}px ${space.px4}px`,
    background: color.bgAlt,
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    fontSize: fontSize.xs,
    color: color.textDim,
    lineHeight: 1.5,
  },
  hint: { marginTop: 6, fontSize: fontSize.xs, color: color.textMuted },
};
