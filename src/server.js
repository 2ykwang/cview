import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { watch, readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  tokenize,
  getDisplayText,
  getSearchableText,
  getPreviewText,
} from './shared/messageTokenizer.js';
import {
  CURRENT_SCHEMA_VERSION,
  indexFilePath,
  isIndexHit,
} from './searchIndex.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number.parseInt(process.env.PORT ?? '3001', 10);
const HOST = '127.0.0.1';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const CLAUDE_DIR = process.env.CVIEW_CLAUDE_DIR
  ? path.resolve(process.env.CVIEW_CLAUDE_DIR)
  : path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const TRANSCRIPTS_DIR = path.join(CLAUDE_DIR, 'transcripts');

const RENDERABLE_TYPES = new Set(['user', 'assistant']);
// JSONL records that show up at the head/tail of a file but carry no chat content.
// Used when picking the "first meaningful" record for metadata extraction.
const META_ONLY_TYPES = new Set([
  'last-prompt',
  'permission-mode',
  'ai-title',
  'file-history-snapshot',
  'queue-operation',
]);
const MAX_META_CACHE = 5000;
const MAX_INDEX_CACHE = 200;
const sessionMetaCache = new Map();
const sessionsIndexCache = new Map();

app.disable('x-powered-by');

function normalizeAddress(address = '') {
  if (address.startsWith('::ffff:')) return address.slice('::ffff:'.length);
  if (address === '::1') return '127.0.0.1';
  return address;
}

function isLoopbackAddress(address = '') {
  return normalizeAddress(address) === '127.0.0.1';
}

