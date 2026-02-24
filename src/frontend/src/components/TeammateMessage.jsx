import { MessageIcon, MoonIcon } from './Icon';

const COLOR_MAP = {
  red:    { bg: '#2d1515', border: '#5a2020', text: '#f87171' },
  green:  { bg: '#152d15', border: '#205a20', text: '#86efac' },
  blue:   { bg: '#151d2d', border: '#203060', text: '#93c5fd' },
  yellow: { bg: '#2d2a10', border: '#5a4a15', text: '#fde68a' },
  purple: { bg: '#251530', border: '#4a2060', text: '#c4b5fd' },
  cyan:   { bg: '#102528', border: '#1a4a4e', text: '#67e8f9' },
  gray:   { bg: '#1e1e2e', border: '#3a3a5a', text: '#94a3b8' },
};

export default function TeammateMessage({ teammateId, color, summary, body }) {
  const scheme = COLOR_MAP[color] || COLOR_MAP.gray;

  // If body is JSON, extract type
  let label = summary || '';
  let displayBody = body;
  try {
    const parsed = JSON.parse(body);
    if (parsed.type && !label) label = parsed.type;
    if (parsed.type === 'idle_notification') {
      displayBody = `${parsed.from || teammateId} is idle`;
    }
  } catch {
    // Use text as-is
  }

  return (
    <div style={{ ...styles.wrapper, background: scheme.bg, borderColor: scheme.border }}>
      <div style={{ ...styles.header, color: scheme.text }}>
        <span style={styles.icon}><MessageIcon size={14} /></span>
        <span style={styles.from}>{teammateId}</span>
        {label && <span style={styles.label}>{label}</span>}
      </div>
      <div style={styles.body}>
        {label === 'idle_notification' && <span style={styles.idleIcon}><MoonIcon size={13} /></span>}
        {displayBody}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { borderRadius: '8px', border: '1px solid', padding: '10px 14px', marginBottom: '6px' },
  header: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '13px', fontWeight: '600' },
  icon: { display: 'inline-flex', alignItems: 'center' },
  from: {},
  label: { fontSize: '11px', fontWeight: '400', opacity: 0.75, background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' },
  body: { fontSize: '13px', color: '#ccc', whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: '6px' },
  idleIcon: { color: '#9aa4ae', display: 'inline-flex', alignItems: 'center' },
};
