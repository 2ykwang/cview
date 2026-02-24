# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (Express :3001 + Vite HMR :5173 simultaneously)
npm run dev

# Frontend production build (generates dist/)
npm run build          # run from root
# or
cd src/frontend && npm run build

# Run server standalone (serves built dist/)
npm start              # bin/cli.js → server.js + auto-opens browser

# Install frontend dependencies
cd src/frontend && npm install
```

During development, Vite (`vite.config.js`) automatically proxies `/api` requests to the Express server (`:3001`).

## Architecture

### Overview

```
bin/cli.js          → startServer() + open browser
src/server.js       → Express API (read-only, accesses ~/.claude/)
src/frontend/       → React + Vite SPA
dist/               → Build output (served as static files by server.js)
```

### Data Flow

Claude Code stores all sessions as JSONL files:
```
~/.claude/projects/{-Users-name-project}/  ← per-project directory
    {sessionId}.jsonl                       ← session file (each line = JSON record)
~/.claude/transcripts/                     ← transcripts
```

Key fields in each JSONL record:
- `type`: `user` | `assistant` | `progress` | `system` | `file-history-snapshot` | `queue-operation`
- `message.content`: string or content block array (`text`, `tool_use`, `tool_result`, `thinking`)
- `agentName`: team agent name (absent for master/standalone sessions)
- `teamName`: team name (absent for individual sessions)

### Team Session Structure

When Claude Code's team feature is used, two session types are created:
- **Master session**: `agentName=null, teamName=null` — the session that started the team. User messages contain `<teammate-message>` XML tags.
- **Member sessions**: `agentName=planner`, `teamName=messenger-ui-team`, etc. — individual agent sessions.

`GET /api/teams/:teamName/timeline` merges all member sessions + master session by timestamp into a single timeline.

### API Endpoints (server.js)

| Endpoint | Description |
|----------|-------------|
| `GET /api/sessions` | All sessions list (includes agentName, teamName) |
| `GET /api/projects/:project/sessions/:sessionId/stream` | SSE: real-time session file stream |
| `GET /api/transcripts/:sessionId/stream` | SSE: real-time transcript stream |
| `GET /api/teams` | Team list (includes members, masterSessionId) |
| `GET /api/teams/:teamName/timeline` | Merged team conversation timeline |

### Frontend Key Files

| File | Role |
|------|------|
| `pages/SessionSelect.jsx` | Session/team list screen. Filters out individual sessions with teamName (included in group chat) |
| `pages/Messenger.jsx` | 1:1 session chat screen. Receives real-time updates via SSE |
| `pages/TeamTimeline.jsx` | Team group chat screen. Displays merged per-member timeline |
| `components/MessageBubble.jsx` | Message bubble for 1:1 chat (user/assistant) |
| `components/ToolCard.jsx` | tool_use block renderer. Custom UI per tool: SendMessage, Bash, Read/Write/Edit, Task*, Glob/Grep |
| `components/Avatar.jsx` | Agent avatar. Exports `getAvatarColor(agentName)` |
| `utils/parseSession.js` | `processMessages()`, `fmtTime()`, `fmtDate()`, `isSameDay()` |

### Message Type Handling Rules

**Filtered (hidden)**: `user`, `teammate_incoming`, `idle_notification`, `progress`, `system`, `file-history-snapshot`, `queue-operation`

**Special types**:
- `user_input`: type converted by server. Actual user input from master/member sessions (plain string content). Rendered as right-side bubble.
- thinking-only messages (all blocks in content array are `thinking` type): filtered out.

**User message handling in team timeline (server.js)**:
- content is array → `tool_result` feedback → skip
- content contains `<teammate-message>` → parse as `teammate_incoming` / `idle_notification`
- otherwise plain string → convert to `type: 'user_input'` and include

### Message Grouping

`breakGroup(a, b)` splits a group when either condition is met:
1. Different sender (`agentName`)
2. Timestamp difference between two messages ≥ 1 minute

First message in group: shows avatar + sender name
Last message in group: shows bubble tail (CSS `.bubble-in` / `.bubble-out`)
