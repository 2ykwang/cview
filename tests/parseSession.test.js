import { describe, test, expect } from 'vitest';
import { buildToolResults } from '../src/frontend/src/utils/parseSession.js';

describe('buildToolResults — tool_use ↔ toolUseResult 페어링', () => {
  test('tool_result-only user record 에서 매핑 추출 (processMessages 가 버리는 턴)', () => {
    const records = [
      { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu-1', name: 'Bash', input: {} }] } },
      {
        type: 'user',
        toolUseResult: { stdout: 'done', stderr: '' },
        message: { content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: 'done' }] },
      },
    ];
    expect(buildToolResults(records)['tu-1']).toEqual({ stdout: 'done', stderr: '' });
  });

  test('string toolUseResult 도 매핑', () => {
    const records = [
      {
        type: 'user',
        toolUseResult: 'plain error text',
        message: { content: [{ type: 'tool_result', tool_use_id: 'tu-9' }] },
      },
    ];
    expect(buildToolResults(records)['tu-9']).toBe('plain error text');
  });

  test('toolUseResult 없는 입력 → 빈 맵', () => {
    expect(buildToolResults([{ type: 'user', message: { content: 'hi' } }])).toEqual({});
  });

  test('비배열 입력 방어', () => {
    expect(buildToolResults(null)).toEqual({});
    expect(buildToolResults(undefined)).toEqual({});
  });
});
