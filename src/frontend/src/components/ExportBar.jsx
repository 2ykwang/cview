import { ExportIcon } from './Icon';
import { color, radius, fontSize, fontWeight, motion } from '../styles/tokens';

// One neutral entry button opens an export mode: select messages (or Select
// all), then emit them as Copy(markdown) / MD file / HTML / PNG / JPG. Format
// buttons act on the selection, so they're disabled until something is picked.
export default function ExportBar({
  captureMode, onEnter, onCancel,
  selectedCount, onSelectAll, onReset,
  onCopyText, textCopied, onSaveMarkdown, onExportHTML, onSavePng, onSaveJpg,
}) {
  if (!captureMode) {
    return (
      <div style={s.bar}>
        <button style={s.iconBtn} onClick={onEnter} title="Export or copy messages">
          <ExportIcon size={14} />
        </button>
      </div>
    );
  }

  const none = selectedCount === 0;
  const fmt = none ? { ...s.actionBtn, ...s.disabled } : s.actionBtn;

  return (
    <div style={s.bar}>
      <span style={s.hint}>{selectedCount} selected</span>
      <button style={s.actionBtn} onClick={onSelectAll} title="Select all messages">All</button>
      <button style={fmt} onClick={onReset} disabled={none} title="Clear selection">Reset</button>
      <span style={s.divider} />
      <button style={fmt} onClick={onCopyText} disabled={none} title="Copy selection as markdown">{textCopied ? 'Copied' : 'Copy'}</button>
      <button style={fmt} onClick={onSaveMarkdown} disabled={none} title="Download as Markdown (.md)">MD</button>
      <button style={fmt} onClick={onExportHTML} disabled={none} title="Download as HTML">HTML</button>
      <button style={fmt} onClick={onSavePng} disabled={none} title="Download as PNG">PNG</button>
      <button style={fmt} onClick={onSaveJpg} disabled={none} title="Download as JPG">JPG</button>
      <button style={s.cancelBtn} onClick={onCancel} title="Exit export mode">Cancel</button>
    </div>
  );
}

const s = {
  bar: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
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
  actionBtn: {
    padding: '5px 9px',
    borderRadius: radius.sm,
    border: `1px solid ${color.border}`,
    background: 'transparent',
    color: color.textDim,
    cursor: 'pointer',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    fontFamily: 'inherit',
  },
  disabled: { opacity: 0.4, pointerEvents: 'none' },
  divider: { width: 1, height: 18, background: color.border, margin: '0 2px' },
  cancelBtn: {
    padding: '5px 10px',
    borderRadius: radius.sm,
    border: `1px solid ${color.border}`,
    background: 'transparent',
    color: color.textDim,
    cursor: 'pointer',
    fontSize: fontSize.sm,
    fontFamily: 'inherit',
  },
  hint: { fontSize: fontSize.sm, color: color.textMuted, marginRight: 4 },
};
