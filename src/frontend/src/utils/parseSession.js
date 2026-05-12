const SKIP_TYPES = new Set([
  'progress',
  'system',
  'file-history-snapshot',
  'queue-operation',
  'last-prompt',
  'permission-mode',
  'ai-title',
  'attachment',
]);

export function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function fmtModel(model) {
  if (!model) return '';
  const m = model.match(/claude-(opus|sonnet|haiku)-(\d+)(?:-(\d+))?/i);
  if (!m) return model;
  const family = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  return m[3] ? `${family} ${m[2]}.${m[3]}` : `${family} ${m[2]}`;
}

export function isSameDay(a, b) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

// teammate-message tags appear in older Claude Code data (e.g. SendMessage-based teams).
// Modern subagent-only sessions don't emit these, so the parser is a no-op there.
export function parseTeammateMessages(content) {
  if (typeof content !== 'string') return [];
  const results = [];
  const regex = /<teammate-message([^>]*)>([\s\S]*?)<\/teammate-message>/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const attrsStr = match[1];
    const body = match[2].trim();
    const idMatch = attrsStr.match(/teammate_id="([^"]+)"/);
    const colorMatch = attrsStr.match(/color="([^"]+)"/);
    const summaryMatch = attrsStr.match(/summary="([^"]+)"/);
    results.push({
      teammateId: idMatch ? idMatch[1] : 'unknown',
      color: colorMatch ? colorMatch[1] : 'gray',
      summary: summaryMatch ? summaryMatch[1] : '',
      body,
    });
  }
  return results;
}

export function stripTeammateMessages(content) {
  if (typeof content !== 'string') return '';
  return content.replace(/<teammate-message[\s\S]*?<\/teammate-message>/g, '').trim();
}

export function hasRenderableAssistantContent(content) {
  if (typeof content === 'string') return content.trim().length > 0;
  if (!Array.isArray(content)) return false;

  return content.some((block) => {
    if (!block || typeof block !== 'object') return false;
    if (block.type === 'text') return typeof block.text === 'string' && block.text.trim().length > 0;
    if (block.type === 'tool_use') return true;
    return false;
  });
}

function userArrayHasText(content) {
  if (!Array.isArray(content)) return false;
  return content.some(b => b?.type === 'text' && typeof b.text === 'string' && b.text.trim().length > 0);
}

export function processMessages(records) {
  return records
    .filter(r => r && !SKIP_TYPES.has(r.type))
    .map((r) => {
      if (r.type !== 'user') return r;
      const content = r.message?.content;
      if (typeof content === 'string') {
        const teammateMessages = parseTeammateMessages(content);
        const plainText = teammateMessages.length ? stripTeammateMessages(content) : content;
        return { ...r, _teammateMessages: teammateMessages, _plainText: plainText };
      }
      return r;
    })
    .filter((r) => {
      if (r.type === 'user') {
        if (r._teammateMessages?.length) return true; // render as teammate cards
        if (r._plainText) return Boolean(r._plainText.trim());
        if (Array.isArray(r.message?.content)) return userArrayHasText(r.message.content);
        return false;
      }
      if (r.type === 'assistant') return hasRenderableAssistantContent(r.message?.content);
      return true;
    });
}
