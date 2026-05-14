// vitest-only utility. Imports `vi` from 'vitest' and uses `vi.resetModules()`
// so it MUST be invoked from inside vitest test files. Importing this module
// from src/* or scripts/* will fail with ERR_MODULE_NOT_FOUND.
//
// One test file = one fixture category. The headline reason is that
// src/server.js evaluates CLAUDE_DIR / PROJECTS_DIR at module-import time
// (server.js:16-20) — the const is fixed once the module is loaded. To
// rewire to a different category inside the same test process, use
// `loadServerWithFixture(category)` which calls `vi.resetModules()` then
// dynamic-imports server.js so the const re-evaluates against the new env.

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { vi } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = path.resolve(__dirname, '../fixtures');

export const FIXTURE_CATEGORIES = ['regression', 'golden'];

export function fixtureCategoryPath(category) {
  if (!FIXTURE_CATEGORIES.includes(category)) {
    throw new Error(`Unknown fixture category: ${category}. Expected one of ${FIXTURE_CATEGORIES.join(', ')}.`);
  }
  return path.join(FIXTURES_ROOT, category);
}

const STAMP_FILENAME_RX = /\.(jsonl|meta\.json)$|^sessions-index\.json$/;

function stampMtimes(target) {
  const baseSeconds = new Date('2026-01-01T00:00:00Z').getTime() / 1000;
  let counter = 0;
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => !e.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return;
    }
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(fullPath);
      } else if (e.isFile() && STAMP_FILENAME_RX.test(e.name)) {
        const ts = baseSeconds + counter;
        try { fs.utimesSync(fullPath, ts, ts); } catch { /* ignore */ }
        counter++;
      }
    }
  }
  walk(target);
}

export function withFixtureDir(category) {
  const target = fixtureCategoryPath(category);
  return {
    target,
    apply() {
      vi.stubEnv('CVIEW_CLAUDE_DIR', target);
      stampMtimes(target);
      return target;
    },
    restore() {
      vi.unstubAllEnvs();
    },
  };
}

// Carbon copy of withFixtureDir().apply() that ALSO resets the module cache
// and dynamic-imports src/server.js — required when server.js was already
// imported in this worker against a different category, since CLAUDE_DIR /
// PROJECTS_DIR are import-time const.
export async function loadServerWithFixture(category) {
  const target = fixtureCategoryPath(category);
  vi.stubEnv('CVIEW_CLAUDE_DIR', target);
  stampMtimes(target);
  vi.resetModules();
  const mod = await import('../../src/server.js');
  return { app: mod.default, startServer: mod.startServer, target };
}

export function projectsRoot(category) {
  return path.join(fixtureCategoryPath(category), 'projects');
}

export function sessionUrl(category, projectDir, sessionId) {
  return `/api/projects/${encodeURIComponent(projectDir)}/sessions/${encodeURIComponent(sessionId)}`;
}
