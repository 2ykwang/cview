import Avatar from './Avatar';
import ThinkingBlock from './ThinkingBlock';
import ToolCard from './ToolCard';
import MarkdownRenderer from './MarkdownRenderer';
import { fmtTime, fmtModel, hasRenderableAssistantContent } from '../utils/parseSession';

function AssistantContent({ content }) {
  if (!content) return null;

  if (typeof content === 'string') {
    return <MarkdownRenderer style={s.mdWrap} text={content} />;
  }

  if (!Array.isArray(content)) return null;

  const blocks = content.filter(b => b.type !== 'thinking');
  if (blocks.length === 0) return null;

  return (
    <div>
      {blocks.map((block, i) => {
        if (block.type === 'thinking') return <ThinkingBlock key={i} thinking={block.thinking} />;
        if (block.type === 'text') {
          return block.text
            ? <MarkdownRenderer key={i} style={s.mdWrap} text={block.text} />
            : null;
        }
        if (block.type === 'tool_use') return <ToolCard key={i} block={block} />;
        if (block.type === 'tool_result') return null;
        return null;
      })}
    </div>
  );
}

// isFirst/isLast are used by the parent (Messenger.jsx) for consecutive same-sender grouping
export default function MessageBubble({ record, isFirst = true, isLast = true }) {
  const { type, message, timestamp, _plainText } = record;
  const agentName = record.agentName || 'Claude';

  if (type === 'user') {
    if (!_plainText) return null;
    return (
      <div style={{ ...s.userRow, marginBottom: isLast ? 16 : 3 }}>
        <div className={isLast ? 'bubble-out' : ''} style={s.userBubble}>
          <MarkdownRenderer style={s.mdWrap} text={_plainText} />
          <div style={s.bubbleMeta}>
            <span style={s.bubbleTime}>{fmtTime(timestamp)}</span>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'assistant') {
    if (!hasRenderableAssistantContent(message?.content)) return null;
    return (
      <div style={{ ...s.msgRow, marginBottom: isLast ? 16 : 3 }}>
        <div style={s.avatarCol}>
          {isFirst ? <Avatar agentName={agentName} size={32} /> : <div style={s.avatarSpacer} />}
        </div>
        <div style={s.msgBody}>
          {isFirst && (
            <div style={s.agentNameRow}>
              <span style={s.agentName}>{agentName}</span>
              {message?.model && <span style={s.modelTag}>({fmtModel(message.model)})</span>}
            </div>
          )}
          <div className={isLast ? 'bubble-in' : ''} style={s.bubble}>
            <AssistantContent content={message?.content} />
            <div style={s.bubbleMeta}>
              <span style={s.bubbleTime}>{fmtTime(timestamp)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const s = {
  msgRow: { display: 'flex', gap: '8px', alignItems: 'flex-start' },
  avatarCol: { flexShrink: 0, width: 32 },
  avatarSpacer: { width: 32, height: 32 },
  msgBody: { flex: 1, minWidth: 0, maxWidth: '75%' },
  agentNameRow: { display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '3px', paddingLeft: '2px' },
  agentName: { fontSize: '13px', fontWeight: '600', color: '#5ab3ef' },
  modelTag: { fontSize: '11px', color: '#6c7883', fontWeight: '400' },
  bubble: { background: '#232e3c', borderRadius: '6px 18px 18px 18px', padding: '8px 12px', minWidth: 0, overflow: 'hidden' },
  mdWrap: { color: '#e8e8e8', fontSize: '14px', lineHeight: '1.65', wordBreak: 'break-word', overflowX: 'auto' },
  userRow: { display: 'flex', justifyContent: 'flex-end' },
  userBubble: { maxWidth: '75%', background: '#2b5278', borderRadius: '18px 6px 18px 18px', padding: '8px 12px' },
  bubbleMeta: { display: 'flex', justifyContent: 'flex-end', marginTop: '3px' },
  bubbleTime: { fontSize: '11px', color: '#6c7883' },
};