function isAllowedLocalOrigin(origin = '') {
  try {
    const parsed = new URL(origin);
    return LOCALHOST_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function localApiOnlyGuard(req, res, next) {
  if (!isLoopbackAddress(req.socket?.remoteAddress)) {
    return res.status(403).json({ error: 'Remote network access is not allowed' });
  }
  const origin = req.headers.origin;
  if (origin && !isAllowedLocalOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed for local-only mode' });
  }
  return next();
}

if (!IS_PRODUCTION) {
  app.use(cors({
    origin(origin, callback) {
      if (!origin || isAllowedLocalOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
  }));
}
app.use(express.json({ limit: '256kb' }));
app.use('/api', localApiOnlyGuard);

function cacheKeyFromStat(stat) {
  return `${stat.mtimeMs}:${stat.size}`;
}

function setCachedMeta(filePath, key, data) {
  if (sessionMetaCache.size >= MAX_META_CACHE) {
    const oldestKey = sessionMetaCache.keys().next().value;
    if (oldestKey) sessionMetaCache.delete(oldestKey);
  }
  sessionMetaCache.set(filePath, { key, data });
}

function setCachedIndex(projectDir, key, data) {
  if (sessionsIndexCache.size >= MAX_INDEX_CACHE) {
    const oldestKey = sessionsIndexCache.keys().next().value;
    if (oldestKey) sessionsIndexCache.delete(oldestKey);
  }
  sessionsIndexCache.set(projectDir, { key, data });
}

async function getSessionPromptFromIndex(projectDir, sessionId) {
  const indexPath = path.join(projectDir, 'sessions-index.json');
  let stat;
  try {
    stat = await fs.stat(indexPath);
  } catch {
    return '';
  }

  const cacheKey = cacheKeyFromStat(stat);
  const cached = sessionsIndexCache.get(projectDir);
  if (cached?.key === cacheKey) {
    return cached.data.get(sessionId) || '';
  }

  try {
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(indexContent);
    const entryMap = new Map();
    for (const entry of index.entries || []) {
      if (entry?.sessionId && typeof entry.firstPrompt === 'string') {
        entryMap.set(entry.sessionId, entry.firstPrompt);
      }
    }
    setCachedIndex(projectDir, cacheKey, entryMap);
    return entryMap.get(sessionId) || '';
  } catch {
    return '';
  }
}

function parseJsonLines(lines, maxCount, fromTail = false) {
  const src = fromTail ? lines.slice(-maxCount) : lines.slice(0, maxCount);
  const out = [];
  for (const line of src) {
    try {
      const parsed = JSON.parse(line);
      if (parsed) out.push(parsed);
    } catch {
      // Skip malformed lines safely.
    }
  }
  return out;
}

// Phase 9: envelope/text 처리 모두 messageTokenizer 로 일원화. 이전 단계의
// `KNOWN_ENVELOPES` 배열·`stripKnownEnvelopes`·`getTextContent` 모두 제거.
function getRecordSearchableText(record) {
  if (!record) return '';
  if (record.type !== 'user' && record.type !== 'assistant') return '';
  return getSearchableText(tokenize(record.message?.content));
}

// Pick the first record that has session metadata (cwd / timestamp).
// Modern JSONL starts with `last-prompt` / `permission-mode` which carry neither.
function pickFirstMeaningfulRecord(headRecords) {
  for (const r of headRecords) {
    if (!r) continue;
    if (META_ONLY_TYPES.has(r.type)) continue;
    if (r.cwd || r.timestamp) return r;
  }
  return headRecords.find(r => r && !META_ONLY_TYPES.has(r.type)) || headRecords[0] || {};
}

// Phase 13: 풀 파일 읽기 + cap 3종 모두 제거 (text.slice 300자 / searchParts 8/16 /
// META_CHUNK_BYTES 128KB). 디스크 인덱스가 결과를 캐시하므로 첫 빌드만 풀 비용,
// 이후 hit 시 인덱스 readFile 한 번. SSE 스트림은 본 함수 우회 — readJsonlMessages 직접.
async function extractSessionMeta(filePath, projectDir, statOverride = null) {
  const stat = statOverride || await fs.stat(filePath);
  if (!stat.size) {
    return { title: '', preview: '', projectName: 'unknown', projectParent: '', cwd: null, gitBranch: null, timestamp: null, lastTimestamp: null, searchText: '' };
  }

  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);
  const records = [];
  for (const line of lines) {
    try { records.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }

  const first = pickFirstMeaningfulRecord(records);
  const cwd = first.cwd || null;
  const cwdParts = (cwd || '').split('/').filter(Boolean);
  const projectName = cwdParts[cwdParts.length - 1] || 'unknown';
  const projectParent = cwdParts[cwdParts.length - 2] || '';
  const gitBranch = first.gitBranch || null;

  let timestamp = null;
  for (const r of records) {
    if (r?.timestamp) { timestamp = r.timestamp; break; }
  }

  let title = '';
  const sessionId = path.basename(filePath, '.jsonl');
  const firstPrompt = await getSessionPromptFromIndex(projectDir, sessionId);
  if (firstPrompt) {
    const display = getDisplayText(tokenize(firstPrompt)).trim();
    if (display) title = display.slice(0, 60);
  }
  if (!title) {
    for (const r of records) {
      if (r.type === 'user') {
        const display = getDisplayText(tokenize(r.message?.content)).trim();
        if (display) { title = display.slice(0, 60); break; }
      }
    }
  }
  if (!title) {
    const d = new Date(timestamp || Date.now());
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    title = `${projectName} · ${dateStr}`;
  }

  let preview = '';
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.type === 'assistant') {
      const previewText = getPreviewText(tokenize(r.message?.content)).trim();
      if (previewText) {
        preview = previewText.slice(0, 60);
        break;
      }
    }
  }

  // 모든 record 의 searchable text 합산. record cap (text.slice 300) /
  // record 개수 cap (8/16) / chunk cap (128KB) 모두 제거.
  const searchParts = [];
  for (const r of records) {
    const text = getRecordSearchableText(r);
    if (text) searchParts.push(text);
  }
  const searchText = searchParts.join('\n');

  let lastTimestamp = null;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].timestamp) { lastTimestamp = records[i].timestamp; break; }
  }

  return { title, preview, projectName, projectParent, cwd, gitBranch, timestamp, lastTimestamp, searchText };
}

