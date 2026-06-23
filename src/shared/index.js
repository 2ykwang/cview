export const SHARED_MODULE_SENTINEL = '@shared alias resolves';

// Record types that carry no chat content — pure metadata / telemetry. Both the
// SSE stream (server) and the frontend drop these. Anything NOT listed flows
// through: user/assistant render as bubbles; any other type (pr-link,
// worktree-state, or a future unknown) renders as an "unavailable" placeholder
// so new Claude Code schema is surfaced instead of silently dropped.
// Keep server (readJsonlMessages) and frontend (processMessages) in sync via
// this single source.
export const STREAM_SKIP_TYPES = new Set([
  'progress',
  'system',
  'file-history-snapshot',
  'queue-operation',
  'last-prompt',
  'permission-mode',
  'mode',
  'ai-title',
  'custom-title',
  'agent-name',
  'attachment',
]);

let _isolationCounter = 0;
export function bumpIsolationCounter() {
  _isolationCounter += 1;
  return _isolationCounter;
}
export function readIsolationCounter() {
  return _isolationCounter;
}
