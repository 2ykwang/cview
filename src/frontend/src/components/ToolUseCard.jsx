import { useState } from 'react';

export default function ToolUseCard({ name, input, result }) {
  const [inputOpen, setInputOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  const inputStr = JSON.stringify(input, null, 2);
  const resultStr = result ? (
    typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  ) : null;

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.toolIcon}>⚙</span>
        <span style={styles.toolName}>{name}</span>
      </div>

      {/* Input section */}
      <button style={styles.section} onClick={() => setInputOpen(o => !o)}>
        <span style={styles.sectionIcon}>{inputOpen ? '▾' : '▸'}</span>
        <span style={styles.sectionLabel}>Input</span>
      </button>
      {inputOpen && (
        <pre style={styles.code}>{inputStr}</pre>
      )}

      {/* Result section */}
      {resultStr && (
        <>
          <button style={{ ...styles.section, ...styles.resultSection }} onClick={() => setResultOpen(o => !o)}>
            <span style={styles.sectionIcon}>{resultOpen ? '▾' : '▸'}</span>
            <span style={styles.sectionLabel}>Result</span>
          </button>
          {resultOpen && (
            <pre style={{ ...styles.code, ...styles.resultCode }}>{resultStr}</pre>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  card: { borderRadius: '8px', border: '1px solid #2a3a4a', overflow: 'hidden', marginBottom: '6px', background: '#101825' },
  header: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#1a2a3a' },
  toolIcon: { fontSize: '14px', color: '#60a5fa' },
  toolName: { fontWeight: '600', color: '#93c5fd', fontSize: '13px', fontFamily: 'monospace' },
  section: { display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '6px 12px', border: 'none', background: '#12202e', cursor: 'pointer', color: '#94a3b8', fontSize: '12px', textAlign: 'left', borderTop: '1px solid #1e2d3e' },
  resultSection: { background: '#0f1e2e' },
  sectionIcon: { fontSize: '10px' },
  sectionLabel: { fontWeight: '500' },
  code: { padding: '10px 12px', background: '#0a1520', color: '#7dd3fc', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '400px', overflowY: 'auto', margin: 0, borderTop: '1px solid #1e2d3e' },
  resultCode: { color: '#86efac', background: '#091510' },
};
