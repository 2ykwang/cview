import { describe, it, expect } from 'vitest';
import { serializeMessages } from './serializeMessages.js';

const records = [
  { type: 'user', uuid: 'u1', _plainText: 'hello there' },
  { type: 'assistant', uuid: 'a1', agentName: 'Claude', message: { content: [
    { type: 'thinking', thinking: 'secret reasoning' },
    { type: 'text', text: 'Running build.' },
    { type: 'tool_use', name: 'Bash', input: { command: 'npm run build\n# noise' } },
  ] } },
  { type: 'attachment', uuid: 'x1', attachment: { type: 'file' } },
];

describe('serializeMessages', () => {
  it('formats turns, drops thinking/attachments, summarizes tools', () => {
    const md = serializeMessages(records);
    expect(md).toBe(
      '**You:**\nhello there\n\n'
      + '**Claude:**\nRunning build.\n\n> 🔧 Bash: npm run build'
    );
    expect(md).not.toContain('secret reasoning');
    expect(md).not.toContain('# noise');
  });

  it('filters to selectedIds (uuid || msg-i)', () => {
    const md = serializeMessages(records, new Set(['a1']));
    expect(md).toBe('**Claude:**\nRunning build.\n\n> 🔧 Bash: npm run build');
  });
});
