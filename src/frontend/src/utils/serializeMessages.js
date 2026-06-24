// Serialize rendered chat records to markdown text for clipboard copy.
// Mirrors what the bubbles show, minus internals: thinking blocks and context
// attachments are dropped, tool calls collapse to a one-line summary. The id
// derivation (uuid || `msg-${i}`) matches Messenger's msgIds so a `selectedIds`
// Set from capture mode filters to the chosen turns.

function recordId(r, i) {
  return r?.uuid || `msg-${i}`;
}

// One-line summary of a tool_use block: "Bash: npm run build", "Read: a.js".
function toolSummary(block) {
  const name = block.name || 'Tool';
  const i = block.input || {};
  let arg = i.command ?? i.file_path ?? i.path ?? i.pattern ?? i.description ?? '';
  arg = String(arg).split('\n')[0];
  const truncated = arg.length > 120;
  arg = arg.slice(0, 120) + (truncated ? '…' : '');
  return arg ? `${name}: ${arg}` : name;
}

function userText(r) {
  if (r._teammateMessages?.length) {
    return r._teammateMessages
      .map((t) => `> [${t.teammateId}] ${t.summary}`.trim() + (t.body ? `\n${t.body}` : ''))
      .join('\n\n');
  }
  if (r._plainText) return r._plainText;
  const c = r.message?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.filter((b) => b?.type === 'text').map((b) => b.text).join('\n');
  return '';
}

function assistantText(r) {
  const c = r.message?.content;
  if (typeof c === 'string') return c;
  if (!Array.isArray(c)) return '';
  const parts = [];
  for (const b of c) {
    if (b?.type === 'text' && b.text?.trim()) parts.push(b.text.trim());
    else if (b?.type === 'tool_use') parts.push(`> 🔧 ${toolSummary(b)}`);
    // thinking blocks are intentionally omitted.
  }
  return parts.join('\n\n');
}

export function serializeMessages(records, selectedIds = null) {
  const blocks = [];
  records.forEach((r, i) => {
    if (!r) return;
    if (selectedIds && !selectedIds.has(recordId(r, i))) return;
    if (r.type === 'user') {
      const t = userText(r).trim();
      if (t) blocks.push(`**You:**\n${t}`);
    } else if (r.type === 'assistant') {
      const t = assistantText(r).trim();
      if (t) blocks.push(`**${r.agentName || 'Claude'}:**\n${t}`);
    }
    // attachments and metadata records are dropped from text copy.
  });
  return blocks.join('\n\n');
}
