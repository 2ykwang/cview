import { describe, test, expect } from 'vitest';
import {
  SHARED_MODULE_SENTINEL,
  bumpIsolationCounter,
  readIsolationCounter,
} from '@shared/index.js';

describe('test infrastructure sentinel (node env)', () => {
  test('vitest boots and trivial assertion passes', () => {
    expect(true).toBe(true);
  });

  test('default environment is node — window is undefined', () => {
    expect(typeof window).toBe('undefined');
  });

  test('@shared alias resolves to src/shared', () => {
    expect(SHARED_MODULE_SENTINEL).toBe('@shared alias resolves');
  });

  test('module starts at counter 0; bump to 1 inside node project', () => {
    expect(readIsolationCounter()).toBe(0);
    expect(bumpIsolationCounter()).toBe(1);
    expect(readIsolationCounter()).toBe(1);
  });

  test('withFixtureDir helper imports under vitest context', async () => {
    const helper = await import('./_helpers/withFixtureDir.js');
    expect(typeof helper.withFixtureDir).toBe('function');
    expect(typeof helper.loadServerWithFixture).toBe('function');
    expect(helper.FIXTURE_CATEGORIES).toEqual(['regression', 'golden']);
  });
});
