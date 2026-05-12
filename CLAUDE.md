# CLAUDE.md

Guidance for AI coding agents working on this repository. Keep this file
short and codebase-wide. Do not record session-specific context here.

## Commands

```bash
npm run dev          # Express :3001 + Vite :5173 (HMR)
npm run build        # Frontend build → dist/
npm start            # Run the built server + open browser
npm run lint:design  # Validate DESIGN.md against the official spec
```

To regenerate README screenshots, run `bash scripts/capture-demo.sh`.

## Data on disk

```
~/.claude/projects/{-encoded-cwd}/
├── {sessionId}.jsonl              ← master session (isSidechain: false)
├── {sessionId}/subagents/
│   ├── agent-{agentId}.jsonl      ← subagent transcript (isSidechain: true)
│   └── agent-{agentId}.meta.json  ← {"agentType","description"}
~/.claude/transcripts/{sessionId}.jsonl
```

- **Master session** = top-level `{sid}.jsonl`.
- **Subagent run** = file under `{sid}/subagents/`. Linked to a master by
  matching the `Agent` tool_use `input.description` (+ `subagent_type`) to
  the subagent's `.meta.json`.
- **Orphan session** = `{sid}/subagents/` exists without a matching
  `{sid}.jsonl`. The stream endpoint merges all subagent jsonls by
  timestamp.

Records are typed JSON Lines. Only `user` / `assistant` records are
rendered as bubbles; metadata-only types (`last-prompt`, `permission-mode`,
`attachment`, etc.) are filtered. See `RENDERABLE_TYPES` and `SKIP_TYPES`
in `src/server.js` and `src/frontend/src/utils/parseSession.js`.

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/projects` | Project directory list |
| `GET /api/sessions` | Unified session list (master + orphan). Supports `q`, `limit`, `offset` |
| `GET /api/projects/:project/sessions/:sessionId/subagents` | Subagent metadata list for a master session |
| `GET /api/projects/:project/sessions/:sessionId/stream` | SSE: master JSONL (falls back to merged orphan subagents) |
| `GET /api/projects/:project/sessions/:sessionId/subagents/:agentId/stream` | SSE: a single subagent JSONL |
| `GET /api/transcripts/:sessionId/stream` | SSE: a transcript JSONL |

## Frontend key files

| File | Role |
|---|---|
| `pages/SessionSelect.jsx` | Session list + search |
| `pages/Messenger.jsx` | Chat view, timeline slider, subagent matching |
| `components/MessageBubble.jsx` | User / assistant rendering |
| `components/ToolCard.jsx` | Per-tool cards (Bash, Read/Write/Edit, Agent, Grep/Glob, …) |
| `components/SubagentExpander.jsx` | Inline subagent transcript |
| `components/DateNavigator.jsx` | Timeline slider |
| `components/OpenSessionCommand.jsx` | `cd … && claude --resume …` popover |
| `components/TeammateMessage.jsx` | `<teammate-message>` envelope card |
| `utils/parseSession.js` | `processMessages`, formatters, content guards |
| `styles/tokens.js` | JS-side mirror of CSS variables |
| `index.css` | `:root` + `[data-theme="dark"]` token definitions |
| `hooks/useTheme.js` | Theme persistence (`cview-theme` in `localStorage`) |
| `hooks/useExport.js` | HTML / PNG / JPG export |

## Design tokens

`DESIGN.md` is the source of truth for color, spacing, and typography. It
follows the [`@google/design.md`](https://github.com/google-labs-code/design.md)
format and is validated by `npm run lint:design`. Run the linter after any
token change.

When you need a value in code, import from `styles/tokens.js` (JS) or use
`var(--token)` (CSS). Do not inline hex values. The only intentional
exceptions are documented in `DESIGN.md`.

## Project conventions

- Read-only: the server never writes back to `~/.claude/`.
- Local-only: `/api` rejects non-loopback IPs and non-localhost `Origin`.
- SPA fallback: `server.js` serves `dist/` and falls back to `index.html`
  for unknown paths.
- Path traversal in any `:project` / `:sessionId` / `:agentId` parameter
  is rejected with HTTP 400.
- Screenshots in `assets/screenshots/` are tracked via Git LFS
  (see `.gitattributes`). Regenerate them with `npm run capture-demo`.
