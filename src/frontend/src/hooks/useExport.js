import { useState, useCallback } from 'react';

const EXPORT_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #17212b; color: #e8e8e8; padding: 20px; }
.md-wrap table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px; }
.md-wrap th, .md-wrap td { border: 1px solid #293340; padding: 6px 12px; text-align: left; }
.md-wrap th { background: #1c2733; color: #5ab3ef; font-weight: 600; }
.md-wrap tr:nth-child(even) td { background: #131f2b; }
.md-wrap code { background: #131f2b; color: #5ab3ef; padding: 1px 5px; border-radius: 3px; font-size: 12px; font-family: monospace; }
.md-wrap pre { background: #131f2b; padding: 10px 12px; border-radius: 6px; overflow-x: auto; margin: 6px 0; }
.md-wrap pre code { background: transparent; padding: 0; color: #aab2ba; font-size: 12px; }
.md-wrap pre code.hljs { display: block; padding: 0; }
.md-wrap .hljs { color: #e6edf3; background: transparent; }
.md-wrap .hljs-comment, .md-wrap .hljs-quote { color: #8b949e; font-style: italic; }
.md-wrap .hljs-keyword, .md-wrap .hljs-selector-tag, .md-wrap .hljs-built_in { color: #ff7b72; }
.md-wrap .hljs-string, .md-wrap .hljs-attr, .md-wrap .hljs-template-tag { color: #a5d6ff; }
.md-wrap .hljs-number, .md-wrap .hljs-literal { color: #79c0ff; }
.md-wrap .hljs-title, .md-wrap .hljs-function, .md-wrap .hljs-section { color: #d2a8ff; }
.md-wrap .hljs-variable, .md-wrap .hljs-params, .md-wrap .hljs-name { color: #ffa657; }
.md-wrap .hljs-meta, .md-wrap .hljs-bullet, .md-wrap .hljs-symbol { color: #7ee787; }
.md-wrap p { margin-bottom: 6px; }
.md-wrap ul, .md-wrap ol { padding-left: 20px; margin-bottom: 6px; }
.md-wrap li { margin-bottom: 2px; }
.bubble-in { position: relative; }
.bubble-in::before { content: ''; position: absolute; left: -7px; bottom: 0; width: 0; height: 0; border-right: 7px solid #232e3c; border-bottom: 7px solid transparent; }
.bubble-out { position: relative; }
.bubble-out::after { content: ''; position: absolute; right: -7px; bottom: 0; width: 0; height: 0; border-left: 7px solid #2b5278; border-bottom: 7px solid transparent; }
`;

export function useExport(messageListRef, orderedIds = []) {
  const [captureMode, setCaptureMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [anchorIdx, setAnchorIdx] = useState(null); // for shift-range select

  // Click handler with Shift and Cmd/Ctrl support
  const handleMsgClick = useCallback((id, event) => {
    const idx = orderedIds.indexOf(id);

    if (event.shiftKey && anchorIdx !== null && idx !== -1) {
      // Shift+click: select range from anchor to here
      const start = Math.min(anchorIdx, idx);
      const end = Math.max(anchorIdx, idx);
      setSelected(prev => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          if (orderedIds[i] != null) next.add(orderedIds[i]);
        }
        return next;
      });
      // Shift-click does NOT move anchor (standard behavior)
    } else {
      // Regular click or Cmd/Ctrl+click: toggle individual item
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      if (idx !== -1) setAnchorIdx(idx);
    }
  }, [orderedIds, anchorIdx]);

  const startCapture = useCallback(() => {
    setCaptureMode(true);
    setSelected(new Set());
    setAnchorIdx(null);
  }, []);

  const cancelCapture = useCallback(() => {
    setCaptureMode(false);
    setSelected(new Set());
    setAnchorIdx(null);
  }, []);

  const exportHTML = useCallback(() => {
    if (!messageListRef?.current) return;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chat Export</title>
<style>${EXPORT_CSS}</style>
</head>
<body>${messageListRef.current.innerHTML}</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [messageListRef]);

  const saveCapture = useCallback(async (format) => {
    if (selected.size === 0) return;

    // Collect in DOM order (not Set insertion order)
    const els = Array.from(document.querySelectorAll('[data-msg-id]'))
      .filter(el => selected.has(el.dataset.msgId));
    if (els.length === 0) return;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;background:#17212b;padding:16px 20px;width:720px;';
    els.forEach(el => {
      const clone = el.cloneNode(true);
      clone.style.background = 'transparent'; // strip selection highlight
      clone.style.cursor = '';
      clone.style.userSelect = '';
      wrapper.appendChild(clone);
    });
    document.body.appendChild(wrapper);

    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(wrapper, {
        backgroundColor: '#17212b',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const link = document.createElement('a');
      link.download = `capture-${Date.now()}.${format}`;
      link.href = canvas.toDataURL(mimeType, 0.95);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      document.body.removeChild(wrapper);
    }
  }, [selected]);

  return { captureMode, selected, handleMsgClick, startCapture, cancelCapture, exportHTML, saveCapture };
}
