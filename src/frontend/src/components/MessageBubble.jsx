import { memo } from 'react';
import Avatar from './Avatar';
import ThinkingBlock from './ThinkingBlock';
import ToolCard from './ToolCard';
import ToolResult from './ToolResult';
import MarkdownRenderer from './MarkdownRenderer';
import TeammateMessage from './TeammateMessage';
import UnsupportedMessage from './UnsupportedMessage';
import AttachmentCard from './AttachmentCard';
import { fmtTime, fmtModel, hasRenderableAssistantContent } from '../utils/parseSession';
import { color, radius, space, fontSize, fontWeight } from '../styles/tokens';

function AssistantContent({ content, agentContext }) {
  if (!content) return null;
  if (typeof content === 'string') return <MarkdownRenderer style={s.md} text={content} />;
  if (!Array.isArray(content)) return null;

  const blocks = content.filter(b => b.type !== 'thinking' || b.thinking);
  if (blocks.length === 0) return null;

  return (
    <div>
      {blocks.map((block, i) => {
        if (block.type === 'thinking') return <ThinkingBlock key={i} thinking={block.thinking} />;
        if (block.type === 'text') return block.text ? <MarkdownRenderer key={i} style={s.md} text={block.text} /> : null;
        if (block.type === 'tool_use') return (
          <div key={i}>
            <ToolCard block={block} agentContext={agentContext} />
            <ToolResult result={agentContext?.toolResults?.[block.id]} name={block.name} />
          </div>
        );
        if (block.type === 'tool_result') return null;
        return null;
      })}
    </div>
  );
}

function UserContent({ content }) {
  if (typeof content === 'string') return <MarkdownRenderer style={s.userMd} text={content} />;
  if (Array.isArray(content)) {
    const text = content.filter(b => b?.type === 'text').map(b => b.text).join('\n');
    if (text.trim()) return <MarkdownRenderer style={s.userMd} text={text} />;
  }
  return null;
}

function MessageBubble({ record, isFirst = true, isLast = true, agentContext }) {
  const { type, message, timestamp, attributionAgent } = record;
  const agentName = record.agentName || 'Claude';

  if (type === 'attachment') return <AttachmentCard record={record} />;

  if (type === 'user') {
    const teammateMessages = record._teammateMessages || [];
    const plainText = record._plainText ?? null;
    const hasTeammate = teammateMessages.length > 0;
    const hasPlain = plainText !== null
      ? Boolean(plainText.trim())
      : (typeof message?.content === 'string'
          ? Boolean(message.content.trim())
          : Array.isArray(message?.content) && message.content.some(b => b?.type === 'text' && b.text?.trim()));

    if (hasTeammate) {
      return (
        <div style={{ ...s.teammateRow, marginBottom: isLast ? 16 : 6 }}>
          {teammateMessages.map((tm, i) => (
            <TeammateMessage
              key={i}
              teammateId={tm.teammateId}
              color={tm.color}
              summary={tm.summary}
              body={tm.body}
            />
          ))}
          {hasPlain && (
            <div style={s.userRowInline}>
              <div className={isLast ? 'bubble-out' : ''} style={s.userBubble}>
                <MarkdownRenderer style={s.userMd} text={plainText || ''} />
                <div style={s.userBubbleMeta}>
                  <span style={s.userBubbleTime}>{fmtTime(timestamp)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ ...s.userRow, marginBottom: isLast ? 16 : 3 }}>
        <div className={isLast ? 'bubble-out' : ''} style={s.userBubble}>
          <UserContent content={plainText !== null ? plainText : message?.content} />
          <div style={s.userBubbleMeta}>
            <span style={s.userBubbleTime}>{fmtTime(timestamp)}</span>
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
              {message?.model && <span style={s.modelTag}>{fmtModel(message.model)}</span>}
              {attributionAgent && <span style={s.attributionTag}>via {attributionAgent}</span>}
            </div>
          )}
          <div className={isLast ? 'bubble-in' : ''} style={s.bubble}>
            <AssistantContent content={message?.content} agentContext={agentContext} />
            <div style={s.bubbleMeta}>
              <span style={s.bubbleTime}>{fmtTime(timestamp)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Unknown / unsupported record type (pr-link, worktree-state, a future
  // schema, …). Surface it as a placeholder instead of dropping silently.
  return <UnsupportedMessage type={type} />;
}

const s = {
  msgRow: { display: 'flex', gap: space.px4, alignItems: 'flex-start' },
  avatarCol: { flexShrink: 0, width: 32 },
  avatarSpacer: { width: 32, height: 32 },
  msgBody: { flex: 1, minWidth: 0, maxWidth: '75%' },
  agentNameRow: { display: 'flex', alignItems: 'baseline', gap: space.px3, marginBottom: 3, paddingLeft: 2, flexWrap: 'wrap' },
  agentName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: color.accent },
  modelTag: { fontSize: fontSize.xs, color: color.textMuted, fontWeight: fontWeight.regular },
  attributionTag: {
    fontSize: fontSize.xs,
    color: color.accent,
    background: color.accentBg,
    padding: '0 6px',
    borderRadius: radius.xs,
  },
  bubble: {
    background: color.agentBubble,
    borderRadius: radius.bubbleIn,
    padding: '8px 12px',
    minWidth: 0,
    overflow: 'hidden',
  },
  md: { color: color.text, fontSize: fontSize.md, lineHeight: 1.65, wordBreak: 'break-word', overflowX: 'auto' },
  userRow: { display: 'flex', justifyContent: 'flex-end' },
  userRowInline: { display: 'flex', justifyContent: 'flex-end', marginTop: 4 },
  teammateRow: { display: 'flex', flexDirection: 'column', alignItems: 'stretch' },
  userBubble: {
    maxWidth: '75%',
    background: color.userBubble,
    color: color.userBubbleText,
    borderRadius: radius.bubbleOut,
    padding: '8px 12px',
  },
  userMd: {
    fontSize: fontSize.md,
    lineHeight: 1.65,
    wordBreak: 'break-word',
    overflowX: 'auto',
    // color inherits from userBubble (white) so markdown text reads on the blue.
  },
  bubbleMeta: { display: 'flex', justifyContent: 'flex-end', marginTop: 3 },
  bubbleTime: { fontSize: fontSize.xs, color: color.textMuted },
  userBubbleMeta: { display: 'flex', justifyContent: 'flex-end', marginTop: 3 },
  userBubbleTime: { fontSize: fontSize.xs, color: 'rgba(255, 255, 255, 0.7)' },
};

// Memoized: Messenger re-renders on capture/selection state, but a bubble's
// props (record, isFirst, isLast, memoized agentContext) are referentially
// stable — so memo skips re-rendering, and re-parsing markdown, for every other
// message on each interaction. The main win for long sessions.
export default memo(MessageBubble);