// 디스크 인덱스 layer — Phase 13. hit 시 readFile 한 번, miss 시 풀 빌드 후 저장.
// 권한 실패는 silently 비활성화 fallback.
async function readDiskIndex(filePath, projectDir, stat) {
  const sessionId = path.basename(filePath, '.jsonl');
  const indexPath = indexFilePath(projectDir, sessionId);
  try {
    const raw = await fs.readFile(indexPath, 'utf-8');
    const entry = JSON.parse(raw);
    if (isIndexHit(entry, stat)) return entry.meta;
  } catch { /* miss / 손상 / 부재 — silently fallback */ }
  return null;
}

async function writeDiskIndex(filePath, projectDir, stat, meta) {
  const sessionId = path.basename(filePath, '.jsonl');
  const indexPath = indexFilePath(projectDir, sessionId);
  try {
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    const entry = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sourceMtime: stat.mtimeMs,
      sourceSize: stat.size,
      meta,
    };
    await fs.writeFile(indexPath, JSON.stringify(entry));
  } catch { /* silently disable */ }
}

async function getSessionMetaCached(filePath, projectDir, statOverride = null) {
  const stat = statOverride || await fs.stat(filePath);
  const cacheKey = cacheKeyFromStat(stat);

  const memCached = sessionMetaCache.get(filePath);
  if (memCached?.key === cacheKey) return memCached.data;

  const diskMeta = await readDiskIndex(filePath, projectDir, stat);
  if (diskMeta) {
    setCachedMeta(filePath, cacheKey, diskMeta);
    return diskMeta;
  }

  const meta = await extractSessionMeta(filePath, projectDir, stat);
  setCachedMeta(filePath, cacheKey, meta);
  await writeDiskIndex(filePath, projectDir, stat, meta);
  return meta;
}

// Walk a project directory and return:
//   - master sessions:   {sid}.jsonl with optional {sid}/subagents/
//   - orphan sub-runs:   {sid}/subagents/ without a matching {sid}.jsonl
async function collectProjectSessions(projectDir) {
  let entries;
  try { entries = await fs.readdir(projectDir, { withFileTypes: true }); }
  catch { return []; }

  const masterFiles = new Map();   // sid -> filename
  const subagentDirs = new Map();  // sid -> dirpath

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      masterFiles.set(entry.name.replace(/\.jsonl$/, ''), entry.name);
    } else if (entry.isDirectory()) {
      const subPath = path.join(projectDir, entry.name, 'subagents');
      try {
        const subStat = await fs.stat(subPath);
        if (subStat.isDirectory()) subagentDirs.set(entry.name, subPath);
      } catch { /* not a session dir */ }
    }
  }

  const sessions = [];
  for (const [sid, filename] of masterFiles) {
    sessions.push({
      sessionId: sid,
      kind: 'master',
      filePath: path.join(projectDir, filename),
      subagentDir: subagentDirs.get(sid) || null,
    });
  }
  for (const [sid, subDir] of subagentDirs) {
    if (masterFiles.has(sid)) continue;
    sessions.push({
      sessionId: sid,
      kind: 'orphan',
      filePath: null,
      subagentDir: subDir,
    });
  }
  return sessions;
}

