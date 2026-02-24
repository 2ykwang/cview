import { useState } from 'react';

export default function ThinkingBlock({ thinking }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={styles.wrapper}>
      <button style={styles.toggle} onClick={() => setOpen(o => !o)}>
        <span style={styles.icon}>{open ? '▾' : '▸'}</span>
        <span style={styles.label}>Thinking</span>
      </button>
      {open && (
        <pre style={styles.body}>{thinking}</pre>
      )}
    </div>
  );
}

const styles = {
  wrapper: { marginBottom: '6px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #2a3a2a' },
  toggle: { display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '8px 12px', background: '#1a2a1a', border: 'none', cursor: 'pointer', color: '#6ee7b7', fontSize: '12px', textAlign: 'left' },
  icon: { fontSize: '10px' },
  label: { fontWeight: '600', letterSpacing: '0.5px' },
  body: { padding: '12px', background: '#111a11', color: '#86efac', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '300px', overflowY: 'auto', margin: 0 },
};
