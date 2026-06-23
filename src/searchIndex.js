// Phase 12 — 디스크 검색 인덱스의 위치·스키마 결정. 본격 빌드/조회 로직은 Phase 13.
//
// === 캐시 디렉터리 위치 ===
// 1순위: $XDG_CACHE_HOME/cview/index/         (env 존중)
// 2순위: ~/.cache/cview/index/                (fallback)
// `~/.claude/` 안에 절대 쓰지 않음 (CLAUDE.md read-only 원칙).
//
// === 인덱스 파일 단위 ===
// 세션당 한 파일 — `{cacheDir}/{projectName}/{sessionId}.idx.json`. 단점: 디렉터리당
// 파일 수 ↑. 장점: stale 처리 / 손상 처리 / 부분 재빌드가 세션 단위로 격리.
// 프로젝트당 한 파일 (대안) 은 한 세션 손상이 전체 무효화로 이어지는 fragility 가
// 더 큰 비용 — 거부.
//
// === 인덱스 파일 스키마 ===
//   {
//     "schemaVersion": <int>,             // CURRENT_SCHEMA_VERSION (이 한 곳만 bump 하면 전체 무효화)
//     "sourceMtime":   <number ms>,       // 원본 jsonl 의 mtimeMs (cacheKeyFromStat 의 mtime 부분)
//     "sourceSize":    <number bytes>,    // 원본 jsonl 의 size (cacheKeyFromStat 의 size 부분)
//     "tokens":        <object>,          // Phase 13 가 채울 검색용 데이터 — 토크나이저 segment 기반의
//                                         // searchText / title / preview / 그 외 metadata 필요한 만큼
//   }
//
// === Hit 조건 (Phase 13) ===
// schemaVersion === CURRENT_SCHEMA_VERSION
// && sourceMtime === source.mtime
// && sourceSize  === source.size
// 모두 만족해야 hit. 하나라도 어긋나면 miss → 그 세션만 재빌드.
//
// === 스키마 변경 시 ===
// CURRENT_SCHEMA_VERSION 1 → 2 bump 한 곳만. 모든 인덱스 자동 무효화.
//
// === 권한 실패 정책 ===
// 캐시 디렉터리 mkdir 실패 시 silently 인덱스 비활성화 — 원본 jsonl 직접 읽기 fallback.
// 인덱스는 "검색용 스냅샷" 이라 없으면 느려질 뿐 기능 깨짐 없음.

import os from 'os';
import path from 'path';

// v3: session meta now carries `messageCount` (renderable bubbles per session).
// v2: title now prefers the `ai-title` record over the first user prompt.
// Bumping invalidates all cached indexes so meta gets recomputed.
export const CURRENT_SCHEMA_VERSION = 3;

export function defaultCacheDir() {
  const xdg = process.env.XDG_CACHE_HOME;
  if (xdg) return path.join(xdg, 'cview', 'index');
  return path.join(os.homedir(), '.cache', 'cview', 'index');
}

// 인덱스 파일 경로. projectDir 의 basename 을 디렉터리 prefix 로 사용해 충돌 회피.
export function indexFilePath(projectDir, sessionId) {
  const projectKey = path.basename(projectDir);
  return path.join(defaultCacheDir(), projectKey, `${sessionId}.idx.json`);
}

// Hit 판정 — 인덱스 entry 와 source stat 비교. 모두 일치해야 hit.
export function isIndexHit(entry, sourceStat) {
  if (!entry || !sourceStat) return false;
  return (
    entry.schemaVersion === CURRENT_SCHEMA_VERSION &&
    entry.sourceMtime === sourceStat.mtimeMs &&
    entry.sourceSize === sourceStat.size
  );
}
