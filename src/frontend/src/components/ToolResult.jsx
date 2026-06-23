import { useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import { color, radius, fontSize, font } from '../styles/tokens';

const MAX = 4000;

// Renders a tool call's result (toolUseResult), paired by tool_use id in
// Messenger. cview historically showed the call but never its output — this
// fills that gap. Edit/Write are skipped because ToolCard already renders their
// diff from the input. Collapsed by default to keep the transcript scannable.
export default function ToolResult({ result, name }) {
  const [open, setOpen] = useState(false);
  if (result == null) return null;
  if (name === 'Edit' || name === 'Write') return null;

  let label = 'output';
  let text = null;

  if (typeof result === 'string') {
    text = result;
  } else if (Array.isArray(result)) {
    return <div style={s.meta}>↳ {result.length} result item{result.length === 1 ? '' : 's'}</div>;
  } else if (typeof result === 'object') {
    if (name === 'Bash') {
      text = [result.stdout, result.stderr].filter(v => typeof v === 'string' && v).join('\n');
    } else if (name === 'ExitPlanMode') {
      text = result.plan;
      label = 'plan';
    } else if (name === 'Read') {
      text = typeof result.file === 'string' ? result.file : result.file?.content;
      label = 'file';
    } else {
      // generic: the first stringy field that reads like output
      text = [result.stdout, result.content, result.message, result.result]
        .find(v => typeof v === 'string' && v.trim()) || null;
    }
  }

  if (typeof text !== 'string' || !text.trim()) return null;
  const body = text.length > MAX ? `${text.slice(0, MAX)}\n… +${text.length - MAX} chars` : text;

  return (
    <div style={s.wrap}>
      <button style={s.toggle} onClick={() => setOpen(o => !o)} title={open ? 'Collapse output' : 'Expand output'}>
        ↳ {label} {open ? '▾' : '▸'}
      </button>
      {open && (label === 'plan'
        ? <MarkdownRenderer style={s.md} text={body} />
        : <pre style={s.pre}>{body}</pre>)}
    </div>
  );
}

const s = {
  wrap: { margin: '2px 0 6px' },
  meta: { margin: '2px 0 6px', fontSize: fontSize.xs, color: color.textMuted, fontFamily: font.mono },
  toggle: {
    background: 'transparent',
    border: 'none',
    color: color.textMuted,
    cursor: 'pointer',
    fontSize: fontSize.xs,
    fontFamily: font.mono,
    padding: '0 2px',
  },
  md: { color: color.text, fontSize: fontSize.sm, lineHeight: 1.5 },
  pre: {
    margin: '4px 0 0',
    padding: '8px 10px',
    background: color.codeBg,
    borderRadius: radius.sm,
    fontSize: fontSize.sm,
    color: color.text,
    fontFamily: font.mono,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    overflowX: 'auto',
    border: `1px solid ${color.border}`,
    maxHeight: 360,
    overflowY: 'auto',
  },
};
