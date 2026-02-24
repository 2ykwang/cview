const SKIP_TYPES = new Set(['progress', 'system', 'file-history-snapshot', 'queue-operation']);

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

/**
 * Parse <teammate-message> tags from a user message content string.
 * color and summary are optional attributes.
 */
export function parseTeammateMessages(content) {
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

/**
 * Remove <teammate-message> tags from a content string and return the remaining text.
 */
export function stripTeammateMessages(content) {
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

/**
 * Transform an array of JSONL records for display rendering.
 * - Removes skipped types
 * - Extracts teammate-message blocks from user messages
 */
export function processMessages(records) {
  return records
    .filter(r => r && !SKIP_TYPES.has(r.type))
    .map(record => {
      if (record.type === 'user') {
        const content = typeof record.message?.content === 'string'
          ? record.message.content
          : '';
        const teammateMessages = parseTeammateMessages(content);
        const plainText = stripTeammateMessages(content);
        return {
          ...record,
          _hasTeammateMessage: teammateMessages.length > 0,
          _teammateMessages: teammateMessages,
          _plainText: plainText,
        };
      }
      return record;
    })
    .filter((record) => {
      if (record.type === 'user') return Boolean(record._plainText);
      if (record.type === 'assistant') return hasRenderableAssistantContent(record.message?.content);
      return true;
    });
}
