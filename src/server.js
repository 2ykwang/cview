import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { watch, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

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
const META_CHUNK_BYTES = 128 * 1024;
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
  const normalized = normalizeAddress(address);
  return normalized === '127.0.0.1';
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

// Allow CORS in development only, and only for localhost origins.
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

function stripXmlTags(text) {
  return text.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim();
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

function getTextContent(messageContent) {
  if (typeof messageContent === 'string') return messageContent;
  if (Array.isArray(messageContent)) {
    const textBlock = messageContent.find(b => b.type === 'text');
    return textBlock?.text || '';
  }
  return '';
}

function getRecordSearchableText(record) {
  if (!record) return '';
  if (record.type === 'user') {
    return stripXmlTags(getTextContent(record.message?.content));
  }
  if (record.type === 'assistant' && Array.isArray(record.message?.content)) {
    return record.message.content
      .filter(block => block.type === 'text' && typeof block.text === 'string')
      .map(block => block.text)
      .join(' ')
      .trim();
  }
  return '';
}

function parseHeadTailLines(headText, tailText, hasTailOffset) {
  const headLines = headText.split('\n').filter(Boolean);
  let tailLines = tailText.split('\n');
  if (hasTailOffset && tailLines.length > 0) {
    // Drop possibly truncated first line from tail window.
    tailLines = tailLines.slice(1);
  }
  tailLines = tailLines.filter(Boolean);
  return { headLines, tailLines };
}

async function readHeadTailLines(filePath, stat) {
  if (!stat.size) return { headLines: [], tailLines: [] };

  const handle = await fs.open(filePath, 'r');
  try {
    const headBytes = Math.min(META_CHUNK_BYTES, stat.size);
    const headBuffer = Buffer.alloc(headBytes);
    const { bytesRead: headRead } = await handle.read(headBuffer, 0, headBytes, 0);
    const headText = headBuffer.toString('utf8', 0, headRead);

    const tailStart = Math.max(0, stat.size - META_CHUNK_BYTES);
    if (tailStart === 0) {
      return parseHeadTailLines(headText, headText, false);
    }
    const tailBytes = stat.size - tailStart;
    const tailBuffer = Buffer.alloc(tailBytes);
    const { bytesRead: tailRead } = await handle.read(tailBuffer, 0, tailBytes, tailStart);
    const tailText = tailBuffer.toString('utf8', 0, tailRead);

    return parseHeadTailLines(headText, tailText, tailStart > 0);
  } finally {
    await handle.close();
  }
}

async function extractSessionMeta(filePath, projectDir, statOverride = null) {
  const stat = statOverride || await fs.stat(filePath);
  let { headLines, tailLines } = await readHeadTailLines(filePath, stat);
  let headRecords = parseJsonLines(headLines, 50, false);
  let tailRecords = parseJsonLines(tailLines, 80, true);

  if (headRecords.length === 0 && stat.size > 0) {
    // Fallback for unusual cases (e.g. extremely long first line).
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    headLines = lines;
    tailLines = lines;
    headRecords = parseJsonLines(headLines, 50, false);
    tailRecords = parseJsonLines(tailLines, 80, true);
  }

  const first = headRecords.find(r => r.type !== 'file-history-snapshot') || headRecords[0] || {};
  const teamName = first.teamName || null;
  const agentName = first.agentName || null;
  const cwdParts = (first.cwd || '').split('/').filter(Boolean);
  const projectName = cwdParts[cwdParts.length - 1] || 'unknown';
  const projectParent = cwdParts[cwdParts.length - 2] || '';
  const timestamp = first.timestamp || null;

  let title = '';
  let preview = '';
  const searchParts = [];

  if (teamName) {
    title = `${teamName} · ${agentName || '?'}`;
  } else {
    // 1. Prefer sessions-index.json
    const sessionId = path.basename(filePath, '.jsonl');
    const firstPrompt = await getSessionPromptFromIndex(projectDir, sessionId);
    if (firstPrompt) title = firstPrompt.slice(0, 50);

    // 2. JSONL head scan
    if (!title) {
      for (const r of headRecords) {
        if (r.type === 'user') {
          const cnt = getTextContent(r.message?.content);
          const stripped = stripXmlTags(cnt);
          if (stripped) { title = stripped.slice(0, 50); break; }
        }
      }
    }

    // 3. Fallback
    if (!title) {
      const d = new Date(timestamp || Date.now());
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      title = `${projectName} · ${dateStr}`;
    }
  }

  // Preview: reverse scan of tail records.
  for (let i = tailRecords.length - 1; i >= 0; i--) {
    const r = tailRecords[i];
    if (r.type === 'assistant' && Array.isArray(r.message?.content)) {
      for (const block of r.message.content) {
        if (block.type === 'text' && block.text) {
          preview = block.text.slice(0, 40);
          break;
        }
      }
      if (preview) break;
    }
  }

  for (const r of headRecords) {
    const text = getRecordSearchableText(r);
    if (text) searchParts.push(text.slice(0, 300));
    if (searchParts.length >= 8) break;
  }
  for (let i = tailRecords.length - 1; i >= 0; i--) {
    const text = getRecordSearchableText(tailRecords[i]);
    if (text) searchParts.push(text.slice(0, 300));
    if (searchParts.length >= 16) break;
  }
  const searchText = searchParts.join('\n');

  let lastTimestamp = null;
  for (let i = tailRecords.length - 1; i >= 0; i--) {
    if (tailRecords[i].timestamp) {
      lastTimestamp = tailRecords[i].timestamp;
      break;
    }
  }

  return { title, preview, teamName, agentName, projectName, projectParent, timestamp, lastTimestamp, searchText };
}

async function getSessionMetaCached(filePath, projectDir, statOverride = null) {
  const stat = statOverride || await fs.stat(filePath);
  const cacheKey = cacheKeyFromStat(stat);
  const cached = sessionMetaCache.get(filePath);
  if (cached?.key === cacheKey) return cached.data;

  const meta = await extractSessionMeta(filePath, projectDir, stat);
  setCachedMeta(filePath, cacheKey, meta);
  return meta;
}

// Prevent path traversal
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

function validateSessionId(sessionId) {
  if (!sessionId || sessionId.includes('/') || sessionId.includes('..')) {
    throw Object.assign(new Error('Invalid sessionId'), { status: 400 });
  }
}

// Return project list
app.get('/api/projects', async (req, res) => {
  try {
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const projects = entries
      .filter(e => e.isDirectory())
      .map(e => ({ name: e.name, path: e.name }));
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Session file list for a specific project
app.get('/api/projects/:project/sessions', async (req, res) => {
  try {
    const projectDir = validateProject(req.params.project);
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    const sessions = await Promise.all(
      entries
        .filter(e => e.isFile() && e.name.endsWith('.jsonl'))
        .map(async e => {
          const filePath = path.join(projectDir, e.name);
          const stat = await fs.stat(filePath);
          return {
            id: e.name.replace('.jsonl', ''),
            name: e.name,
            size: stat.size,
            mtime: stat.mtime,
          };
        })
    );
    sessions.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json(sessions);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Return parsed JSONL session data
app.get('/api/projects/:project/sessions/:sessionId', async (req, res) => {
  try {
    const projectDir = validateProject(req.params.project);
    validateSessionId(req.params.sessionId);
    const filePath = path.join(projectDir, `${req.params.sessionId}.jsonl`);
    const content = await fs.readFile(filePath, 'utf-8');
    const messages = content.trim().split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(m => m && RENDERABLE_TYPES.has(m.type));
    res.json(messages);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Return parsed transcript JSONL data
app.get('/api/transcripts/:sessionId', async (req, res) => {
  try {
    validateSessionId(req.params.sessionId);
    const filePath = path.join(TRANSCRIPTS_DIR, `${req.params.sessionId}.jsonl`);
    const content = await fs.readFile(filePath, 'utf-8');
    const messages = content.trim().split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(m => m && RENDERABLE_TYPES.has(m.type));
    res.json(messages);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Transcript file list
app.get('/api/transcripts', async (req, res) => {
  try {
    const entries = await fs.readdir(TRANSCRIPTS_DIR, { withFileTypes: true });
    const sessions = await Promise.all(
      entries
        .filter(e => e.isFile() && e.name.endsWith('.jsonl'))
        .map(async e => {
          const filePath = path.join(TRANSCRIPTS_DIR, e.name);
          const stat = await fs.stat(filePath);
          return {
            id: e.name.replace('.jsonl', ''),
            name: e.name,
            size: stat.size,
            mtime: stat.mtime,
          };
        })
    );
    sessions.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unified session list across all projects
app.get('/api/sessions', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const parsedOffset = Number.parseInt(req.query.offset, 10);
    const usePagination = req.query.limit !== undefined
      || req.query.offset !== undefined
      || req.query.q !== undefined
      || req.query.excludeTeamSessions !== undefined;
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 40;
    const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;
    const excludeTeamSessions = req.query.excludeTeamSessions === '1';

    const dirs = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const sessionFiles = [];

    for (const dir of dirs.filter(e => e.isDirectory())) {
      const projectDir = path.join(PROJECTS_DIR, dir.name);
      let files;
      try { files = await fs.readdir(projectDir, { withFileTypes: true }); }
      catch { continue; }

      for (const file of files.filter(e => e.isFile() && e.name.endsWith('.jsonl'))) {
        const filePath = path.join(projectDir, file.name);
        try {
          const stat = await fs.stat(filePath);
          sessionFiles.push({
            id: file.name.replace('.jsonl', ''),
            project: dir.name,
            projectDir,
            filePath,
            stat,
            mtime: stat.mtime,
          });
        } catch {
          // File may disappear between readdir and stat; skip safely.
        }
      }
    }

    sessionFiles.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

    const buildSessionRow = async (file) => {
      let meta;
      try {
        meta = await getSessionMetaCached(file.filePath, file.projectDir, file.stat);
      } catch {
        meta = { title: file.project, preview: '', teamName: null, agentName: null, projectName: file.project, projectParent: '', timestamp: null };
      }
      return {
        id: file.id,
        project: file.project,
        _projectName: meta.projectName,
        _projectParent: meta.projectParent,
        _searchText: meta.searchText || '',
        title: meta.title,
        preview: meta.preview,
        timestamp: meta.timestamp,
        mtime: file.mtime,
        agentName: meta.agentName,
        teamName: meta.teamName,
      };
    };

    const matchesFilters = (row) => {
      if (excludeTeamSessions && row.teamName) return false;
      if (!q) return true;
      const title = (row.title || '').toLowerCase();
      const preview = (row.preview || '').toLowerCase();
      const projectName = (row._projectName || '').toLowerCase();
      const projectParent = (row._projectParent || '').toLowerCase();
      const searchText = (row._searchText || '').toLowerCase();
      return title.includes(q) || preview.includes(q) || projectName.includes(q) || projectParent.includes(q) || searchText.includes(q);
    };

    const makeSnippet = (text, queryLower) => {
      if (!text || !queryLower) return '';
      const normalized = text.replace(/\s+/g, ' ').trim();
      if (!normalized) return '';
      const lowered = normalized.toLowerCase();
      const idx = lowered.indexOf(queryLower);
      if (idx < 0) return '';
      const radius = 36;
      const start = Math.max(0, idx - radius);
      const end = Math.min(normalized.length, idx + queryLower.length + radius);
      const prefix = start > 0 ? '...' : '';
      const suffix = end < normalized.length ? '...' : '';
      return `${prefix}${normalized.slice(start, end)}${suffix}`;
    };

    const applyProjectDisplay = (rows) => {
      // projectDisplay: include parent directory when project name is ambiguous
      const nameCounts = {};
      for (const s of rows) nameCounts[s._projectName] = (nameCounts[s._projectName] || 0) + 1;
      for (const s of rows) {
        s.projectDisplay = nameCounts[s._projectName] > 1 && s._projectParent
          ? `${s._projectParent}/${s._projectName}`
          : s._projectName;
        if (q) {
          const titleLower = (s.title || '').toLowerCase();
          const previewLower = (s.preview || '').toLowerCase();
          if (!titleLower.includes(q) && !previewLower.includes(q)) {
            const snippet = makeSnippet(s._searchText || '', q);
            if (snippet) s.matchSnippet = snippet;
          }
        }
        delete s._projectName;
        delete s._projectParent;
        delete s._searchText;
      }
    };

    if (!usePagination) {
      const results = [];
      for (const file of sessionFiles) {
        const row = await buildSessionRow(file);
        if (!matchesFilters(row)) continue;
        results.push(row);
      }
      applyProjectDisplay(results);
      return res.json(results);
    }

    const items = [];
    let filteredSeen = 0;
    let hasMore = false;

    for (const file of sessionFiles) {
      const row = await buildSessionRow(file);
      if (!matchesFilters(row)) continue;

      if (filteredSeen < offset) {
        filteredSeen++;
        continue;
      }

      if (items.length < limit) {
        items.push(row);
        filteredSeen++;
        continue;
      }

      hasMore = true;
      break;
    }

    applyProjectDisplay(items);
    return res.json({
      items,
      pagination: {
        offset,
        limit,
        nextOffset: offset + items.length,
        hasMore,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Return team list (scan all projects)
app.get('/api/teams', async (req, res) => {
  try {
    const projectFilter = req.query.project;
    const dirs = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });

    // teamName -> { members, sessions, minTime, maxTime, project }
    const teamMap = new Map();
    const masterCandidates = [];

    for (const dir of dirs.filter(e => e.isDirectory())) {
      if (projectFilter && dir.name !== projectFilter) continue;
      const projectDir = path.join(PROJECTS_DIR, dir.name);
      let files;
      try { files = await fs.readdir(projectDir, { withFileTypes: true }); }
      catch { continue; }

      for (const file of files.filter(e => e.isFile() && e.name.endsWith('.jsonl'))) {
        const filePath = path.join(projectDir, file.name);
        const sessionId = file.name.replace('.jsonl', '');

        let stat;
        let meta;
        try {
          stat = await fs.stat(filePath);
          meta = await getSessionMetaCached(filePath, projectDir, stat);
        } catch { continue; }

        const { teamName, agentName, timestamp, lastTimestamp, preview } = meta;
        if (!timestamp) continue;

        if (teamName) {
          if (!teamMap.has(teamName)) {
            teamMap.set(teamName, { teamName, members: new Set(), sessions: [], minTime: timestamp, maxTime: lastTimestamp || timestamp, project: dir.name });
          }
          const team = teamMap.get(teamName);
          if (agentName) team.members.add(agentName);
          team.sessions.push({ sessionId, agentName, timestamp, preview });
          if (timestamp && timestamp < team.minTime) team.minTime = timestamp;
          const lt = lastTimestamp || timestamp;
          if (lt && lt > team.maxTime) team.maxTime = lt;
        } else if (!agentName) {
          masterCandidates.push({ sessionId, timestamp, project: dir.name });
        }
      }
    }

    const results = [];
    for (const [, team] of teamMap) {
      const teamMinMs = new Date(team.minTime).getTime();
      let masterSessionId = null;
      let bestDiff = Infinity;
      for (const mc of masterCandidates) {
        if (mc.project !== team.project) continue;
        const diff = teamMinMs - new Date(mc.timestamp).getTime();
        if (diff >= 0 && diff < 10 * 60 * 1000 && diff < bestDiff) { bestDiff = diff; masterSessionId = mc.sessionId; }
      }

      let preview = '';
      const sortedSessions = [...team.sessions].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      for (let i = sortedSessions.length - 1; i >= 0; i--) {
        if (sortedSessions[i].preview) {
          preview = sortedSessions[i].preview.slice(0, 60);
          break;
        }
      }

      results.push({ teamName: team.teamName, members: [...team.members].sort(), lastActivity: team.maxTime, masterSessionId, project: team.project, sessionCount: team.sessions.length, preview });
    }

    results.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Session list within a team
app.get('/api/teams/:teamName/sessions', async (req, res) => {
  try {
    const { teamName } = req.params;
    if (!teamName || teamName.includes('/') || teamName.includes('..')) return res.status(400).json({ error: 'Invalid teamName' });

    const projectFilter = req.query.project;
    const dirs = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const results = [];

    for (const dir of dirs.filter(e => e.isDirectory())) {
      if (projectFilter && dir.name !== projectFilter) continue;
      const projectDir = path.join(PROJECTS_DIR, dir.name);
      let files;
      try { files = await fs.readdir(projectDir, { withFileTypes: true }); }
      catch { continue; }

      for (const file of files.filter(e => e.isFile() && e.name.endsWith('.jsonl'))) {
        const filePath = path.join(projectDir, file.name);
        const sessionId = file.name.replace('.jsonl', '');
        let stat;
        let meta;
        try {
          stat = await fs.stat(filePath);
          meta = await getSessionMetaCached(filePath, projectDir, stat);
        } catch { continue; }
        if (!meta || meta.teamName !== teamName) continue;
        results.push({ sessionId, agentName: meta.agentName, timestamp: meta.timestamp, mtime: stat.mtime, project: dir.name });
      }
    }

    results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function buildTeamTimeline(teamName, projectFilter) {
  const dirs = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  const allMessages = [];
  const teamSessions = [];
  const masterCandidates = [];
  let teamMinTime = Infinity;
  let teamProject = null;

  for (const dir of dirs.filter(e => e.isDirectory())) {
    if (projectFilter && dir.name !== projectFilter) continue;
    const projectDir = path.join(PROJECTS_DIR, dir.name);
    let files;
    try { files = await fs.readdir(projectDir, { withFileTypes: true }); }
    catch { continue; }

    for (const file of files.filter(e => e.isFile() && e.name.endsWith('.jsonl'))) {
      const filePath = path.join(projectDir, file.name);
      const sessionId = file.name.replace('.jsonl', '');
      let meta;
      try {
        const stat = await fs.stat(filePath);
        meta = await getSessionMetaCached(filePath, projectDir, stat);
      } catch { continue; }
      if (!meta) continue;

      const tn = meta.teamName;
      const an = meta.agentName;
      const ts = meta.timestamp;
      if (!ts) continue;
      if (tn === teamName) {
        teamSessions.push({ sessionId, agentName: an, filePath, project: dir.name });
        const ms = new Date(ts).getTime();
        if (ms < teamMinTime) { teamMinTime = ms; teamProject = dir.name; }
      } else if (!tn && !an) {
        masterCandidates.push({ sessionId, filePath, timestamp: ts, project: dir.name });
      }
    }
  }

  // Identify master session
  let masterSessionId = null;
  let masterFilePath = null;
  let bestDiff = Infinity;
  for (const mc of masterCandidates) {
    if (mc.project !== teamProject) continue;
    const diff = teamMinTime - new Date(mc.timestamp).getTime();
    if (diff >= 0 && diff < 10 * 60 * 1000 && diff < bestDiff) { bestDiff = diff; masterSessionId = mc.sessionId; masterFilePath = mc.filePath; }
  }

  // Collect member session messages
  for (const session of teamSessions) {
    try {
      const content = await fs.readFile(session.filePath, 'utf-8');
      for (const line of content.trim().split('\n').filter(Boolean)) {
        try {
          const r = JSON.parse(line);
          if (!RENDERABLE_TYPES.has(r.type)) continue;
          // Member session user messages: skip if array (tool_result), include if string (direct user input)
          if (r.type === 'user') {
            if (Array.isArray(r.message?.content)) continue;
            const msgContent = typeof r.message?.content === 'string' ? r.message.content : '';
            if (!msgContent.trim()) continue;
            // Skip if contains teammate-message tag (teammate-to-teammate messages not handled separately)
            if (msgContent.includes('<teammate-message')) continue;
            allMessages.push({ ...r, type: 'user_input', agentName: session.agentName, sessionId: session.sessionId });
          } else {
            allMessages.push({ ...r, agentName: session.agentName, sessionId: session.sessionId });
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  // Collect master session messages (parse teammate-message tags)
  if (masterSessionId && masterFilePath) {
    try {
      const content = await fs.readFile(masterFilePath, 'utf-8');
      for (const line of content.trim().split('\n').filter(Boolean)) {
        try {
          const r = JSON.parse(line);
          if (!RENDERABLE_TYPES.has(r.type)) continue;

          if (r.type === 'user') {
            // If content is array, it's tool_result feedback → skip
            if (Array.isArray(r.message?.content)) continue;
            const msgContent = typeof r.message?.content === 'string' ? r.message.content : '';
            if (msgContent.includes('<teammate-message')) {
              // Parse teammate-message tags
              for (const match of msgContent.matchAll(/<teammate-message([^>]*)>([\s\S]*?)<\/teammate-message>/g)) {
                const attrs = match[1];
                const body = match[2].trim();
                const teammateId = (attrs.match(/teammate_id="([^"]+)"/) || [])[1] || 'unknown';
                const summary = (attrs.match(/summary="([^"]+)"/) || [])[1] || '';
                let isIdle = false;
                try { isIdle = JSON.parse(body).type === 'idle_notification'; } catch { /* text message */ }
                allMessages.push({
                  type: isIdle ? 'idle_notification' : 'teammate_incoming',
                  agentName: 'team-lead', sessionId: masterSessionId,
                  timestamp: r.timestamp, uuid: r.uuid + '_' + teammateId,
                  from: teammateId, summary, body: isIdle ? null : body,
                });
              }
            } else {
              // Plain user message = actual user input → classify as user_input type
              allMessages.push({ ...r, type: 'user_input', agentName: 'team-lead', sessionId: masterSessionId });
            }
          } else {
            allMessages.push({ ...r, agentName: 'team-lead', sessionId: masterSessionId });
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return { teamName, masterSessionId, totalMessages: allMessages.length, messages: allMessages };
}

// Team timeline (merge all sessions by timestamp)
app.get('/api/teams/:teamName/timeline', async (req, res) => {
  try {
    const { teamName } = req.params;
    const projectFilter = req.query.project;
    if (!teamName || teamName.includes('/') || teamName.includes('..')) return res.status(400).json({ error: 'Invalid teamName' });

    const timeline = await buildTeamTimeline(teamName, projectFilter);
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SSE: real-time stream for team timeline
app.get('/api/teams/:teamName/timeline/stream', async (req, res) => {
  const { teamName } = req.params;
  const projectFilter = req.query.project;
  if (!teamName || teamName.includes('/') || teamName.includes('..')) {
    return res.status(400).json({ error: 'Invalid teamName' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let lastPayload = '';
  let closed = false;
  let inflight = false;

  const sendLatest = async (force = false) => {
    if (closed || inflight) return;
    inflight = true;
    try {
      const data = await buildTeamTimeline(teamName, projectFilter);
      const payload = JSON.stringify(data);
      if (force || payload !== lastPayload) {
        lastPayload = payload;
        res.write(`data: ${payload}\n\n`);
      }
    } catch {
      // Keep stream alive; next tick may recover.
    } finally {
      inflight = false;
    }
  };

  await sendLatest(true);
  const timer = setInterval(() => { void sendLatest(false); }, 1200);
  req.on('close', () => {
    closed = true;
    clearInterval(timer);
  });
});

// SSE: real-time stream for project session
app.get('/api/projects/:project/sessions/:sessionId/stream', (req, res) => {
  let filePath;
  try {
    const projectDir = validateProject(req.params.project);
    validateSessionId(req.params.sessionId);
    filePath = path.join(projectDir, `${req.params.sessionId}.jsonl`);
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
      const content = readFileSync(filePath, 'utf-8');
      const messages = content.trim().split('\n')
        .filter(Boolean)
        .map(line => { try { return JSON.parse(line); } catch { return null; } })
        .filter(m => m && RENDERABLE_TYPES.has(m.type));
      res.write(`data: ${JSON.stringify(messages)}\n\n`);
    } catch { /* ignore */ }
  };

  sendAll();
  let watcher;
  try { watcher = watch(filePath, () => sendAll()); } catch { /* ignore */ }
  req.on('close', () => watcher?.close());
});

// SSE: real-time transcript stream
app.get('/api/transcripts/:sessionId/stream', (req, res) => {
  let filePath;
  try {
    validateSessionId(req.params.sessionId);
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
      const content = readFileSync(filePath, 'utf-8');
      const messages = content.trim().split('\n')
        .filter(Boolean)
        .map(line => { try { return JSON.parse(line); } catch { return null; } })
        .filter(m => m && RENDERABLE_TYPES.has(m.type));
      res.write(`data: ${JSON.stringify(messages)}\n\n`);
    } catch { /* ignore */ }
  };

  sendAll();
  let watcher;
  try { watcher = watch(filePath, () => sendAll()); } catch { /* ignore */ }
  req.on('close', () => watcher?.close());
});

// Serve Vite build output as static files (production)
const distDir = path.join(__dirname, '../dist');
app.use(express.static(distDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// Start server when run directly (ESM main module detection)
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
