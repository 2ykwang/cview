import { useState } from 'react';
import { getAvatarColor } from './Avatar';
import MarkdownRenderer from './MarkdownRenderer';
import {
  BotIcon,
  ClipboardIcon,
  EditIcon,
  FileIcon,
  FolderIcon,
  MegaphoneIcon,
  PencilIcon,
  PowerIcon,
  RefreshIcon,
  SearchIcon,
  SendIcon,
  TrashIcon,
  UsersIcon,
  WrenchIcon,
} from './Icon';

function Mention({ name }) {
  if (!name) return <strong>all</strong>;
  return (
    <strong style={{ color: getAvatarColor(name) }}>@{name}</strong>
  );
}

export function shortPath(p) {
  if (!p) return '';
  return p.replace(/^\/Users\/[^/]+/, '~');
}

const mdWrap = { color: '#e2e8f0', fontSize: '14px', lineHeight: '1.65', wordBreak: 'break-word', overflowX: 'auto' };
const noText = { color: '#4a4a6a', fontSize: '13px', fontStyle: 'italic' };

export function ToolResult({ block }) {
  const [open, setOpen] = useState(true);
  const content = block.content;
  const text = Array.isArray(content)
    ? content.filter(b => b.type === 'text').map(b => b.text).join('\n')
    : (typeof content === 'string' ? content : '');

  if (!text) return null;
  const preview = text.split('\n')[0].slice(0, 60);

  return (
      <div style={tc.result}>
        <button style={tc.resultHeader} onClick={() => setOpen(o => !o)}>
          <span style={tc.resultIcon}>#</span>
          <span style={tc.resultPreview}>{preview}</span>
          <span style={tc.toggle}>{open ? '▲' : '▼'}</span>
        </button>
      {open && <pre style={tc.resultBody}>{text.slice(0, 2000)}</pre>}
    </div>
  );
}

export function MessageContent({ content }) {
  if (!content) return <span style={noText}>[no content]</span>;

  if (typeof content === 'string') {
    return <MarkdownRenderer style={mdWrap} text={content} />;
  }

  if (!Array.isArray(content)) return null;

  const blocks = content.filter(b => b.type !== 'thinking');
  if (blocks.length === 0) return null;

  return (
    <div>
      {blocks.map((block, i) => {
        if (block.type === 'text') {
          return block.text
            ? <MarkdownRenderer key={i} style={mdWrap} text={block.text} />
            : null;
        }
        if (block.type === 'tool_use') return <ToolCard key={i} block={block} />;
        if (block.type === 'tool_result') return <ToolResult key={i} block={block} />;
        return null;
      })}
    </div>
  );
}

