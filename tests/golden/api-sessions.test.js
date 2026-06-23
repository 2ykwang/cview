// Golden-path suite — currently-passing assertions. These must stay green
// across every later phase. If any goes red, that phase introduced a behavior
// regression on the existing API surface.

import request from 'supertest';
import { describe, test, expect, beforeAll } from 'vitest';
import { loadServerWithFixture } from '../_helpers/withFixtureDir.js';

let app;
beforeAll(async () => {
  ({ app } = await loadServerWithFixture('golden'));
});

describe('Golden — /api/sessions 응답 스키마', () => {
  test('paginated 응답 = items 배열 + pagination 객체', async () => {
    const res = await request(app).get('/api/sessions?limit=50');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.pagination).toBe('object');
    expect(typeof res.body.pagination.offset).toBe('number');
    expect(typeof res.body.pagination.limit).toBe('number');
    expect(typeof res.body.pagination.hasMore).toBe('boolean');
    expect(typeof res.body.pagination.nextOffset).toBe('number');
  });

  test('각 row 에 필수 필드', async () => {
    const res = await request(app).get('/api/sessions?limit=50');
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const row of res.body.items) {
      for (const field of ['id', 'kind', 'project', 'title', 'preview', 'mtime', 'subagentCount']) {
        expect(row, `row missing field "${field}"`).toHaveProperty(field);
      }
    }
  });
});

describe('Golden — 페이지네이션', () => {
  test('limit/offset 동작', async () => {
    const r1 = await request(app).get('/api/sessions?limit=2&offset=0');
    expect(r1.body.items.length).toBeLessThanOrEqual(2);
    expect(r1.body.pagination.offset).toBe(0);
    expect(r1.body.pagination.limit).toBe(2);
    if (r1.body.pagination.hasMore) {
      const r2 = await request(app).get(`/api/sessions?limit=2&offset=${r1.body.pagination.nextOffset}`);
      expect(r2.body.pagination.offset).toBe(r1.body.pagination.nextOffset);
    }
  });
});

describe('Golden — master/orphan kind 구분', () => {
  test('master fixture row.kind === "master"', async () => {
    const res = await request(app).get('/api/sessions?limit=50');
    const row = res.body.items.find(r => r.id === '02000000-0001-0001-0001-000000000001');
    expect(row?.kind).toBe('master');
  });

  test('orphan fixture row.kind === "orphan"', async () => {
    const res = await request(app).get('/api/sessions?limit=50');
    const row = res.body.items.find(r => r.id === '02000000-0003-0003-0003-000000000003');
    expect(row?.kind).toBe('orphan');
  });
});

describe('Golden — subagent listing endpoint', () => {
  test('master-subagents 의 subagent listing 길이 2, 정렬 a→b', async () => {
    const res = await request(app)
      .get('/api/projects/-fixture-master-subagents/sessions/02000000-0002-0002-0002-000000000002/subagents');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0].agentId).toBe('msaaaaaa');
    expect(res.body[1].agentId).toBe('msbbbbbb');
    expect(res.body[0].description).toBe('first sub');
  });
});

