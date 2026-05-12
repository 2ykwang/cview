import { useState, useEffect, useRef } from 'react';
import { BotIcon } from './Icon';
import { color, radius, space, fontSize, fontWeight, motion } from '../styles/tokens';
import { processMessages, fmtTime, hasRenderableAssistantContent } from '../utils/parseSession';
import MarkdownRenderer from './MarkdownRenderer';
import ThinkingBlock from './ThinkingBlock';

// Render a single tool_use block inside the subagent transcript as a tiny chip,
// not the full tool card — keeps subagent runs scannable.
function ToolChip({ block }) {
  const label = block.name || 'tool';
  return (
    <span style={chip.box}>
      <BotIcon size={11} />
      <span style={chip.label}>{label}</span>
    </span>
  );
}

function SubMessage({ record }) {
  const isUser = record.type === 'user';
  const ts = record.timestamp;

  if (isUser) {
    const text = typeof record.message?.content === 'string'
      ? record.message.content
      : (Array.isArray(record.message?.content)
          ? record.message.content.filter(b => b?.type === 'text').map(b => b.text).join('\n')
          : '');
    if (!text.trim()) return null;
    return (
      <div style={msg.userRow}>
        <div style={msg.userBubble}>
          <MarkdownRenderer style={msg.md} text={text} />
          <div style={msg.metaRight}>{fmtTime(ts)}</div>
        </div>
      </div>
    );
  }

  if (!hasRenderableAssistantContent(record.message?.content)) return null;
  const content = record.message?.content;
  const blocks = Array.isArray(content) ? content : null;

  return (
    <div style={msg.agentRow}>
      <div style={msg.agentBubble}>
        {typeof content === 'string'
          ? <MarkdownRenderer style={msg.md} text={content} />
          : (blocks || []).map((b, i) => {
              if (b.type === 'thinking') return <ThinkingBlock key={i} thinking={b.thinking} />;
              if (b.type === 'text') return b.text ? <MarkdownRenderer key={i} style={msg.md} text={b.text} /> : null;
              if (b.type === 'tool_use') return <ToolChip key={i} block={b} />;
              return null;
            })
        }
        <div style={msg.metaLeft}>{fmtTime(ts)}</div>
      </div>
    </div>
  );
}

export default function SubagentExpander({ project, masterSessionId, agentId, agentType, description }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    if (!open || !agentId) return;
    setLoading(true);
    const url = `/api/projects/${encodeURIComponent(project)}/sessions/${encodeURIComponent(masterSessionId)}/subagents/${encodeURIComponent(agentId)}/stream`;
    const es = new EventSource(url);
    esRef.current = es;
    es.onmessage = (e) => {
      try { setMessages(processMessages(JSON.parse(e.data))); }
      catch { /* ignore */ }
      setLoading(false);
    };
    es.onerror = () => { setLoading(false); es.close(); };
    return () => es.close();
  }, [open, project, masterSessionId, agentId]);

  const canExpand = Boolean(agentId);
  const headerTitle = description || (agentType ? `${agentType} run` : 'Subagent');

  return (
    <div style={s.card}>
      <button
        type="button"
        style={s.header}
        disabled={!canExpand}
        onClick={() => canExpand && setOpen(v => !v)}
        title={canExpand ? (open ? 'Collapse subagent transcript' : 'Expand subagent transcript') : 'No linked transcript'}
      >
        <span style={s.icon}><BotIcon size={14} /></span>
        <span style={s.titleRow}>
          {agentType && <span style={s.typeTag}>{agentType}</span>}
          <span style={s.desc}>{headerTitle}</span>
        </span>
        <span style={s.chev}>{canExpand ? (open ? '▾' : '▸') : '—'}</span>
      </button>
      {open && (
        <div style={s.body}>
          {loading && messages.length === 0 && <div style={s.hint}>Loading transcript...</div>}
          {messages.length === 0 && !loading && <div style={s.hint}>Empty transcript</div>}
          {messages.map((m, i) => <SubMessage key={m.uuid || i} record={m} />)}
        </div>
      )}
    </div>
  );
}

const s = {
  card: {
    margin: '6px 0',
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderLeft: `3px solid ${color.toolAgent}`,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: space.px4,
    width: '100%',
    padding: `${space.px4}px ${space.px5}px`,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: color.text,
    textAlign: 'left',
    transition: `background ${motion.fast}`,
  },
  icon: { color: color.toolAgent, display: 'inline-flex', alignItems: 'center', flexShrink: 0 },
  titleRow: { flex: 1, display: 'flex', alignItems: 'center', gap: space.px4, minWidth: 0 },
  typeTag: {
    fontSize: fontSize.xs,
    color: color.accent,
    background: color.accentBg,
    border: `1px solid ${color.accent}`,
    padding: '1px 6px',
    borderRadius: radius.xs,
    fontWeight: fontWeight.semibold,
    flexShrink: 0,
  },
  desc: { fontSize: fontSize.base, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  chev: { color: color.textMuted, fontSize: fontSize.xs, flexShrink: 0 },
  body: {
    padding: space.px5,
    background: color.bgAlt,
    borderTop: `1px solid ${color.border}`,
    maxHeight: 480,
    overflowY: 'auto',
  },
  hint: { padding: space.px5, color: color.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
};

const msg = {
  userRow: { display: 'flex', justifyContent: 'flex-end', marginBottom: 6 },
  userBubble: {
    maxWidth: '85%',
    background: color.userBubble,
    borderRadius: radius.bubbleOut,
    padding: '6px 10px',
    fontSize: fontSize.base,
    color: color.userBubbleText,
  },
  agentRow: { display: 'flex', justifyContent: 'flex-start', marginBottom: 6 },
  agentBubble: {
    maxWidth: '90%',
    background: color.agentBubble,
    borderRadius: radius.bubbleIn,
    padding: '6px 10px',
    fontSize: fontSize.base,
    color: color.text,
  },
  md: { fontSize: fontSize.base, lineHeight: 1.5, wordBreak: 'break-word' },
  metaLeft: { fontSize: fontSize.xs, color: color.textMuted, marginTop: 2 },
  metaRight: { fontSize: fontSize.xs, color: 'rgba(255, 255, 255, 0.7)', marginTop: 2, textAlign: 'right' },
};

const chip = {
  box: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    margin: '2px 4px 2px 0',
    padding: '1px 7px',
    borderRadius: radius.pill,
    background: color.bgAlt,
    color: color.textDim,
    border: `1px solid ${color.border}`,
    fontSize: fontSize.xs,
  },
  label: { fontWeight: fontWeight.medium },
};