export default function ToolCard({ block }) {
  const [open, setOpen] = useState(true);
  const { name, input = {} } = block;

  if (name === 'SendMessage') {
    const msgType = input.type || '';
    const isShutdown = msgType.includes('shutdown');
    const isBroadcast = msgType === 'broadcast';
    return (
      <div style={tc.sendMsg}>
        <div style={tc.sendMsgHeader}>
          <span style={tc.sendIcon}>
            {isShutdown ? <PowerIcon size={14} /> : isBroadcast ? <MegaphoneIcon size={14} /> : <SendIcon size={14} />}
          </span>
          <span style={tc.sendTo}>→ <Mention name={input.recipient} /></span>
          {input.summary && <span style={tc.sendSummary}>{input.summary}</span>}
        </div>
        {input.content && (
          <MarkdownRenderer style={{ ...tc.sendBody, ...mdWrap }} text={input.content} />
        )}
      </div>
    );
  }

  if (name === 'Bash') {
    return (
      <div style={tc.bash}>
        <div style={tc.bashHeader}>
          <span style={tc.bashIcon}>$</span>
          {input.description && <span style={tc.bashDesc}>{input.description}</span>}
          <button style={tc.toggle} onClick={() => setOpen(o => !o)}>{open ? '▲' : '▼'}</button>
        </div>
        {open && <pre style={tc.bashCmd}>{input.command}</pre>}
        {!open && <div style={tc.bashPreview}>{(input.command || '').split('\n')[0].slice(0, 80)}</div>}
      </div>
    );
  }

  if (name === 'Read') {
    return (
      <div style={tc.fileCard}>
        <div style={tc.fileHeader}>
          <span style={tc.fileIcon}><FileIcon size={14} /></span>
          <span style={tc.filePath}>{shortPath(input.file_path)}</span>
        </div>
      </div>
    );
  }

  if (name === 'Write') {
    return (
      <div style={tc.fileCard}>
        <div style={tc.fileHeader}>
          <span style={tc.fileIcon}><PencilIcon size={14} /></span>
          <span style={tc.filePath}>{shortPath(input.file_path)}</span>
          {input.content && (
            <button style={tc.toggle} onClick={() => setOpen(o => !o)}>{open ? '▲' : '▼'}</button>
          )}
        </div>
        {open && <pre style={tc.fileBody}>{(input.content || '').slice(0, 500)}</pre>}
      </div>
    );
  }

  if (name === 'Edit') {
    return (
      <div style={tc.fileCard}>
        <div style={tc.fileHeader}>
          <span style={tc.fileIcon}><EditIcon size={14} /></span>
          <span style={tc.filePath}>{shortPath(input.file_path)}</span>
          <button style={tc.toggle} onClick={() => setOpen(o => !o)}>{open ? '▲' : '▼'}</button>
        </div>
        {open && (
          <div style={{ marginTop: 8, width: '100%' }}>
            <div style={tc.diffDel}>{(input.old_string || '').slice(0, 200)}</div>
            <div style={tc.diffAdd}>{(input.new_string || '').slice(0, 200)}</div>
          </div>
        )}
      </div>
    );
  }

  if (name === 'Task') {
    return (
      <div style={tc.task}>
        <span style={tc.taskIcon}><BotIcon size={14} /></span>
        <div style={tc.taskInfo}>
          <div><strong>{input.name || input.subagent_type}</strong>{input.team_name ? ` · ${input.team_name}` : ''}</div>
          {input.description && <div style={tc.taskDesc}>{input.description}</div>}
        </div>
      </div>
    );
  }

  if (name === 'TaskCreate') {
    return (
      <div style={tc.task}>
        <span style={tc.taskIcon}><ClipboardIcon size={14} /></span>
        <div style={tc.taskInfo}>
          <div>New task: <strong>{input.subject}</strong></div>
          {input.description && <div style={tc.taskDesc}>{input.description.slice(0, 100)}</div>}
        </div>
      </div>
    );
  }

  if (name === 'TaskUpdate') {
    const statusColor = { completed: '#10B981', in_progress: '#F59E0B', deleted: '#EF4444' }[input.status] || '#94A3B8';
    return (
      <div style={tc.task}>
        <span style={tc.taskIcon}><RefreshIcon size={14} /></span>
        <div>Task <strong>#{input.taskId}</strong> →{' '}
          <span style={{ color: statusColor, fontWeight: 600 }}>{input.status || input.owner || 'updated'}</span>
        </div>
      </div>
    );
  }

  if (name === 'TeamCreate') {
    return (
      <div style={tc.task}>
        <span style={tc.taskIcon}><UsersIcon size={14} /></span>
        <div>Team created: <strong>{input.team_name}</strong></div>
      </div>
    );
  }

  if (name === 'TeamDelete') {
    return (
      <div style={tc.task}>
        <span style={tc.taskIcon}><TrashIcon size={14} /></span>
        <div>Team disbanded</div>
      </div>
    );
  }

  if (name === 'Glob' || name === 'Grep') {
    return (
      <div style={tc.fileCard}>
        <div style={tc.fileHeader}>
          <span style={tc.fileIcon}>{name === 'Grep' ? <SearchIcon size={14} /> : <FolderIcon size={14} />}</span>
          <code style={tc.code}>{input.pattern}</code>
          {input.path && <span style={tc.filePath}> in {shortPath(input.path)}</span>}
        </div>
      </div>
    );
  }

  return (
    <span style={tc.badge}>
      <WrenchIcon size={12} />
      {name}
    </span>
  );
}

