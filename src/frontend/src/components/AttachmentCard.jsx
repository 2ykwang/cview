import { useState } from 'react';
import { FileIcon } from './Icon';
import { ATTACHMENT_WHITELIST } from '@shared/index.js';
import { color, radius, fontSize, font, space } from '../styles/tokens';

const short = (p) => (p || '').replace(/^\/Users\/[^/]+/, '~');

// IDE / system context attachments. The kind lives on attachment.type (not the
// record type). Only meaningful kinds reach here (ATTACHMENT_WHITELIST); noise
// like hook_success / task_reminder is filtered upstream in the stream.
export default function AttachmentCard({ record }) {
  const [open, setOpen] = useState(false);
  const a = record?.attachment;
  if (!a || !ATTACHMENT_WHITELIST.has(a.type)) return null;

  const file = a.filename || a.displayPath || '';
  let label;
  let body = null;

  switch (a.type) {
    case 'selected_lines_in_ide':
      label = `selected ${short(file)}:${a.lineStart}–${a.lineEnd}`;
      body = a.content;
      break;
    case 'file':
      label = short(file) || 'file';
      body = a.content;
      break;
    case 'edited_text_file':
      label = `edited ${short(file)}`;
      body = a.snippet;
      break;
    case 'opened_file_in_ide':
      label = `opened ${short(file)}`;
      break;
    case 'queued_command':
      label = `queued: ${a.prompt || ''}`;
      break;
    case 'plan_mode_exit':
      label = a.planFilePath ? `plan saved · ${short(a.planFilePath)}` : 'plan mode exited';
      break;
    default:
      label = a.type;
  }

  const hasBody = typeof body === 'string' && body.trim().length > 0;

  return (
    <div style={s.row}>
      <div style={s.card}>
        <span style={s.icon}><FileIcon size={12} /></span>
        <span style={s.label}>{label}</span>
        {hasBody && (
          <button style={s.toggle} onClick={() => setOpen(o => !o)} title={open ? 'Collapse' : 'Expand'}>
            {open ? '▾' : '▸'}
          </button>
        )}
      </div>
      {open && hasBody && <pre style={s.body}>{body.slice(0, 2000)}</pre>}
    </div>
  );
}

const s = {
  row: { display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4px 0' },
  card: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.px3,
    maxWidth: '75%',
    padding: '3px 10px',
    borderRadius: radius.pill,
    background: color.surface,
    border: `1px solid ${color.border}`,
    color: color.textMuted,
    fontSize: fontSize.xs,
  },
  icon: { display: 'inline-flex', alignItems: 'center', color: color.textDim },
  label: { fontFamily: font.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  toggle: {
    background: 'transparent',
    border: 'none',
    color: color.textMuted,
    cursor: 'pointer',
    fontSize: fontSize.xs,
    padding: '0 2px',
  },
  body: {
    margin: '4px 0 0',
    maxWidth: '75%',
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
    maxHeight: 300,
    overflowY: 'auto',
  },
};
