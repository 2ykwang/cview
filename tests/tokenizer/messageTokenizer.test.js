// Stub-only interface tests for src/shared/messageTokenizer.js (Phase 4).
// All assertions wrapped in `test()` because the module is a stub that
// throws on every call. Phase 8 implements the module — `.fails` modifier
// MUST be removed at that point (see PROMPT iteration procedure STEP 3
// sub-item 5 and INVENTORY policy box).

import { describe, test, expect } from 'vitest';
import {
  tokenize,
  getDisplayText,
  getSearchableText,
  getPreviewText,
  ENVELOPE_REGISTRY,
} from '@shared/messageTokenizer.js';

describe('Setup sentinels (must pass)', () => {
  test('module exports four helpers + ENVELOPE_REGISTRY (Array)', () => {
    expect(typeof tokenize).toBe('function');
    expect(typeof getDisplayText).toBe('function');
    expect(typeof getSearchableText).toBe('function');
    expect(typeof getPreviewText).toBe('function');
    expect(Array.isArray(ENVELOPE_REGISTRY)).toBe(true);
  });
});

describe('tokenize() — 입력별 segment 시퀀스 (Phase 8 통과 후 .fails 제거)', () => {
  test('plain string → length 1, [text]', () => {
    const segments = tokenize('plain text');
    expect(segments.length).toBe(1);
    expect(segments[0].kind).toBe('text');
    expect(segments[0].text).toBe('plain text');
  });

  test('string + envelope at start → length 2, [envelope, text] 순서, attrs object', () => {
    const segments = tokenize('<command-message>m</command-message>\nhello');
    expect(segments.length).toBe(2);
    expect(segments[0].kind).toBe('envelope');
    expect(segments[0].name).toBe('command-message');
    expect(segments[0].inner).toBe('m');
    expect(typeof segments[0].attrs).toBe('object');
    expect(segments[0].attrs).not.toBeNull();
    expect(segments[1].kind).toBe('text');
    expect(segments[1].text).toMatch(/hello/);
  });

  test('string + envelope in middle → 3 segments [text, envelope, text]', () => {
    const segments = tokenize('before <command-message>m</command-message> after');
    expect(segments.length).toBe(3);
    expect(segments[0].kind).toBe('text');
    expect(segments[0].text).toMatch(/^before/);
    expect(segments[1].kind).toBe('envelope');
    expect(segments[1].name).toBe('command-message');
    expect(segments[2].kind).toBe('text');
    expect(segments[2].text).toMatch(/after$/);
  });

  test('block array [text, tool_use] → 같은 순서, 같은 데이터', () => {
    const segments = tokenize([
      { type: 'text', text: 'before' },
      { type: 'tool_use', id: 'u1', name: 'Bash', input: { command: 'ls' } },
    ]);
    expect(segments.length).toBe(2);
    expect(segments[0].kind).toBe('text');
    expect(segments[0].text).toBe('before');
    expect(segments[1].kind).toBe('tool_use');
    expect(segments[1].id).toBe('u1');
    expect(segments[1].name).toBe('Bash');
    expect(segments[1].input.command).toBe('ls');
  });

  test('block array [tool_result] (string content) → {kind, tool_use_id, text}', () => {
    const segments = tokenize([
      { type: 'tool_result', tool_use_id: 'u1', content: 'wrote csv data' },
    ]);
    expect(segments.length).toBe(1);
    expect(segments[0].kind).toBe('tool_result');
    expect(segments[0].tool_use_id).toBe('u1');
    expect(segments[0].text).toBe('wrote csv data');
  });

  test('block array [tool_result] (array content [{type:text,text}]) → text 결합', () => {
    const segments = tokenize([
      { type: 'tool_result', tool_use_id: 'u2', content: [{ type: 'text', text: 'piece A' }, { type: 'text', text: 'piece B' }] },
    ]);
    expect(segments.length).toBe(1);
    expect(segments[0].kind).toBe('tool_result');
    expect(segments[0].text).toContain('piece A');
    expect(segments[0].text).toContain('piece B');
  });

  test('null content → 빈 배열', () => {
    expect(tokenize(null)).toEqual([]);
  });

  test('undefined content → 빈 배열', () => {
    expect(tokenize(undefined)).toEqual([]);
  });

  test('idempotent: 동일 입력 → 동일 결과 (stateless)', () => {
    const input = '<command-message>m</command-message>\nhello';
    expect(tokenize(input)).toEqual(tokenize(input));
  });
});

