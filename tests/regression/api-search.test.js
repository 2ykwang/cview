// Regression suite — currently-failing assertions wrapped in `test.fails()`.
// As later phases fix the underlying bug, the assertion will start passing,
// vitest will report `.fails()` as failing, and the maintainer drops `.fails`.
// **Critical**: when a fix lands, the next agent MUST remove the `.fails`
// modifier on the affected test. Otherwise the regression is silently masked.

import request from 'supertest';
import { describe, test, expect, beforeAll } from 'vitest';
import { loadServerWithFixture } from '../_helpers/withFixtureDir.js';

let app;
beforeAll(async () => {
  ({ app } = await loadServerWithFixture('regression'));
  if (!app) throw new Error('setup sentinel: app failed to load');
});

const ENVELOPE_RX = /<command-message|<command-name|<command-args|<local-command-caveat|<local-command-stdout|<teammate-message/;

const REGRESSION_FIXTURE_IDS = [
  '01000000-0001-0001-0001-000000000001', // envelopes
  '01000000-0002-0002-0002-000000000002', // csv-cap
  '01000000-0003-0003-0003-000000000003', // csv-tool-input
  '01000000-0004-0041-0041-000000000041', // nfc-only
  '01000000-0004-0042-0042-000000000042', // nfd-only
  '01000000-0005-0005-0005-000000000005', // orphan-deep
  '01000000-0006-0006-0006-000000000006', // multi-match
  '02000000-0006-0006-0006-000000000006', // firstprompt-envelope
];

describe('Setup sentinels (must pass — outside .fails so helper/fixture failures surface)', () => {
  test('app loaded from regression fixture', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function'); // express app is a function
  });

  test('NFC/NFD codepoints stable on disk', () => {
    expect('안'.normalize('NFC').codePointAt(0).toString(16)).toBe('c548');
    expect('안'.normalize('NFD').codePointAt(0).toString(16)).toBe('110b');
  });

  test('all regression fixture rows present in /api/sessions response', async () => {
    const res = await request(app).get('/api/sessions?limit=200');
    const ids = new Set(res.body.items.map(r => r.id));
    for (const id of REGRESSION_FIXTURE_IDS) {
      expect(ids.has(id), `regression fixture ${id} missing from response`).toBe(true);
    }
  });
});

describe('Regression — envelope 노출 (Phase 6 임시봉합 후 통과; Phase 9/10 토크나이저 통합 후에도 통과 유지)', () => {
  test('envelopes fixture title 에 envelope 태그 0건', async () => {
    const res = await request(app).get('/api/sessions?limit=200');
    const row = res.body.items.find(r => r.id === '01000000-0001-0001-0001-000000000001');
    expect(row).toBeDefined();
    expect(row.title).not.toMatch(ENVELOPE_RX);
  });

  test('envelopes fixture preview 에 envelope 태그 0건', async () => {
    const res = await request(app).get('/api/sessions?limit=200');
    const row = res.body.items.find(r => r.id === '01000000-0001-0001-0001-000000000001');
    expect(row).toBeDefined();
    expect(row.preview).not.toMatch(ENVELOPE_RX);
  });

  test('q=command-message 검색이 envelope 태그를 키워드로 잡지 않음 (searchText)', async () => {
    const res = await request(app).get('/api/sessions?q=command-message');
    const ids = res.body.items.map(r => r.id);
    expect(ids).not.toContain('01000000-0001-0001-0001-000000000001');
  });

  test('firstprompt-envelope title 에 envelope 태그 0건 (firstPrompt 경로)', async () => {
    const res = await request(app).get('/api/sessions?limit=200');
    const row = res.body.items.find(r => r.id === '02000000-0006-0006-0006-000000000006');
    expect(row).toBeDefined();
    expect(row.title).not.toMatch(ENVELOPE_RX);
  });
});

describe('Regression — 검색 cap (Phase 13 통과 후)', () => {
  test('csv 검색이 csv-cap fixture (300자 cap 밖) 를 잡는다', async () => {
    const res = await request(app).get('/api/sessions?q=csv');
    const ids = res.body.items.map(r => r.id);
    expect(ids).toContain('01000000-0002-0002-0002-000000000002');
  });
});

describe('Regression — tool_use input 검색 (Phase 9 통과 후 .fails 제거)', () => {
  test('csv 검색이 csv-tool-input fixture (Bash command/file_path/tool_result) 를 잡는다', async () => {
    const res = await request(app).get('/api/sessions?q=csv');
    const ids = res.body.items.map(r => r.id);
    expect(ids).toContain('01000000-0003-0003-0003-000000000003');
  });
});

describe('Regression — NFC/NFD 매칭 (Phase 11 통과 후)', () => {
  test('NFC 검색 → NFC fixture 와 NFD fixture 양쪽 모두 매치', async () => {
    const nfc = '안녕'.normalize('NFC');
    const res = await request(app).get(`/api/sessions?q=${encodeURIComponent(nfc)}`);
    const ids = res.body.items.map(r => r.id);
    expect(ids).toContain('01000000-0004-0041-0041-000000000041');
    expect(ids).toContain('01000000-0004-0042-0042-000000000042');
  });

  test('NFD 검색 → NFC fixture 와 NFD fixture 양쪽 모두 매치', async () => {
    const nfd = '안녕'.normalize('NFD');
    const res = await request(app).get(`/api/sessions?q=${encodeURIComponent(nfd)}`);
    const ids = res.body.items.map(r => r.id);
    expect(ids).toContain('01000000-0004-0041-0041-000000000041');
    expect(ids).toContain('01000000-0004-0042-0042-000000000042');
  });
});

describe('Regression — orphan 본문 인덱싱 (Phase 15 통과 후)', () => {
  test('csv 검색이 orphan-deep fixture (두 번째 subagent 본문) 를 잡는다', async () => {
    const res = await request(app).get('/api/sessions?q=csv');
    const ids = res.body.items.map(r => r.id);
    expect(ids).toContain('01000000-0005-0005-0005-000000000005');
  });
});

describe('Regression — 다중 매치 응답 (Phase 16 통과 후)', () => {
  test('multi-match fixture row 의 matchSnippets 배열 (length ≥ 2, 항목 shape)', async () => {
    const res = await request(app).get('/api/sessions?q=csv');
    const row = res.body.items.find(r => r.id === '01000000-0006-0006-0006-000000000006');
    expect(row).toBeDefined();
    expect(Array.isArray(row.matchSnippets)).toBe(true);
    expect(row.matchSnippets.length).toBeGreaterThanOrEqual(2);
    for (const snip of row.matchSnippets) {
      expect(typeof snip.text).toBe('string');
      expect(snip.text.toLowerCase()).toContain('csv');
      expect(['title', 'preview', 'content']).toContain(snip.source);
    }
  });
});
