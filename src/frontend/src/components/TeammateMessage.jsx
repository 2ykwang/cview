import { MessageIcon, MoonIcon, SendIcon } from './Icon';
import { color, radius, space, fontSize, fontWeight, font } from '../styles/tokens';
import MarkdownRenderer from './MarkdownRenderer';

// teammate-message tags carry a color attribute (red/green/blue/yellow/purple/cyan/gray).
// We render them as low-saturation tinted cards aligned to the design system.
const TINTS = {
  red:    { bg: 'rgba(248, 113, 113, 0.08)', border: 'rgba(248, 113, 113, 0.25)', text: color.danger },
  green:  { bg: 'rgba(52, 211, 153, 0.08)',  border: 'rgba(52, 211, 153, 0.25)',  text: color.success },
  blue:   { bg: 'rgba(103, 197, 232, 0.08)', border: 'rgba(103, 197, 232, 0.25)', text: color.accent },
  yellow: { bg: 'rgba(251, 191, 36, 0.08)',  border: 'rgba(251, 191, 36, 0.25)',  text: color.warning },
  purple: { bg: 'rgba(196, 181, 253, 0.08)', border: 'rgba(196, 181, 253, 0.25)', text: color.toolAgent },
  cyan:   { bg: 'rgba(103, 232, 249, 0.08)', border: 'rgba(103, 232, 249, 0.25)', text: '#67e8f9' },
  gray:   { bg: color.bgAlt,                  border: color.border,                text: color.textDim },
};

export default function TeammateMessage({ teammateId, color: tint, summary, body }) {
  const scheme = TINTS[tint] || TINTS.gray;

  // teammate-message body can be a JSON envelope (idle_notification etc.) or freeform text.
  let kind = null;
  let displayText = body;
  let from = teammateId;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object') {
      kind = parsed.type || null;
      if (parsed.from) from = parsed.from;
      if (kind === 'idle_notification') {
        const reason = parsed.idleReason ? ` (${parsed.idleReason})` : '';
        displayText = `idle${reason}`;
      } else if (typeof parsed.message === 'string') {
        displayText = parsed.message;
      } else if (typeof parsed.text === 'string') {
        displayText = parsed.text;
      }
    }
  } catch { /* freeform text — keep as-is */ }

  const isIdle = kind === 'idle_notification';
  const HeaderIcon = isIdle ? MoonIcon : (kind ? SendIcon : MessageIcon);

  return (
    <div style={{ ...s.card, background: scheme.bg, borderColor: scheme.border, borderLeftColor: scheme.text }}>
      <div style={s.header}>
        <span style={{ ...s.iconBox, color: scheme.text }}><HeaderIcon size={13} /></span>
        <span style={{ ...s.from, color: scheme.text }}>@{from}</span>
        {kind && <span style={s.kindTag}>{kind}</span>}
        {summary && <span style={s.summary}>{summary}</span>}
      </div>
      <div style={s.body}>
        {isIdle
          ? <span style={s.idleText}>{displayText}</span>
          : <MarkdownRenderer style={s.md} text={displayText || ''} />
        }
      </div>
    </div>
  );
}

const s = {
  card: {
    margin: '4px 0',
    padding: `${space.px4}px ${space.px5}px`,
    border: '1px solid',
    borderLeft: '3px solid',
    borderRadius: radius.md,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: space.px3,
    marginBottom: space.px3,
    flexWrap: 'wrap',
    fontSize: fontSize.base,
  },
  iconBox: { display: 'inline-flex', alignItems: 'center' },
  from: { fontWeight: fontWeight.semibold, fontFamily: font.mono, fontSize: fontSize.sm },
  kindTag: {
    fontSize: fontSize.xs,
    color: color.textMuted,
    background: 'rgba(255, 255, 255, 0.04)',
    border: `1px solid ${color.border}`,
    padding: '1px 6px',
    borderRadius: radius.xs,
    fontFamily: font.mono,
  },
  summary: {
    fontSize: fontSize.xs,
    color: color.textDim,
    background: 'rgba(255, 255, 255, 0.04)',
    padding: '1px 7px',
    borderRadius: radius.pill,
  },
  body: { fontSize: fontSize.base, color: color.text },
  md: { color: color.text, fontSize: fontSize.base, lineHeight: 1.5, wordBreak: 'break-word' },
  idleText: { color: color.textDim, fontStyle: 'italic', fontSize: fontSize.sm },
};