describe('envelope behavior 분류 (drop / render / inline) + 출력 타입', () => {
  test('drop: getDisplayText string, name/inner 모두 미포함', () => {
    const segments = [
      { kind: 'envelope', name: 'command-message', attrs: {}, inner: 'inner-XYZ-DROP' },
      { kind: 'text', text: 'hello' },
    ];
    const display = getDisplayText(segments);
    expect(typeof display).toBe('string');
    expect(display).not.toContain('command-message');
    expect(display).not.toContain('inner-XYZ-DROP');
    expect(display).toContain('hello');
  });

  test('render (teammate-message): getDisplayText 에 inner 미포함 (별도 카드 렌더용)', () => {
    const segments = [
      { kind: 'envelope', name: 'teammate-message', attrs: { teammate_id: 't1' }, inner: 'tm-body-RENDER' },
      { kind: 'text', text: 'rest' },
    ];
    const display = getDisplayText(segments);
    expect(typeof display).toBe('string');
    expect(display).not.toContain('tm-body-RENDER');
    expect(display).toContain('rest');
  });

  test('inline (local-command-stdout): getDisplayText 에 inner 포함', () => {
    const segments = [
      { kind: 'envelope', name: 'local-command-stdout', attrs: {}, inner: 'stdout-INLINE' },
      { kind: 'text', text: 'hello' },
    ];
    const display = getDisplayText(segments);
    expect(typeof display).toBe('string');
    expect(display).toContain('stdout-INLINE');
    expect(display).toContain('hello');
  });

  test('drop: getSearchableText 도 string, name/inner 미포함', () => {
    const segments = [
      { kind: 'envelope', name: 'command-message', attrs: {}, inner: 'inner-SX-DROP' },
      { kind: 'text', text: 'searchable-body-ABC' },
    ];
    const sx = getSearchableText(segments);
    expect(typeof sx).toBe('string');
    expect(sx).toContain('searchable-body-ABC');
    expect(sx).not.toContain('inner-SX-DROP');
    expect(sx).not.toContain('command-message');
  });
});

describe('tool_use input / tool_result text 의 searchable 포함', () => {
  test('Bash tool_use.input.command → searchable', () => {
    const segments = [{
      kind: 'tool_use', id: 'u1', name: 'Bash',
      input: { command: 'python export.py --format csv' },
    }];
    expect(getSearchableText(segments)).toContain('csv');
  });

  test('Read tool_use.input.file_path → searchable', () => {
    const segments = [{
      kind: 'tool_use', id: 'u2', name: 'Read',
      input: { file_path: '/tmp/output.csv' },
    }];
    expect(getSearchableText(segments)).toContain('csv');
  });

  test('Grep tool_use.input.pattern → searchable', () => {
    const segments = [{
      kind: 'tool_use', id: 'u3', name: 'Grep',
      input: { pattern: 'csv-pattern-XYZ', path: '/tmp' },
    }];
    expect(getSearchableText(segments)).toContain('csv-pattern-XYZ');
  });

  test('tool_result.text → searchable', () => {
    const segments = [{
      kind: 'tool_result', tool_use_id: 'u1', text: 'wrote csv data',
    }];
    expect(getSearchableText(segments)).toContain('csv');
  });
});

describe('알 수 없는 태그는 envelope 아닌 text (false positive 방지)', () => {
  test('등록되지 않은 <foo> 태그는 text segment 들로 raw 보존', () => {
    const segments = tokenize('<foo>bar</foo>');
    const types = segments.map(s => s.kind);
    expect(types).not.toContain('envelope');
    expect(types).toContain('text');
    const fullText = segments.filter(s => s.kind === 'text').map(s => s.text).join('');
    expect(fullText).toContain('<foo>bar</foo>');
  });
});

describe('ENVELOPE_REGISTRY shape 강제', () => {
  test('REGISTRY length > 0, 엔트리당 name(string) + behavior(enum) 필드', () => {
    expect(ENVELOPE_REGISTRY.length).toBeGreaterThan(0);
    for (const entry of ENVELOPE_REGISTRY) {
      expect(typeof entry.name).toBe('string');
      expect(['drop', 'render', 'inline']).toContain(entry.behavior);
    }
  });

  test('REGISTRY 안 envelope name 중복 금지', () => {
    // length > 0 가드는 첫 단언 (REGISTRY shape) 에서 이미 보장됨 — 여기는 중복만 검사.
    const names = ENVELOPE_REGISTRY.map(e => e.name);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });

  test('알려진 envelope 6종 모두 등록', () => {
    const names = new Set(ENVELOPE_REGISTRY.map(e => e.name));
    for (const expected of [
      'command-message', 'command-name', 'command-args',
      'local-command-caveat', 'local-command-stdout', 'teammate-message',
    ]) {
      expect(names.has(expected), `missing envelope ${expected}`).toBe(true);
    }
  });
});

describe('getPreviewText helper', () => {
  test('마지막 text segment 내용이 preview 에 포함, 출력 string', () => {
    const segments = [
      { kind: 'text', text: 'first-text-XYZ' },
      { kind: 'text', text: 'last-text-ABC' },
    ];
    const preview = getPreviewText(segments);
    expect(typeof preview).toBe('string');
    expect(preview).toContain('last-text-ABC');
  });

  test('text 없으면 마지막 tool_use 의 name 또는 input 요약', () => {
    const segments = [
      { kind: 'tool_use', id: 'u1', name: 'Bash', input: { command: 'ls' } },
    ];
    const preview = getPreviewText(segments);
    expect(typeof preview).toBe('string');
    expect(preview.length).toBeGreaterThan(0);
    expect(preview).toMatch(/Bash|ls/);
  });

  test('빈 segment 배열 → 빈 문자열', () => {
    expect(getPreviewText([])).toBe('');
  });
});
