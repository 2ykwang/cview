<div align="center">
  <h1>claude-chatview</h1>
  <p>Local chat-style viewer for Claude Code sessions.</p>
</div>

<p align="center">
  <a href="README.md">English</a> | <a href="assets/README_KO.md">한국어</a>
</p>

![cview — session list](assets/screenshots/list.png)

<details>
<summary>More screenshots</summary>

![Search across title, project, branch, cwd, and content](assets/screenshots/search.png)

![Chat view with conversation timeline](assets/screenshots/chat.png)

</details>

Find and reopen past Claude Code sessions — searchable, rendered as a chat.

## Install & run

```bash
npx claude-chatview
```

Your browser opens automatically at `http://localhost:3001`.

Global install:
```bash
npm i -g claude-chatview
cview
```

## Features

- Per-session chat view with grouped consecutive messages, code-aware
  Markdown, and per-tool cards.
- Inline subagent expansion — `Agent` tool calls expand the subagent
  transcript at the call site.
- Conversation timeline — a draggable slider across the top of the chat
  for seeking in long sessions. Arrow / Home / End / PageUp / PageDown
  also work.
- Open in terminal — every session row produces a
  `cd "<cwd>" && claude --resume <session-id>` snippet you can copy.
- Search across session title, last reply, project name, cwd path,
  git branch, and `sessionId` prefix.
- Light and dark themes (respects `prefers-color-scheme`).
- Export — save the visible transcript as standalone HTML, or screenshot
  any selection of messages as PNG / JPG.
- Read-only. cview never writes to your session files.

## Keyboard

The timeline slider is focusable:

| Key | Action |
|-----|--------|
| `←` / `→` | Step one message |
| `PageUp` / `PageDown` | Step 10 messages |
| `Home` / `End` | Jump to start / end |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `CVIEW_CLAUDE_DIR` | `~/.claude` | Claude data root |

```bash
PORT=4000 cview
```

## Security

- Local-only mode on `127.0.0.1`.
- `/api` rejects non-loopback IPs and non-localhost `Origin` headers.
- Path traversal in `:project` / `:sessionId` / `:agentId` is validated.

## Development

```bash
npm install
npm run dev          # Express :3001 + Vite :5173
npm run build        # Production build into dist/
npm run lint:design  # Validate DESIGN.md against the official spec
```

## License
MIT
