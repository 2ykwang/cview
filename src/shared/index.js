export const SHARED_MODULE_SENTINEL = '@shared alias resolves';

let _isolationCounter = 0;
export function bumpIsolationCounter() {
  _isolationCounter += 1;
  return _isolationCounter;
}
export function readIsolationCounter() {
  return _isolationCounter;
}
