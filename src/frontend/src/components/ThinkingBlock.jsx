import { useState } from 'react';
import { color, radius, space, fontSize, fontWeight, motion } from '../styles/tokens';

export default function ThinkingBlock({ thinking }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={styles.wrapper}>
      <button style={styles.toggle} onClick={() => setOpen(o => !o)} title={open ? 'Hide thinking' : 'Show thinking'}>
        <span style={styles.icon}>{open ? '▾' : '▸'}</span>
        <span style={styles.label}>Thinking</span>
      </button>
      {open && <pre style={styles.body}>{thinking}</pre>}
    </div>
  );
}

const styles = {
  wrapper: {
    marginBottom: 6,
    borderRadius: radius.md,
    overflow: 'hidden',
    border: `1px solid ${color.thinkingBorder}`,
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: space.px3,
    width: '100%',
    padding: `${space.px4}px ${space.px5}px`,
    background: color.thinkingBg,
    border: 'none',
    cursor: 'pointer',
    color: color.thinking,
    fontSize: fontSize.sm,
    textAlign: 'left',
    transition: `background ${motion.fast}`,
  },
  icon: { fontSize: 10 },
  label: { fontWeight: fontWeight.semibold, letterSpacing: '0.5px' },
  body: {
    padding: 12,
    background: '#0a140a',
    color: color.thinking,
    fontSize: fontSize.sm,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 300,
    overflowY: 'auto',
    margin: 0,
  },
};
