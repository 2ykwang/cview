import { CameraIcon, DownloadIcon } from './Icon';
import { color, radius, space, fontSize, fontWeight, motion } from '../styles/tokens';

export default function ExportBar({ onExportHTML, captureMode, onStartCapture, onCancelCapture, selectedCount, onSavePng, onSaveJpg }) {
  if (captureMode) {
    return (
      <div style={s.bar}>
        <span style={s.hint}>{selectedCount} selected</span>
        {selectedCount > 0 && (
          <>
            <button style={s.saveBtn} onClick={onSavePng} title="Save selection as PNG">PNG</button>
            <button style={s.saveBtn} onClick={onSaveJpg} title="Save selection as JPG">JPG</button>
          </>
        )}
        <button style={s.cancelBtn} onClick={onCancelCapture} title="Exit capture mode">Cancel</button>
      </div>
    );
  }

  return (
    <div style={s.bar}>
      <button style={s.iconBtn} onClick={onExportHTML} title="Export as HTML">
        <DownloadIcon size={14} />
      </button>
      <button style={s.iconBtn} onClick={onStartCapture} title="Screenshot mode">
        <CameraIcon size={14} />
      </button>
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
  saveBtn: {
    padding: '5px 10px',
    borderRadius: radius.sm,
    border: `1px solid ${color.accent}`,
    background: color.accent,
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: 'inherit',
  },
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