const tc = {
  sendMsg: { margin: '4px 0', padding: '8px 12px', background: '#131f2b', border: '1px solid #293340', borderRadius: '8px', borderLeft: '3px solid #5ab3ef' },
  sendMsgHeader: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  sendIcon: { color: '#aab2ba', display: 'inline-flex', alignItems: 'center' },
  sendTo: { fontSize: '13px', color: '#6c7883' },
  sendSummary: { fontSize: '12px', color: '#5ab3ef', background: '#1c2d3e', padding: '1px 8px', borderRadius: '10px' },
  sendBody: { marginTop: '6px', fontSize: '13px', color: '#e8e8e8', lineHeight: '1.5' },
  bash: { margin: '4px 0', padding: '8px 12px', background: '#131f2b', border: '1px solid #293340', borderRadius: '8px', borderLeft: '3px solid #10B981' },
  bashHeader: { display: 'flex', alignItems: 'center', gap: '8px' },
  bashIcon: { color: '#10B981', fontWeight: '700', fontFamily: 'monospace', fontSize: '14px' },
  bashDesc: { fontSize: '12px', color: '#6c7883', flex: 1 },
  bashPreview: { marginTop: '4px', fontSize: '12px', color: '#6c7883', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  bashCmd: { margin: '8px 0 0', padding: '8px', background: '#0d1923', borderRadius: '4px', fontSize: '12px', color: '#10B981', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowX: 'auto' },
  fileCard: { margin: '4px 0', padding: '6px 10px', background: '#1c2733', border: '1px solid #293340', borderRadius: '6px' },
  fileHeader: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  fileIcon: { color: '#9aa4ae', display: 'inline-flex', alignItems: 'center' },
  filePath: { fontSize: '12px', color: '#5ab3ef', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileBody: { margin: '8px 0 0', padding: '8px', width: '100%', background: '#0d1923', borderRadius: '4px', fontSize: '12px', color: '#10B981', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowX: 'auto' },
  code: { fontSize: '12px', color: '#F59E0B', fontFamily: 'monospace', background: '#1a1500', padding: '1px 6px', borderRadius: '4px' },
  diffDel: { padding: '4px 8px', background: '#2d1515', color: '#f87171', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', borderRadius: '4px', marginBottom: '4px' },
  diffAdd: { padding: '4px 8px', background: '#0f2d1a', color: '#86efac', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', borderRadius: '4px' },
  task: { display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '4px 0', padding: '8px 10px', background: '#1c2733', border: '1px solid #293340', borderRadius: '6px' },
  taskIcon: { color: '#9aa4ae', display: 'inline-flex', alignItems: 'center', flexShrink: 0 },
  taskInfo: { flex: 1, fontSize: '13px', color: '#e8e8e8' },
  taskDesc: { fontSize: '12px', color: '#6c7883', marginTop: '2px' },
  result: { margin: '4px 0', border: '1px solid #293340', borderRadius: '6px', overflow: 'hidden' },
  resultHeader: { display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 10px', background: '#17212b', border: 'none', cursor: 'pointer', textAlign: 'left' },
  resultIcon: { color: '#6c7883', fontSize: '12px' },
  resultPreview: { flex: 1, fontSize: '12px', color: '#6c7883', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  resultBody: { margin: 0, padding: '8px 12px', background: '#0d1923', fontSize: '12px', color: '#aab2ba', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '300px', overflowY: 'auto' },
  toggle: { background: 'transparent', border: 'none', color: '#6c7883', cursor: 'pointer', fontSize: '11px', padding: '0 4px', flexShrink: 0 },
  badge: { display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '2px 4px 2px 0', padding: '2px 8px', borderRadius: '10px', background: '#1c2733', color: '#5ab3ef', fontSize: '12px' },
};