async function listSubagents(subagentDir) {
  if (!subagentDir) return [];
  let entries;
  try { entries = await fs.readdir(subagentDir, { withFileTypes: true }); }
  catch { return []; }

  const byId = new Map();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const jsonlMatch = entry.name.match(/^agent-(.+)\.jsonl$/);
    const metaMatch = entry.name.match(/^agent-(.+)\.meta\.json$/);
    if (jsonlMatch) {
      const id = jsonlMatch[1];
      const obj = byId.get(id) || { agentId: id };
      obj.jsonlPath = path.join(subagentDir, entry.name);
      byId.set(id, obj);
    } else if (metaMatch) {
      const id = metaMatch[1];
      const obj = byId.get(id) || { agentId: id };
      obj.metaPath = path.join(subagentDir, entry.name);
      byId.set(id, obj);
    }
  }

  const results = [];
  for (const obj of byId.values()) {
    if (!obj.jsonlPath) continue;
    let agentType = null;
    let description = null;
    if (obj.metaPath) {
      try {
        const raw = await fs.readFile(obj.metaPath, 'utf-8');
        const meta = JSON.parse(raw);
        if (typeof meta.agentType === 'string') agentType = meta.agentType;
        if (typeof meta.description === 'string') description = meta.description;
      } catch { /* ignore corrupt meta */ }
    }
    let firstTimestamp = null;
    try {
      const stat = await fs.stat(obj.jsonlPath);
      firstTimestamp = stat.mtimeMs;
    } catch { /* skip */ }
    results.push({
      agentId: obj.agentId,
      agentType,
      description,
      mtime: firstTimestamp,
    });
  }
  results.sort((a, b) => (a.mtime || 0) - (b.mtime || 0));
  return results;
}

