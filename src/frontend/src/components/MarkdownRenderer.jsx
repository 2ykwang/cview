import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

const HIGHLIGHT_PLUGIN = [[rehypeHighlight, { ignoreMissing: true }]];

export default function MarkdownRenderer({ text, style, className = 'md-wrap' }) {
  if (!text) return null;
  return (
    <div style={style} className={className}>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={HIGHLIGHT_PLUGIN}>
        {text}
      </Markdown>
    </div>
  );
}
