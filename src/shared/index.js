export const SHARED_MODULE_SENTINEL = '@shared alias resolves';

// Record types that carry no chat content — pure metadata / telemetry. Both the
// SSE stream (server) and the frontend drop these. Anything NOT listed flows
// through: user/assistant render as bubbles; any other (future unknown) type
// renders as an "unavailable" placeholder so new Claude Code schema is surfaced
// instead of silently dropped.
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
  'pr-link',
  'worktree-state',
]);

// attachment 레코드는 record.type 이 아니라 attachment.type 으로 분기한다. 대부분
// hook_success·task_reminder 같은 노이즈라 숨기고, 사용자에게 의미있는 IDE/계획
// 컨텍스트만 스트림으로 통과시킨다 (AttachmentCard 가 type 별로 렌더).
export const ATTACHMENT_WHITELIST = new Set([
  'opened_file_in_ide',
  'selected_lines_in_ide',
  'edited_text_file',
  'file',
  'queued_command',
  'plan_mode_exit',
]);

let _isolationCounter = 0;
export function bumpIsolationCounter() {
  _isolationCounter += 1;
  return _isolationCounter;
}
export function readIsolationCounter() {
  return _isolationCounter;
}