async function newestMtime(session) {
  const candidates = [];
  if (session.filePath) {
    try { candidates.push((await fs.stat(session.filePath)).mtimeMs); } catch { /* skip */ }
  }
  if (session.subagentDir) {
    try {
      const subs = await fs.readdir(session.subagentDir, { withFileTypes: true });
      for (const s of subs) {
        if (!s.isFile() || !s.name.endsWith('.jsonl')) continue;
        try {
          const st = await fs.stat(path.join(session.subagentDir, s.name));
          candidates.push(st.mtimeMs);
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  if (!candidates.length) return 0;
  return Math.max(...candidates);
}

// Build a representative meta for a session entry (master or orphan).
async function buildSessionRow(projectDir, project, session) {
  const newest = await newestMtime(session);
  const subagents = await listSubagents(session.subagentDir);
  let meta;

  if (session.kind === 'master') {
    meta = await getSessionMetaCached(session.filePath, projectDir);
  } else {
    // Phase 15: 모든 subagent jsonl 의 searchText 결합. 첫 subagent 만 보던 회귀 해소.
    // title/preview/cwd/gitBranch/timestamp 같은 메타는 첫 subagent (mtime 정렬 후
    // listSubagents 결과의 순서대로 첫) 의 결과 그대로 — orphan 의 대표 정체성.
    // searchText 만 모든 subagent 의 합산으로 확장 (검색 hit 률 일관성).
    const first = subagents[0];
    if (first) {
      const firstPath = path.join(session.subagentDir, `agent-${first.agentId}.jsonl`);
      try { meta = await getSessionMetaCached(firstPath, projectDir); } catch { meta = null; }
    }
    if (!meta) {
      meta = { title: `orphan · ${session.sessionId.slice(0, 8)}`, preview: '', projectName: path.basename(projectDir), projectParent: '', cwd: null, gitBranch: null, timestamp: null, lastTimestamp: null, searchText: '' };
    }
    if (subagents.length > 1) {
      const searchParts = [meta.searchText || ''];
      for (let i = 1; i < subagents.length; i++) {
        const sub = subagents[i];
        const subPath = path.join(session.subagentDir, `agent-${sub.agentId}.jsonl`);
        try {
          const subMeta = await getSessionMetaCached(subPath, projectDir);
          if (subMeta?.searchText) searchParts.push(subMeta.searchText);
        } catch { /* skip broken subagent */ }
      }
      meta = { ...meta, searchText: searchParts.filter(Boolean).join('\n') };
    }
  }

  return {
    id: session.sessionId,
    kind: session.kind,
    project,
    _projectName: meta.projectName,
    _projectParent: meta.projectParent,
    _searchText: meta.searchText || '',
    title: meta.title,
    preview: meta.preview,
    timestamp: meta.timestamp,
    mtime: new Date(newest).toISOString(),
    cwd: meta.cwd,
    gitBranch: meta.gitBranch,
    subagentCount: subagents.length,
  };
}

function validateProject(project) {
  if (!project || project.includes('/') || project.includes('..')) {
    throw Object.assign(new Error('Invalid project'), { status: 400 });
  }
  const resolved = path.join(PROJECTS_DIR, project);
  if (!resolved.startsWith(PROJECTS_DIR + path.sep)) {
    throw Object.assign(new Error('Invalid project'), { status: 400 });
  }
  return resolved;
}

function validateId(id, label = 'id') {
  if (!id || id.includes('/') || id.includes('..') || id.includes('\\')) {
    throw Object.assign(new Error(`Invalid ${label}`), { status: 400 });
  }
}

function resolveSubagentPath(projectDir, sessionId, agentId) {
  validateId(sessionId, 'sessionId');
  validateId(agentId, 'agentId');
  const filePath = path.join(projectDir, sessionId, 'subagents', `agent-${agentId}.jsonl`);
  const expectedPrefix = path.join(projectDir, sessionId, 'subagents') + path.sep;
  if (!filePath.startsWith(expectedPrefix)) {
    throw Object.assign(new Error('Invalid path'), { status: 400 });
  }
  return filePath;
}

function readJsonlMessages(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return content.trim().split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(m => m && RENDERABLE_TYPES.has(m.type));
}

// For orphan sessions (no master jsonl). Merges every subagent jsonl in the
// session's subagents/ directory, sorts by timestamp, returns renderable msgs.
function readOrphanMessages(subagentDirAbs) {
  const all = [];
  let entries;
  try {
    entries = readdirSync(subagentDirAbs);
  } catch {
    return [];
  }
  for (const name of entries) {
    if (!/^agent-.+\.jsonl$/.test(name)) continue;
    const filePath = path.join(subagentDirAbs, name);
    let content;
    try { content = readFileSync(filePath, 'utf-8'); } catch { continue; }
    const m = name.match(/^agent-(.+)\.jsonl$/);
    const agentId = m ? m[1] : null;
    for (const line of content.trim().split('\n')) {
      if (!line) continue;
      try {
        const rec = JSON.parse(line);
        if (!rec || !RENDERABLE_TYPES.has(rec.type)) continue;
        if (agentId && !rec.agentName) rec.agentName = `agent-${agentId.slice(0, 7)}`;
        all.push(rec);
      } catch { /* skip */ }
    }
  }
  all.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return ta - tb;
  });
  return all;
}

// Phase 11: 검색 매칭 정규화 — NFC + lowercase. macOS 파일시스템(NFD 경향) 과
// 일반 입력(NFC) 의 자모 분리/조합 차이로 한글 매치가 실패하던 회귀를 차단.
// 인덱스와 쿼리 양쪽이 동일 함수를 거쳐 단어 경계가 동등.
function normalizeForSearch(s) {
  return (s || '').normalize('NFC').toLowerCase();
}

app.get('/api/sessions', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const qN = q ? normalizeForSearch(q) : '';
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const parsedOffset = Number.parseInt(req.query.offset, 10);
    const usePagination = req.query.limit !== undefined
      || req.query.offset !== undefined
      || req.query.q !== undefined;
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 40;
    const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    const dirs = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const sessionEntries = [];

    for (const dir of dirs.filter(e => e.isDirectory())) {
      const projectDir = path.join(PROJECTS_DIR, dir.name);
      const sessions = await collectProjectSessions(projectDir);
      for (const session of sessions) {
        sessionEntries.push({ projectDir, project: dir.name, session });
      }
    }

    const rows = [];
    for (const entry of sessionEntries) {
      try {
        rows.push(await buildSessionRow(entry.projectDir, entry.project, entry.session));
      } catch { /* skip broken */ }
    }
    rows.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

    const matchesFilter = (row) => {
      if (!q) return true;
      const fields = [
        row.title,
        row.preview,
        row._projectName,
        row._projectParent,
        row._searchText,
        row.cwd,
        row.gitBranch,
        row.kind,
        row.id,
      ];
      return fields.some(v => normalizeForSearch(v).includes(qN));
    };

    // Phase 16: 단일 위치 → N개 스니펫. 각 항목 {source, text, before, after, recordIndex}.
    // source enum: 'title' | 'preview' | 'content'. 우선순위: title → preview → content.
    // 한 세션당 cap 5.
    const SNIPPET_RADIUS = 36;
    const SNIPPET_CAP = 5;

    function buildSnippetItem(text, idx, queryLen) {
      const start = Math.max(0, idx - SNIPPET_RADIUS);
      const end = Math.min(text.length, idx + queryLen + SNIPPET_RADIUS);
      const before = (start > 0 ? '...' : '') + text.slice(start, idx);
      const after = text.slice(idx + queryLen, end) + (end < text.length ? '...' : '');
      return {
        text: `${before}${text.slice(idx, idx + queryLen)}${after}`,
        before,
        after,
      };
    }

    const collectMatchSnippets = (row) => {
      if (!q) return null;
      const items = [];
      const titleN = normalizeForSearch(row.title);
      const previewN = normalizeForSearch(row.preview);
      const searchN = normalizeForSearch(row._searchText || '').replace(/\s+/g, ' ').trim();

      if (titleN.includes(qN)) {
        const idx = titleN.indexOf(qN);
        items.push({ source: 'title', recordIndex: -1, ...buildSnippetItem(row.title || '', idx, qN.length) });
      }
      if (previewN.includes(qN) && items.length < SNIPPET_CAP) {
        const idx = previewN.indexOf(qN);
        items.push({ source: 'preview', recordIndex: -1, ...buildSnippetItem(row.preview || '', idx, qN.length) });
      }
      if (searchN) {
        let cursor = 0;
        let recordIndex = 0;
        while (items.length < SNIPPET_CAP) {
          const idx = searchN.indexOf(qN, cursor);
          if (idx < 0) break;
          items.push({ source: 'content', recordIndex, ...buildSnippetItem(searchN, idx, qN.length) });
          cursor = idx + qN.length;
          recordIndex += 1;
        }
      }
      return items;
    };

    // 호환 — 기존 단수 matchSnippet 필드 (Phase 5 결정 "기존 API 파괴 변경 금지").
    const makeSnippet = (text, query) => {
      if (!text || !query) return '';
      const queryN = normalizeForSearch(query);
      const normalized = normalizeForSearch(text).replace(/\s+/g, ' ').trim();
      if (!normalized) return '';
      const idx = normalized.indexOf(queryN);
      if (idx < 0) return '';
      const start = Math.max(0, idx - SNIPPET_RADIUS);
      const end = Math.min(normalized.length, idx + queryN.length + SNIPPET_RADIUS);
      const prefix = start > 0 ? '...' : '';
      const suffix = end < normalized.length ? '...' : '';
      return `${prefix}${normalized.slice(start, end)}${suffix}`;
    };

    const finalize = (collected) => {
      const nameCounts = {};
      for (const s of collected) nameCounts[s._projectName] = (nameCounts[s._projectName] || 0) + 1;
      for (const s of collected) {
        s.projectDisplay = nameCounts[s._projectName] > 1 && s._projectParent
          ? `${s._projectParent}/${s._projectName}`
          : s._projectName;
        if (q) {
          const items = collectMatchSnippets(s);
          if (items && items.length > 0) {
            s.matchSnippets = items;
            s.matchSnippet = items[0].text;
          } else {
            const snippet = makeSnippet(s._searchText || '', q);
            if (snippet) s.matchSnippet = snippet;
          }
        }
        delete s._projectName;
        delete s._projectParent;
        delete s._searchText;
      }
      return collected;
    };

    if (!usePagination) {
      const matched = rows.filter(matchesFilter);
      return res.json(finalize(matched));
    }

    const matched = rows.filter(matchesFilter);
    const page = matched.slice(offset, offset + limit);
    finalize(page);
    return res.json({
      items: page,
      pagination: {
        offset,
        limit,
        nextOffset: offset + page.length,
        hasMore: offset + page.length < matched.length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List subagents under a given master session.
app.get('/api/projects/:project/sessions/:sessionId/subagents', async (req, res) => {
  try {
    const projectDir = validateProject(req.params.project);
    validateId(req.params.sessionId, 'sessionId');
    const subagentDir = path.join(projectDir, req.params.sessionId, 'subagents');
    const subagents = await listSubagents(subagentDir);
    res.json(subagents);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// SSE stream for a session's main jsonl. Falls back to merging the orphan
// session's subagents/ directory when the master jsonl does not exist.
app.get('/api/projects/:project/sessions/:sessionId/stream', (req, res) => {
  let filePath;
  let subagentDir;
  try {
    const projectDir = validateProject(req.params.project);
    validateId(req.params.sessionId, 'sessionId');
    filePath = path.join(projectDir, `${req.params.sessionId}.jsonl`);
    subagentDir = path.join(projectDir, req.params.sessionId, 'subagents');
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const masterExists = existsSync(filePath);
  const orphanAvailable = !masterExists && existsSync(subagentDir);

  const sendAll = () => {
    try {
      const messages = orphanAvailable
        ? readOrphanMessages(subagentDir)
        : (masterExists ? readJsonlMessages(filePath) : []);
      res.write(`data: ${JSON.stringify(messages)}\n\n`);
    } catch {
      // Always send at least one event so the client doesn't show "Loading..." forever.
      try { res.write(`data: []\n\n`); } catch { /* ignore */ }
    }
  };

  sendAll();
  const watchers = [];
  try {
    if (masterExists) {
      watchers.push(watch(filePath, () => sendAll()));
    } else if (orphanAvailable) {
      watchers.push(watch(subagentDir, () => sendAll()));
    }
  } catch { /* ignore */ }
  req.on('close', () => watchers.forEach(w => { try { w.close(); } catch {} }));
});

// SSE stream for a single subagent jsonl under a master session.
app.get('/api/projects/:project/sessions/:sessionId/subagents/:agentId/stream', (req, res) => {
  let filePath;
  try {
    const projectDir = validateProject(req.params.project);
    filePath = resolveSubagentPath(projectDir, req.params.sessionId, req.params.agentId);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendAll = () => {
    try {
      const messages = readJsonlMessages(filePath);
      res.write(`data: ${JSON.stringify(messages)}\n\n`);
    } catch { /* ignore */ }
  };

  sendAll();
  let watcher;
  try { watcher = watch(filePath, () => sendAll()); } catch { /* ignore */ }
  req.on('close', () => watcher?.close());
});

// Transcripts (~/.claude/transcripts/).
app.get('/api/transcripts/:sessionId/stream', (req, res) => {
  let filePath;
  try {
    validateId(req.params.sessionId, 'sessionId');
    filePath = path.join(TRANSCRIPTS_DIR, `${req.params.sessionId}.jsonl`);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendAll = () => {
    try {
      const messages = readJsonlMessages(filePath);
      res.write(`data: ${JSON.stringify(messages)}\n\n`);
    } catch { /* ignore */ }
  };

  sendAll();
  let watcher;
  try { watcher = watch(filePath, () => sendAll()); } catch { /* ignore */ }
  req.on('close', () => watcher?.close());
});

// Serve Vite build output as static files (production).
const distDir = path.join(__dirname, '../dist');
app.use(express.static(distDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}

export function startServer(port = PORT) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, HOST, () => {
      const address = server.address();
      const effectivePort = typeof address === 'object' && address ? address.port : port;
      console.log(`Server running at: http://localhost:${effectivePort}`);
      resolve(server);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Set a different port via the PORT environment variable.`));
        return;
      }
      reject(err);
    });
  });
}

export default app;
