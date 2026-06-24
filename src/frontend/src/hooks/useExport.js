import { useState, useCallback } from 'react';
import { serializeMessages } from '../utils/serializeMessages.js';

// Keep in sync with index.css. Inline styles in the captured DOM reference
// CSS variables (var(--…)), so the export must define both themes at :root
// for the result to look the same as the live app.
const EXPORT_CSS = `
:root {
  --bg: #ffffff;
  --bg-alt: #f9fafb;
  --surface: #ffffff;
  --surface-2: #f2f4f6;
  --surface-3: #e5e8eb;
  --border: #e5e8eb;
  --border-strong: #d1d6db;
  --text: #191f28;
  --text-dim: #4e5968;
  --text-muted: #8b95a1;
  --text-faint: #b0b8c1;
  --accent: #3182f6;
  --accent-hover: #1b64da;
  --accent-bg: #e8f3ff;
  --user-bubble: #3182f6;
  --user-bubble-text: #ffffff;
  --agent-bubble: #f2f4f6;
  --success: #0ac674;
  --warning: #ff9500;
  --danger: #f04452;
  --diff-add-bg: #e6f7ed;
  --diff-add-fg: #0a7c4d;
  --diff-del-bg: #fde7e9;
  --diff-del-fg: #b8313a;
  --code-bg: #f2f4f6;
  --code-fg: #3182f6;
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-sm: 0 2px 6px rgba(0, 0, 0, 0.05);
  --motion-fast: 100ms cubic-bezier(0.2, 0.8, 0.2, 1);
  --motion-base: 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
  color-scheme: light;
}
[data-theme="dark"] {
  --bg: #17171c;
  --bg-alt: #1c1c22;
  --surface: #23232a;
  --surface-2: #2a2a33;
  --surface-3: #32323c;
  --border: #2a2a33;
  --border-strong: #3d3d48;
  --text: #e5e8eb;
  --text-dim: #b0b8c1;
  --text-muted: #8b95a1;
  --text-faint: #6b7480;
  --accent: #4593fc;
  --accent-hover: #6aa9ff;
  --accent-bg: #15243a;
  --user-bubble: #3182f6;
  --user-bubble-text: #ffffff;
  --agent-bubble: #2a2a33;
  --success: #3acc8a;
  --warning: #ffaa1d;
  --danger: #ff6675;
  --diff-add-bg: #0e2415;
  --diff-add-fg: #3acc8a;
  --diff-del-bg: #2d1015;
  --diff-del-fg: #ff6675;
  --code-bg: #1c1c22;
  --code-fg: #6aa9ff;
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-sm: 0 2px 6px rgba(0, 0, 0, 0.4);
  color-scheme: dark;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--text);
  padding: 20px;
  -webkit-font-smoothing: antialiased;
}
.md-wrap table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px; }
.md-wrap th, .md-wrap td { border: 1px solid var(--border); padding: 6px 12px; text-align: left; }
.md-wrap th { background: var(--surface-2); color: var(--text); font-weight: 600; }
.md-wrap tr:nth-child(even) td { background: var(--bg-alt); }
.md-wrap code { background: var(--code-bg); color: var(--code-fg); padding: 1px 5px; border-radius: 4px; font-size: 12px; font-family: var(--font-mono); }
.md-wrap pre { background: var(--code-bg); padding: 10px 12px; border-radius: 6px; overflow-x: auto; margin: 6px 0; border: 1px solid var(--border); }
.md-wrap pre code { background: transparent; padding: 0; color: var(--text); font-size: 12px; }
.md-wrap pre code.hljs { display: block; padding: 0; }
.code-copy-btn { display: none; }
.export-footer { margin: 28px auto 4px; padding-top: 14px; border-top: 1px solid var(--border); max-width: 760px; text-align: center; font-size: 12px; color: var(--text-muted); }
.export-footer a { color: var(--accent); text-decoration: none; }
.md-wrap p { margin-bottom: 6px; }
.md-wrap p:last-child { margin-bottom: 0; }
.md-wrap ul, .md-wrap ol { padding-left: 20px; margin-bottom: 6px; }
.md-wrap li { margin-bottom: 2px; }
.md-wrap a { color: var(--accent); }
.md-wrap blockquote { border-left: 3px solid var(--border-strong); padding: 2px 10px; margin: 6px 0; color: var(--text-dim); }
.md-wrap .hljs { color: var(--text); background: transparent; }
.md-wrap .hljs-comment, .md-wrap .hljs-quote { color: var(--text-muted); font-style: italic; }
.md-wrap .hljs-keyword, .md-wrap .hljs-selector-tag, .md-wrap .hljs-built_in { color: var(--danger); }
.md-wrap .hljs-string, .md-wrap .hljs-attr, .md-wrap .hljs-template-tag { color: var(--success); }
.md-wrap .hljs-number, .md-wrap .hljs-literal { color: var(--accent-hover); }
.md-wrap .hljs-title, .md-wrap .hljs-function, .md-wrap .hljs-section { color: var(--accent); }
.md-wrap .hljs-variable, .md-wrap .hljs-params, .md-wrap .hljs-name { color: var(--text-dim); }
.md-wrap .hljs-meta, .md-wrap .hljs-bullet, .md-wrap .hljs-symbol { color: var(--warning); }

.bubble-in { position: relative; }
.bubble-in::before {
  content: ''; position: absolute; left: -7px; bottom: 0;
  width: 0; height: 0;
  border-right: 7px solid var(--agent-bubble);
  border-bottom: 7px solid transparent;
}
.bubble-out { position: relative; }
.bubble-out::after {
  content: ''; position: absolute; right: -7px; bottom: 0;
  width: 0; height: 0;
  border-left: 7px solid var(--user-bubble);
  border-bottom: 7px solid transparent;
}
`;

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useExport(messageListRef, orderedIds = [], records = []) {
  const [captureMode, setCaptureMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [anchorIdx, setAnchorIdx] = useState(null);
  const [textCopied, setTextCopied] = useState(false);

  const handleMsgClick = useCallback((id, event) => {
    const idx = orderedIds.indexOf(id);

    if (event.shiftKey && anchorIdx !== null && idx !== -1) {
      const start = Math.min(anchorIdx, idx);
      const end = Math.max(anchorIdx, idx);
      setSelected(prev => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          if (orderedIds[i] != null) next.add(orderedIds[i]);
        }
        return next;
      });
    } else {
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
    const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

    // Partial export: only the selected messages (capture mode). Clone and
    // neutralize the selection highlight, same as the image-capture path.
    // No selection → export the whole conversation.
    let body;
    if (selected.size > 0) {
      const els = Array.from(messageListRef.current.querySelectorAll('[data-msg-id]'))
        .filter(el => selected.has(el.dataset.msgId));
      if (els.length === 0) return;
      body = els.map(el => {
        const clone = el.cloneNode(true);
        clone.style.background = 'transparent';
        clone.style.cursor = '';
        clone.style.userSelect = '';
        return clone.outerHTML;
      }).join('');
    } else {
      body = messageListRef.current.innerHTML;
    }

    const html = `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chat Export</title>
<style>${EXPORT_CSS}</style>
</head>
<body>${body}<footer class="export-footer">Exported from <a href="https://github.com/2ykwang/cview">cview</a> · Claude Code session viewer</footer></body>
</html>`;
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `chat-${Date.now()}.html`);
  }, [messageListRef, selected]);

  const saveCapture = useCallback(async (format) => {
    if (selected.size === 0) return;

    const els = Array.from(document.querySelectorAll('[data-msg-id]'))
      .filter(el => selected.has(el.dataset.msgId));
    if (els.length === 0) return;

    const isDark = document.documentElement.dataset.theme === 'dark';
    const bg = isDark ? '#17171c' : '#ffffff';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `position:absolute;left:-9999px;top:0;background:${bg};padding:16px 20px;width:720px;`;
    els.forEach(el => {
      const clone = el.cloneNode(true);
      clone.style.background = 'transparent';
      clone.style.cursor = '';
      clone.style.userSelect = '';
      wrapper.appendChild(clone);
    });
    document.body.appendChild(wrapper);

    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(wrapper, {
        backgroundColor: bg,
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

  // Copy the conversation as markdown: the selection if any messages are
  // picked (capture mode), otherwise the whole transcript.
  const copyText = useCallback(async () => {
    const md = serializeMessages(records, selected.size ? selected : null);
    if (!md) return;
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      return;
    }
    setTextCopied(true);
    setTimeout(() => setTextCopied(false), 1400);
  }, [records, selected]);

  // Download the selection as a Markdown file.
  const saveMarkdown = useCallback(() => {
    const md = serializeMessages(records, selected.size ? selected : null);
    if (!md) return;
    downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `chat-${Date.now()}.md`);
  }, [records, selected]);

  const selectAll = useCallback(() => setSelected(new Set(orderedIds)), [orderedIds]);
  const resetSelection = useCallback(() => { setSelected(new Set()); setAnchorIdx(null); }, []);

  return {
    captureMode, selected, handleMsgClick, startCapture, cancelCapture,
    exportHTML, saveCapture, copyText, textCopied, saveMarkdown, selectAll, resetSelection,
  };
}
