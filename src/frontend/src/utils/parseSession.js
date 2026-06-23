import { tokenize, getDisplayText } from '@shared/messageTokenizer.js';
import { STREAM_SKIP_TYPES } from '@shared/index.js';

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

// Phase 10: tokenizer segment 에서 teammate-message envelope 만 추출하여 카드 props 매핑.
function extractTeammateMessages(segments) {
  const results = [];
  for (const s of segments) {
    if (s && s.kind === 'envelope' && s.name === 'teammate-message') {
      const attrs = s.attrs || {};
      results.push({
        teammateId: attrs.teammate_id || 'unknown',
        color: attrs.color || 'gray',
        summary: attrs.summary || '',
        body: (s.inner || '').trim(),
      });
    }
  }
  return results;
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
    .filter(r => r && !STREAM_SKIP_TYPES.has(r.type))
    .map((r) => {
      if (r.type !== 'user') return r;
      const content = r.message?.content;
      if (typeof content !== 'string') return r;
      // tokenize 후 derive — _teammateMessages / _plainText 는 MessageBubble 의 기존
      // 분기와 호환 (segment kind 의 결과물).
      const segments = tokenize(content);
      const teammateMessages = extractTeammateMessages(segments);
      const plainText = getDisplayText(segments).trim();
      return { ...r, _segments: segments, _teammateMessages: teammateMessages, _plainText: plainText };
    })
    .filter((r) => {
      if (r.type === 'user') {
        if (r._teammateMessages?.length) return true;
        if (r._plainText) return Boolean(r._plainText.trim());
        if (Array.isArray(r.message?.content)) return userArrayHasText(r.message.content);
        return false;
      }
      if (r.type === 'assistant') return hasRenderableAssistantContent(r.message?.content);
      return true;
    });
}

// tool_use.id → toolUseResult, built from RAW records (before processMessages,
// which drops tool_result-only user turns). The result rides on the user record
// that follows a tool_use; pair them via the tool_result block's tool_use_id.
export function buildToolResults(records) {
  const map = {};
  if (!Array.isArray(records)) return map;
  for (const r of records) {
    if (r?.type !== 'user' || r.toolUseResult === undefined) continue;
    const content = r.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b?.type === 'tool_result' && b.tool_use_id) map[b.tool_use_id] = r.toolUseResult;
    }
  }
  return map;
}
