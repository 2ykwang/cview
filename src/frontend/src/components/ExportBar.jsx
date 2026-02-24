import { CameraIcon } from './Icon';

export default function ExportBar({ onExportHTML, captureMode, onStartCapture, onCancelCapture, selectedCount, onSavePng, onSaveJpg }) {
  if (captureMode) {
    return (
      <div style={s.bar}>
        <span style={s.hint}>{selectedCount} selected</span>
        {selectedCount > 0 && (
          <>
            <button style={s.saveBtn} onClick={onSavePng}>PNG</button>
            <button style={s.saveBtn} onClick={onSaveJpg}>JPG</button>
          </>
        )}
        <button style={s.cancelBtn} onClick={onCancelCapture}>Cancel</button>
      </div>
    );
  }

  return (
    <div style={s.bar}>
      <button style={s.btn} onClick={onExportHTML} title="Export as HTML">HTML↓</button>
      <button style={s.iconBtn} onClick={onStartCapture} title="Screenshot mode"><CameraIcon size={13} /></button>
    </div>
  );
}

const s = {
  bar: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  btn: { padding: '4px 10px', borderRadius: '5px', border: '1px solid #293340', background: 'transparent', color: '#aab2ba', cursor: 'pointer', fontSize: '12px' },
  iconBtn: { width: 28, height: 25, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', border: '1px solid #293340', background: 'transparent', color: '#aab2ba', cursor: 'pointer' },
  saveBtn: { padding: '4px 10px', borderRadius: '5px', border: '1px solid #5ab3ef', background: 'transparent', color: '#5ab3ef', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  cancelBtn: { padding: '4px 10px', borderRadius: '5px', border: '1px solid rgba(248,113,113,0.4)', background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: '12px' },
  hint: { fontSize: '12px', color: '#6c7883' },
};
