import { useState } from 'react';
import { getAvatarColor } from './Avatar';
import MarkdownRenderer from './MarkdownRenderer';
import SubagentExpander from './SubagentExpander';
import { color, radius, space, fontSize, fontWeight, motion, font } from '../styles/tokens';
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
  return <strong style={{ color: getAvatarColor(name) }}>@{name}</strong>;
}

export function shortPath(p) {
  if (!p) return '';
  return p.replace(/^\/Users\/[^/]+/, '~');
}

const mdWrap = { color: color.text, fontSize: fontSize.md, lineHeight: 1.55, wordBreak: 'break-word', overflowX: 'auto' };

export default function ToolCard({ block, agentContext }) {
  const [open, setOpen] = useState(true);
  const { name, input = {} } = block;

  if (name === 'Agent' || name === 'Task') {
    const desc = input.description || '';
    const subagentType = input.subagent_type || input.name || null;
    const matched = agentContext?.matchedSubagents?.[block.id] || null;
    if (agentContext?.project && agentContext?.masterSessionId) {
      return (
        <SubagentExpander
          project={agentContext.project}
          masterSessionId={agentContext.masterSessionId}
          agentId={matched?.agentId || null}
          agentType={matched?.agentType || subagentType}
          description={matched?.description || desc}
        />
      );
    }
    // Fallback: no master/project context (e.g., transcript view) — render a compact info card.
    return (
      <div style={tc.agent}>
        <span style={tc.agentIcon}><BotIcon size={14} /></span>
        <div style={tc.agentInfo}>
          <div>
            <strong>{subagentType || 'Agent'}</strong>
            {desc ? ` · ${desc}` : ''}
          </div>
        </div>
      </div>
    );
  }

  if (name === 'SendMessage') {
    const recipient = input.to || input.recipient;
    const msgType = input.type || '';
    const isShutdown = msgType.includes('shutdown');
    const isBroadcast = msgType === 'broadcast';
    return (
      <div style={tc.sendMsg}>
        <div style={tc.sendMsgHeader}>
          <span style={tc.sendIcon}>
            {isShutdown ? <PowerIcon size={14} /> : isBroadcast ? <MegaphoneIcon size={14} /> : <SendIcon size={14} />}
          </span>
          <span style={tc.sendTo}>→ <Mention name={recipient} /></span>
          {input.summary && <span style={tc.sendSummary}>{input.summary}</span>}
        </div>
        {(input.message || input.content) && (
          <MarkdownRenderer style={{ ...tc.sendBody, ...mdWrap }} text={input.message || input.content} />
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
          <button style={tc.toggle} onClick={() => setOpen(o => !o)} title={open ? 'Collapse' : 'Expand'}>{open ? '▾' : '▸'}</button>
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
            <button style={tc.toggle} onClick={() => setOpen(o => !o)} title={open ? 'Collapse' : 'Expand'}>{open ? '▾' : '▸'}</button>
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
          <button style={tc.toggle} onClick={() => setOpen(o => !o)} title={open ? 'Collapse' : 'Expand'}>{open ? '▾' : '▸'}</button>
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
    const statusColor = { completed: color.success, in_progress: color.warning, deleted: color.danger }[input.status] || color.textDim;
    return (
      <div style={tc.task}>
        <span style={tc.taskIcon}><RefreshIcon size={14} /></span>
        <div>Task <strong>#{input.taskId}</strong> →{' '}
          <span style={{ color: statusColor, fontWeight: fontWeight.semibold }}>{input.status || input.owner || 'updated'}</span>
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
    <span style={tc.badge} title={name}>
      <WrenchIcon size={12} />
      {name}
    </span>
  );
}

const tc = {
  agent: {
    margin: '4px 0',
    padding: `${space.px4}px ${space.px5}px`,
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderLeft: `3px solid ${color.toolAgent}`,
    borderRadius: radius.md,
    display: 'flex', alignItems: 'flex-start', gap: space.px4,
  },
  agentIcon: { color: color.toolAgent, display: 'inline-flex', alignItems: 'center', flexShrink: 0, marginTop: 2 },
  agentInfo: { flex: 1, fontSize: fontSize.base, color: color.text },

  sendMsg: {
    margin: '4px 0',
    padding: `${space.px4}px ${space.px5}px`,
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderLeft: `3px solid ${color.toolSend}`,
    borderRadius: radius.md,
  },
  sendMsgHeader: { display: 'flex', alignItems: 'center', gap: space.px4, flexWrap: 'wrap' },
  sendIcon: { color: color.textDim, display: 'inline-flex', alignItems: 'center' },
  sendTo: { fontSize: fontSize.base, color: color.textMuted },
  sendSummary: {
    fontSize: fontSize.sm,
    color: color.accent,
    background: color.accentBg,
    padding: '1px 8px',
    borderRadius: radius.pill,
  },
  sendBody: { marginTop: 6, fontSize: fontSize.base, color: color.text, lineHeight: 1.5 },

  bash: {
    margin: '4px 0',
    padding: `${space.px4}px ${space.px5}px`,
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderLeft: `3px solid ${color.toolBash}`,
    borderRadius: radius.md,
  },
  bashHeader: { display: 'flex', alignItems: 'center', gap: space.px4 },
  bashIcon: { color: color.textDim, fontWeight: fontWeight.bold, fontFamily: font.mono, fontSize: fontSize.md },
  bashDesc: { fontSize: fontSize.sm, color: color.textMuted, flex: 1 },
  bashPreview: { marginTop: 4, fontSize: fontSize.sm, color: color.textMuted, fontFamily: font.mono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  bashCmd: {
    margin: '8px 0 0',
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
  },

  fileCard: {
    margin: '4px 0',
    padding: '6px 10px',
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderLeft: `3px solid ${color.toolFile}`,
    borderRadius: radius.md,
  },
  fileHeader: { display: 'flex', alignItems: 'center', gap: space.px3, flexWrap: 'wrap' },
  fileIcon: { color: color.textDim, display: 'inline-flex', alignItems: 'center' },
  filePath: { fontSize: fontSize.sm, color: color.accent, fontFamily: font.mono, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileBody: {
    margin: '8px 0 0',
    padding: '8px 10px',
    width: '100%',
    background: color.codeBg,
    borderRadius: radius.sm,
    fontSize: fontSize.sm,
    color: color.text,
    fontFamily: font.mono,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    overflowX: 'auto',
    border: `1px solid ${color.border}`,
  },
  code: {
    fontSize: fontSize.sm,
    color: color.codeFg,
    fontFamily: font.mono,
    background: color.codeBg,
    border: `1px solid ${color.border}`,
    padding: '1px 6px',
    borderRadius: radius.xs,
  },
  diffDel: {
    padding: '4px 8px',
    background: color.diffDelBg,
    color: color.diffDelFg,
    fontSize: fontSize.sm,
    fontFamily: font.mono,
    whiteSpace: 'pre-wrap',
    borderRadius: radius.xs,
    marginBottom: 4,
  },
  diffAdd: {
    padding: '4px 8px',
    background: color.diffAddBg,
    color: color.diffAddFg,
    fontSize: fontSize.sm,
    fontFamily: font.mono,
    whiteSpace: 'pre-wrap',
    borderRadius: radius.xs,
  },
  task: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: space.px4,
    margin: '4px 0',
    padding: `${space.px4}px ${space.px5}px`,
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
  },
  taskIcon: { color: color.textDim, display: 'inline-flex', alignItems: 'center', flexShrink: 0 },
  taskInfo: { flex: 1, fontSize: fontSize.base, color: color.text },
  taskDesc: { fontSize: fontSize.sm, color: color.textMuted, marginTop: 2 },
  toggle: {
    background: 'transparent',
    border: 'none',
    color: color.textMuted,
    cursor: 'pointer',
    fontSize: fontSize.xs,
    padding: '0 4px',
    flexShrink: 0,
    transition: `color ${motion.fast}`,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.px3,
    margin: '2px 4px 2px 0',
    padding: '2px 8px',
    borderRadius: radius.pill,
    background: color.surface,
    color: color.accent,
    fontSize: fontSize.sm,
    border: `1px solid ${color.border}`,
  },
};
