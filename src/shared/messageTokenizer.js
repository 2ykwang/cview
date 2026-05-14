// === 새 envelope 추가 절차 ===
// 1. ENVELOPE_REGISTRY 배열에 한 줄 추가:
//      { name: '<tag-name>', behavior: 'drop' | 'render' | 'inline' }
// 2. behavior === 'render' 면 컴포넌트 매핑을 MessageBubble (Phase 10) 에 추가.
// 3. 끝. tokenize / getDisplayText / getSearchableText / getPreviewText / 서버
//    검색 인덱스 모두 자동 반영.
//
// === ENVELOPE_REGISTRY 자료구조 lock-in ===
// Array (not Map / Object). 엔트리당 정확히 두 필드: name (string), behavior (enum).
// name 중복 금지.
//
// === Segment shape (평탄 — inner 재귀 토큰화 금지) ===
//   { kind: 'text',         text: string }
//   { kind: 'envelope',     name: string, attrs: object, inner: string }
//   { kind: 'tool_use',     id: string, name: string, input: object }
//   { kind: 'tool_result',  tool_use_id: string, text: string }
//
// === Behavior 매핑 (helper 출력) ===
//   getDisplayText:    drop / render 제외, inline 포함, text 포함
//   getSearchableText: drop 제거 (name + inner), render / inline 의 inner 포함, text 포함,
//                      tool_use.input.command + input.file_path + input.pattern, tool_result.text 포함
//   getPreviewText:    마지막 text 우선, 없으면 마지막 tool_use 의 name 요약, 빈 배열 → ''

export const ENVELOPE_REGISTRY = Object.freeze([
  Object.freeze({ name: 'teammate-message',     behavior: 'render' }),
  Object.freeze({ name: 'local-command-caveat', behavior: 'drop' }),
  Object.freeze({ name: 'command-message',      behavior: 'drop' }),
  Object.freeze({ name: 'command-name',         behavior: 'drop' }),
  Object.freeze({ name: 'command-args',         behavior: 'drop' }),
  Object.freeze({ name: 'local-command-stdout', behavior: 'inline' }),
]);

const REGISTRY_BEHAVIOR = new Map(ENVELOPE_REGISTRY.map(e => [e.name, e.behavior]));

function parseAttrs(attrsStr) {
  const attrs = {};
  if (!attrsStr) return attrs;
  const rx = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = rx.exec(attrsStr)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function tokenizeString(text) {
  // 등록된 모든 envelope name 별로 매치 위치 수집 → start 정렬 → 겹침 제거 →
  // 매치 사이 text segment 채움. backreference 대신 name 별 별개 정규식이라
  // mismatched (`<a>...</b>`) 매칭 안 됨. 단 같은 name 의 lazy 매칭은 첫
  // 닫는 태그까지라 nested same-name 의 outer 가 over-strip 가능 (FUTURE 항목).
  const matches = [];
  for (const { name } of ENVELOPE_REGISTRY) {
    const rx = new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)</${name}>`, 'g');
    let m;
    while ((m = rx.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        name,
        attrsStr: m[1],
        inner: m[2],
      });
    }
  }
  matches.sort((a, b) => a.start - b.start);

  const accepted = [];
  let lastEnd = 0;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      accepted.push(m);
      lastEnd = m.end;
    }
  }

  if (accepted.length === 0) {
    return [{ kind: 'text', text }];
  }

  const segments = [];
  let cursor = 0;
  for (const m of accepted) {
    if (m.start > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, m.start) });
    }
    segments.push({
      kind: 'envelope',
      name: m.name,
      attrs: parseAttrs(m.attrsStr),
      inner: m.inner,
    });
    cursor = m.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) });
  }
  return segments;
}

function tokenizeBlocks(blocks) {
  const out = [];
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text') {
      // text block 안에도 envelope 가 들어있을 수 있으므로 string 분기로 위임 (assistant text 안 envelope 누설 차단).
      const text = typeof b.text === 'string' ? b.text : '';
      out.push(...tokenizeString(text));
    } else if (b.type === 'tool_use') {
      out.push({
        kind: 'tool_use',
        id: b.id,
        name: b.name,
        input: b.input || {},
      });
    } else if (b.type === 'tool_result') {
      let text = '';
      if (typeof b.content === 'string') {
        text = b.content;
      } else if (Array.isArray(b.content)) {
        // text block 의 .text + tool_reference 의 .tool_name 도 결합 (검색 누락 차단).
        text = b.content
          .map(c => {
            if (!c || typeof c !== 'object') return '';
            if (c.type === 'text' && typeof c.text === 'string') return c.text;
            if (c.type === 'tool_reference' && typeof c.tool_name === 'string') return c.tool_name;
            return '';
          })
          .filter(Boolean)
          .join('');
      }
      out.push({
        kind: 'tool_result',
        tool_use_id: b.tool_use_id,
        text,
      });
    }
    // image / thinking / 그 외 block type 은 silently drop (Phase 4 미정 영역).
  }
  return out;
}

export function tokenize(content) {
  if (content === null || content === undefined) return [];
  if (typeof content === 'string') return tokenizeString(content);
  if (Array.isArray(content)) return tokenizeBlocks(content);
  return [];
}

export function getDisplayText(segments) {
  if (!Array.isArray(segments)) return '';
  const parts = [];
  for (const s of segments) {
    if (!s) continue;
    if (s.kind === 'text') {
      if (s.text) parts.push(s.text);
    } else if (s.kind === 'envelope') {
      const behavior = REGISTRY_BEHAVIOR.get(s.name);
      if (behavior === 'inline' && s.inner) parts.push(s.inner);
      // drop / render: skip
    }
    // tool_use / tool_result: skip in display (handled by ToolCard)
  }
  return parts.join('');
}

export function getSearchableText(segments) {
  if (!Array.isArray(segments)) return '';
  const parts = [];
  for (const s of segments) {
    if (!s) continue;
    if (s.kind === 'text') {
      if (s.text) parts.push(s.text);
    } else if (s.kind === 'envelope') {
      const behavior = REGISTRY_BEHAVIOR.get(s.name);
      if (behavior === 'drop') continue;
      if (s.inner) parts.push(s.inner);
    } else if (s.kind === 'tool_use') {
      const input = s.input || {};
      if (input.command) parts.push(input.command);
      if (input.file_path) parts.push(input.file_path);
      if (input.pattern) parts.push(input.pattern);
    } else if (s.kind === 'tool_result') {
      if (s.text) parts.push(s.text);
    }
  }
  return parts.join(' ');
}

export function getPreviewText(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return '';
  // 마지막 text segment (drop 제외 — text 자체는 drop 분류 없음, envelope 만 drop)
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (s && s.kind === 'text' && s.text) return s.text;
  }
  // text 없으면 마지막 tool_use 의 name + input 요약
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (s && s.kind === 'tool_use') {
      const input = s.input || {};
      const summary = input.command || input.file_path || input.pattern || '';
      return summary ? `${s.name}: ${summary}` : (s.name || '');
    }
  }
  return '';
}