describe('Golden — SSE 스트림 (status + content-type + data: prefix)', () => {
  test('master stream 응답 200 + text/event-stream + data:[ prefix', async () => {
    let chunks = '';
    const res = await request(app)
      .get('/api/projects/-fixture-master-basic/sessions/02000000-0001-0001-0001-000000000001/stream')
      .buffer(false)
      .parse((res, cb) => {
        res.on('data', d => { chunks += d.toString('utf8'); if (chunks.includes('\n\n')) res.destroy(); });
        res.on('close', () => cb(null, chunks));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(chunks).toMatch(/^data: \[/);
  });

  test('orphan stream 응답 200 + data:[ prefix', async () => {
    let chunks = '';
    const res = await request(app)
      .get('/api/projects/-fixture-orphan/sessions/02000000-0003-0003-0003-000000000003/stream')
      .buffer(false)
      .parse((res, cb) => {
        res.on('data', d => { chunks += d.toString('utf8'); if (chunks.includes('\n\n')) res.destroy(); });
        res.on('close', () => cb(null, chunks));
      });
    expect(res.status).toBe(200);
    expect(chunks).toMatch(/^data: \[/);
  });
});

describe('Golden — 메타 레코드 skip', () => {
  test('meta-skip row.title 이 user record 본문에서 시작 (메타 record 텍스트 아님)', async () => {
    const res = await request(app).get('/api/sessions?limit=50');
    const row = res.body.items.find(r => r.id === '02000000-0005-0005-0005-000000000005');
    expect(row).toBeDefined();
    expect(row.title.startsWith('first real input')).toBe(true);
  });

  test('meta-skip row.timestamp = user record 의 14:00:01 (메타 record 의 timestamp 부재로 user 가 첫 timestamp)', async () => {
    const res = await request(app).get('/api/sessions?limit=50');
    const row = res.body.items.find(r => r.id === '02000000-0005-0005-0005-000000000005');
    expect(row).toBeDefined();
    expect(row.timestamp).toBe('2026-02-01T14:00:01Z');
  });
});

describe('Golden — teammate-message envelope 보존 (스트림 응답)', () => {
  test('teammate fixture stream 안 user content 에 <teammate-message> 보존', async () => {
    let chunks = '';
    const res = await request(app)
      .get('/api/projects/-fixture-teammate/sessions/02000000-0004-0004-0004-000000000004/stream')
      .buffer(false)
      .parse((res, cb) => {
        res.on('data', d => { chunks += d.toString('utf8'); if (chunks.includes('\n\n')) res.destroy(); });
        res.on('close', () => cb(null, chunks));
      });
    expect(res.status).toBe(200);
    expect(chunks).toMatch(/<teammate-message/);
  });
});

describe('Golden — sessions-index.json firstPrompt 우선', () => {
  test('master-basic row.title 이 firstPrompt 의 prefix (user record 가 아님)', async () => {
    const res = await request(app).get('/api/sessions?limit=50');
    const row = res.body.items.find(r => r.id === '02000000-0001-0001-0001-000000000001');
    expect(row).toBeDefined();
    expect(row.title.startsWith('first prompt from sessions-index')).toBe(true);
  });
});

describe('Golden — projectDisplay 분기', () => {
  test('동일 projectName=pname 두 fixture 의 projectDisplay 가 parent 포함 분기', async () => {
    const res = await request(app).get('/api/sessions?limit=50');
    const x = res.body.items.find(r => r.id === '02000000-0007-0007-0007-000000000007');
    const y = res.body.items.find(r => r.id === '02000000-0008-0008-0008-000000000008');
    expect(x?.projectDisplay).toBe('x/pname');
    expect(y?.projectDisplay).toBe('y/pname');
  });
});

describe('Golden — 신규 스키마 노출 (version 칩 + 미지원 placeholder)', () => {
  const SID = '02000000-0009-0009-0009-000000000009';

  test('/api/sessions row 에 Claude Code version 노출', async () => {
    const res = await request(app).get('/api/sessions?limit=50');
    const row = res.body.items.find(r => r.id === SID);
    expect(row).toBeDefined();
    expect(row.version).toBe('2.1.186');
  });

  test('stream: 의미있는 미지원(pr-link/worktree-state)은 통과, 노이즈(system)는 제외', async () => {
    let chunks = '';
    const res = await request(app)
      .get(`/api/projects/-fixture-unsupported/sessions/${SID}/stream`)
      .buffer(false)
      .parse((r, cb) => {
        r.on('data', d => { chunks += d.toString('utf8'); if (chunks.includes('\n\n')) r.destroy(); });
        r.on('close', () => cb(null, chunks));
      });
    expect(res.status).toBe(200);
    const messages = JSON.parse(chunks.replace(/^data: /, '').trim());
    const types = messages.map(m => m.type);
    expect(types).toContain('pr-link');
    expect(types).toContain('worktree-state');
    expect(types).not.toContain('system');
  });

  test('stream: attachment 화이트리스트(selected_lines_in_ide)는 통과, 노이즈(hook_success)는 제외', async () => {
    let chunks = '';
    const res = await request(app)
      .get(`/api/projects/-fixture-unsupported/sessions/${SID}/stream`)
      .buffer(false)
      .parse((r, cb) => {
        r.on('data', d => { chunks += d.toString('utf8'); if (chunks.includes('\n\n')) r.destroy(); });
        r.on('close', () => cb(null, chunks));
      });
    expect(res.status).toBe(200);
    const messages = JSON.parse(chunks.replace(/^data: /, '').trim());
    const atts = messages.filter(m => m.type === 'attachment').map(m => m.attachment?.type);
    expect(atts).toContain('selected_lines_in_ide');
    expect(atts).not.toContain('hook_success');
  });
});
