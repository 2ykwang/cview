<div align="center">
  <h1>claude-chatview</h1>
  <p>Claude Code 세션을 채팅 형태로 볼 수 있는 로컬 뷰어입니다.</p>
</div>

<p align="center">
  <a href="../README.md">English</a> | <a href="README_KO.md">한국어</a>
</p>

![cview — 세션 목록](screenshots/list.png)

<details>
<summary>스크린샷 더 보기</summary>

![제목, 프로젝트, 브랜치, cwd, 본문에 걸친 검색](screenshots/search.png)

![대화 타임라인이 있는 채팅 화면](screenshots/chat.png)

</details>

지난 Claude Code 세션을 채팅 화면으로 빠르게 찾아 다시 엽니다 — 본문 검색까지.

## 설치 및 실행

```bash
npx claude-chatview
```

`http://localhost:3001` 이 자동으로 브라우저에서 열립니다.

전역 설치:
```bash
npm i -g claude-chatview
cview
```

## 기능

- 세션별 채팅 뷰. 같은 화자의 연속 메시지를 그룹화하고, 코드 블록과 도구 호출을
  카드로 표시합니다.
- subagent 인라인 확장 — `Agent` 도구 호출 지점에서 subagent 트랜스크립트를
  바로 펼쳐 볼 수 있습니다.
- 대화 타임라인 — 채팅 상단의 드래그 가능한 슬라이더로 긴 세션 안에서 빠르게
  이동합니다. ← / → / Home / End / PageUp / PageDown 키도 지원합니다.
- 터미널에서 다시 열기 — 각 세션 행에서
  `cd "<cwd>" && claude --resume <session-id>` 명령을 복사할 수 있습니다.
- 검색 — 세션 제목, 마지막 메시지, 프로젝트 이름, cwd 경로, git 브랜치,
  `sessionId` 접두사를 함께 검색합니다.
- 라이트 / 다크 테마 (시스템의 `prefers-color-scheme` 자동 인식).
- 내보내기 — 현재 보이는 대화를 HTML로 저장하거나, 선택한 메시지들을
  PNG / JPG 스크린샷으로 저장합니다.
- 읽기 전용 — 세션 파일을 절대 수정하지 않습니다.

## 키보드

타임라인 슬라이더에 포커스가 있을 때:

| 키 | 동작 |
|---|---|
| `←` / `→` | 메시지 1개 이동 |
| `PageUp` / `PageDown` | 10개 이동 |
| `Home` / `End` | 처음 / 마지막으로 이동 |

## 설정

| 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `3001` | 서버 포트 |
| `CVIEW_CLAUDE_DIR` | `~/.claude` | Claude 데이터 루트 경로 |

```bash
PORT=4000 cview
```

## 보안

- 로컬 전용 모드 (`127.0.0.1` 루프백).
- `/api` 는 외부 IP, 외부 Origin 요청을 거부합니다.
- `:project` / `:sessionId` / `:agentId` 경로 파라미터의 traversal을
  검증합니다.

## 개발

```bash
npm install
npm run dev          # Express :3001 + Vite :5173
npm run build        # 프로덕션 빌드 → dist/
npm run lint:design  # DESIGN.md 공식 스펙 검사
```

## 라이선스
MIT
