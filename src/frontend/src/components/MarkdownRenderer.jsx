import { memo, useRef, useState, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

const HIGHLIGHT_PLUGIN = [[rehypeHighlight, { ignoreMissing: true }]];

// Wrap each fenced code block with a hover-reveal Copy button. The text is read
// from the rendered <pre> via ref — rehype-highlight wraps tokens in spans, so
// textContent reassembles the original source. opacity:0-until-hover also keeps
// the button out of PNG/JPG captures (cloned DOM isn't hovered); HTML export
// hides it via EXPORT_CSS. Inline code (`code` without `pre`) is untouched.
function CodeBlock({ children, node, ...props }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async (e) => {
    e.stopPropagation();
    const text = ref.current?.textContent ?? '';
    if (!text) return;
    try { await navigator.clipboard.writeText(text); } catch { return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }, []);
  return (
    <div className="code-block-wrap">
      <button type="button" className="code-copy-btn" onClick={copy} title="Copy code">
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre ref={ref} {...props}>{children}</pre>
    </div>
  );
}

const COMPONENTS = { pre: CodeBlock };

function MarkdownRenderer({ text, style, className = 'md-wrap' }) {
  if (!text) return null;
  return (
    <div style={style} className={className}>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={HIGHLIGHT_PLUGIN} components={COMPONENTS}>
        {text}
      </Markdown>
    </div>
  );
}

// Memoized so re-parsing (remark + rehype-highlight) only happens when `text`
// actually changes, not on every parent re-render.
export default memo(MarkdownRenderer);
