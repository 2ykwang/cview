import { describe, test, expect } from 'vitest';
import {
  SHARED_MODULE_SENTINEL,
  bumpIsolationCounter,
  readIsolationCounter,
} from '@shared/index.js';

describe('test infrastructure sentinel (jsdom env)', () => {
  test('jsdom environment is active — window is defined', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });

  test('@shared alias resolves in jsdom env as well', () => {
    expect(SHARED_MODULE_SENTINEL).toBe('@shared alias resolves');
  });

  test('module cache is isolated from node project — counter starts at 0', () => {
    expect(readIsolationCounter()).toBe(0);
    expect(bumpIsolationCounter()).toBe(1);
  });
});
