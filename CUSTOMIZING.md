# 커스텀 가이드 — 기본 제공 셋 스펙 🎨

이 문서는 달팽이를 마음껏 뜯어고치고 싶은 분을 위한 **기본 제공 셋의 스펙 설명서**입니다.
커스텀 대상은 **아트(캐릭터·말풍선)만이 아니라 일렉트론 앱 전체**입니다 — 창 동작, 상태 머신, 웹훅, 안내 패널, 트레이까지 전부 열려 있어요. 실행·연동 방법은 [README.md](README.md)를 보세요.

## 기본 제공 셋 한눈에 보기

| 구성 | 내용 | 위치 |
| --- | --- | --- |
| 캐릭터 애니메이션 | 스네일(달팽이) 1종 × 감정 9종 × 숏/롱 2버전 = **JSON 18개** | [charactor/](charactor/) `스네일-와이드-*.json` |
| 미리보기 | 각 애니메이션의 첫 프레임 SVG (앱은 사용 안 함, 눈으로 고를 때용) | [charactor/](charactor/) `*-미리보기.svg` |
| 말풍선 | JSON 픽셀 말풍선 3종(만화/퍼플/코지) + 기본 SVG 생각풍선(classic) | [charactor/](charactor/) `말풍선-*.json` |
| 폰트 | MonaS12(픽셀, 기본) · Pretendard (dev 패널에서 토글) | [renderer/fonts/](renderer/fonts/) |
| 데이터 | 행사 정보 · 세션 스케줄 | [conference.json](conference.json) · [schedule.json](schedule.json) |
| 앱 본체 | 창/트레이/상태 머신/웹훅 서버 (main) + 렌더링 (renderer) | [main.js](main.js) · [renderer/](renderer/) |

모든 아트는 **마름모 아트보드 JSON** 하나의 포맷을 씁니다. 그림 파일이 아니라 색상 그리드라서,
손으로 고쳐도 되고 스크립트로 생성해도 됩니다.

## 앱 구조 맵 — 어디를 고치면 뭐가 바뀌나

| 파일 | 역할 | 이런 커스텀은 여기 |
| --- | --- | --- |
| [main.js](main.js) | 창 생성·트레이·전역 단축키·상태 머신·웹훅 서버·스케줄러 (전부 한 파일) | 창 크기/위치, 잠들기 시간, 새 웹훅 엔드포인트, 트레이 메뉴, 새 상태 규칙 |
| [preload.js](preload.js) | main ↔ renderer IPC 브릿지 | renderer에 새 기능 노출할 때 |
| [renderer/mascot.js](renderer/mascot.js) | 캐릭터·말풍선 렌더링, `ANIM`/`BUBBLE_STYLES` 레지스트리 | 애니메이션 fps/매핑, 말풍선 스타일, 바운스 같은 코드 연출 |
| [renderer/style.css](renderer/style.css) | 마스코트 창 스타일 (레벨 색, 흔들림, 폰트) | 말풍선 텍스트 색, urgent 연출, 새 스타일 테마 |
| [renderer/guide.html](renderer/guide.html) / [guide.js](renderer/guide.js) / [guide.css](renderer/guide.css) | 안내 패널 (before/dayof/after 3상태) | 패널 스킨, 새 카드/섹션 |
| [renderer/dev.html](renderer/dev.html) / [dev.js](renderer/dev.js) | 개발자 미리보기 패널 | 커스텀한 기능의 테스트 버튼 추가 |
| [integrations/](integrations/) | mascot-watch CLI · Vite 플러그인 · 재사용 클라이언트 | 다른 툴 연동 (webpack, git hook, CI…) |
| [scripts/send.js](scripts/send.js) | 웹훅 CLI 헬퍼 | – |

### 창/동작 스펙 (main.js 기본값)

- 마스코트 창 **315×260**, 투명 · 항상 위 · 프레임 없음 · 독/작업표시줄 숨김 · 전체화면 위에도 표시. 빈 영역은 **클릭 통과**(캐릭터/말풍선 위에서만 마우스 활성).
- 위치는 `corner` 설정(`bottom-right` 기본, 4모서리) + 걷기 시 반대 모서리로 왕복.
- 유휴 `idleSleepMs`(기본 90초) 경과 시 잠들기. 전역 단축키 `Cmd/Ctrl+Shift+M`(숨김/표시), `Cmd/Ctrl+Shift+H`(인사).
- 이 값들은 `config.json`으로 덮어쓸 수 있어요 (README "설정" 참고).

### 웹훅 API 스펙 (`http://127.0.0.1:7842`)

| 메서드/경로 | 바디 | 동작 |
| --- | --- | --- |
| `POST /notify` | `{title, message, level}` | 말풍선 + OS 알림 + 캐릭터 반응. level: `info`·`success`·`warn`·`urgent`(흔들림+오래 표시) |
| `POST /activity` | `{state}` | 사용자 활동 신호 → 작업중/걷기 |
| `POST /state` | `{state, ttl}` | 임의 상태 강제 (ttl ms 후 복귀) — **`ANIM`에 등록한 커스텀 상태도 이걸로 트리거** |
| `GET /health` | – | 상태 확인 |
| `GET /debug/capture` · `/debug/pos` | – | 스크린샷/위치 (디버그) |

`config.json`에 `token`을 넣으면 `x-token` 헤더 필요. 새 엔드포인트는 main.js의 `http.createServer` 라우팅에 추가하면 됩니다.

## 마름모 아트보드 JSON 포맷

```jsonc
{
  "version": 1,
  "active": 0,            // 에디터용 — 앱은 무시
  "pages": [              // 페이지 1장 = 애니메이션 프레임 1장
    {
      "name": "인사 1",
      "cfg": {
        "cols": 36,       // 그리드 가로 칸 수
        "rows": 22,       // 그리드 세로 칸 수
        "cell": 32,       // 원본 셀 크기(px) — radius/overlap의 기준 단위
        "angleDeg": -20,  // 스큐 각도. 위로 갈수록 오른쪽으로 기움
        "line": 0,        // (미사용)
        "merge": true,    // 같은 색 연속 칸 캡슐 병합
        "radius": 9,      // 블록 모서리 라운드 (cell 기준 px)
        "overlap": 2      // 블록끼리 살짝 겹치는 양 — 이음새 제거용
      },
      "grid": [           // rows × cols 2차원 배열
        [null, null, "#0f5bdd", ...]   // hex 색상 = 픽셀, null = 빈 칸
      ]
    }
  ]
}
```

### 렌더링 규칙 (renderer/mascot.js `buildFrame`)

1. **셀 1칸 = 기울어진(-20°) 둥근 마름모 블록.** 위로 갈수록 오른쪽으로 밀리는 스큐가 걸립니다.
2. **가로로 같은 색이 이어지면 캡슐 하나로 병합**해서 그립니다. 외따로 있는 1칸짜리는 세로 방향으로 다시 병합을 시도합니다(더듬이 줄기 같은 세로선용).
3. Zzz·하트·`!` 같은 **이펙트도 별도 레이어가 아니라 프레임 그리드 안의 픽셀**입니다.
4. 캐릭터의 표시 크기/위치는 **전체 프레임의 점유 영역(bbox)을 재서 자동 매핑**됩니다. 모든 상태가 같은 매핑을 공유하므로, **프레임끼리 그리드 크기(36×22)와 몸통 위치를 맞춰야** 상태 전환 시 캐릭터가 튀지 않습니다.

## 캐릭터: 파일 네이밍이 곧 API

앱은 시작 시 `charactor/*.json`을 전부 읽고, **`스네일-와이드-<감정>[-롱].json` 이름으로 찾아 씁니다.**
즉 같은 이름으로 파일만 갈아끼우면 **코드 수정 0줄로 캐릭터가 바뀝니다.** (프리픽스 `스네일-와이드-`는 renderer/mascot.js의 `FILE_PREFIX` 상수 — 통째로 바꾸고 싶으면 이 한 줄만 수정)

앱이 실제 재생하는 파일과 스펙:

| 상태 | 파일 (`스네일-와이드-` 생략) | 프레임 | fps | loop | 트리거 |
| --- | --- | --- | --- | --- | --- |
| `idle` | 갸웃-롱 | 1프레임만 사용 | – | – | 평상시 (중립 포즈 + 코드 바운스) |
| `working` | 갸웃-롱 | 14 | 6 | ✅ | 빌드/테스트 진행 중 |
| `happy` | 신남-롱 | 14 | 9 | ✅ | 빌드 성공 |
| `notify` | 놀람-롱 | 12 | 8 | ✅ | 빌드 실패 · 알림 수신 |
| `walking` | 전진 (숏!) | 8 | 10 | ✅ | 코딩 활동 이동 중 |
| `sleeping` | 잠-숨-롱 | 12 | 4 | ✅ | 유휴 90초 |
| `greet` | 인사-롱 | 12 | 8 | 1회 | 클릭 · 첫 등장 |
| `love` | 사랑-롱 | 12 | 8 | 1회 | 웹훅/dev 패널 |
| `curious` | 갸웃-롱 | 14 | 8 | 1회 | idle 중 랜덤 |
| `peek` | 빼꼼-롱 | 23 | 7 | 1회 | idle 중 랜덤 |
| `wake` | 깸-롱 | 18 | 8 | 1회 | 잠 → 깨어남 |

- 숏 버전(`-롱` 없는 파일)은 프레임 절반짜리 축약판 — 현재 `walking`(전진)만 숏을 씁니다. 상태별 파일/fps는 renderer/mascot.js 상단 `ANIM` 레지스트리에서 바꿉니다.
- 모든 캐릭터 프레임 공통 cfg: **36×22 그리드, cell 32, angle -20°, radius 9, overlap 2.** 새로 그릴 때 이 값을 유지하는 게 안전합니다.
- ⚠️ macOS에서 한글 파일명이 NFD로 저장될 수 있는데, 앱이 NFC로 정규화해 매칭하므로 신경 안 써도 됩니다. 다만 **파일명 오타 = 그 상태만 조용히 미표시**이니 dev 패널로 꼭 확인하세요.

## 말풍선: 3종 + 가로 스트레치

말풍선 JSON도 같은 포맷이며 **1페이지(정적)**입니다. 텍스트가 길어지면 이미지를 늘리는 게 아니라, **지정한 중앙 컬럼을 그리드 규칙대로 복제**해서 픽셀이 깨지지 않게 넓힙니다 (최대 300px).

renderer/mascot.js의 `BUBBLE_STYLES` 스펙:

| 스타일 | 파일 | 그리드 | baseW | cellCss | insL / insR | padL / padR |
| --- | --- | --- | --- | --- | --- | --- |
| `classic` | (SVG 내장, 고정 크기) | – | – | – | – | – |
| `comic` | 말풍선-만화 | 30×12 | 208 | 6.05 | 6 / 20 | 32 / 24 |
| `purple` | 말풍선-메시지-퍼플 | 24×7 | 196 | 7.38 | 6 / 16 | 26 / 18 |
| `cozy` | 말풍선-코지 | 32×12 | 212 | 5.83 | 9 / 24 | 28 / 18 |

- `baseW`: 스트레치 0일 때 표시 폭(px) · `cellCss`: 셀 1칸의 CSS px
- `insL`/`insR`: 복제 삽입 지점 컬럼 인덱스 — **꼬리 양옆의 "세로로 균일한" 컬럼**을 골라야 늘려도 티가 안 납니다
- `padL`/`padR`: 텍스트 여백(px) — 모서리·꼬리 캡 폭에 맞춤

**새 말풍선 추가하기**: ① 말풍선 JSON을 그려서 `charactor/`에 넣고 ② `BUBBLE_STYLES`에 한 줄 추가 ③ 텍스트 색이 필요하면 [renderer/style.css](renderer/style.css)에 `#bubble.style-<이름>` 블록 추가 (기존 3종 참고). 레벨별 연출(`urgent` 흔들림 등)은 스타일과 무관하게 공통 적용됩니다.

## 확인 루프 (수정 → 눈으로 보기)

1. `npm start`로 실행
2. **트레이 메뉴 → 🛠 개발자 미리보기** (또는 달팽이 우클릭)
3. 상태 세그먼트/감정 칩으로 **모든 애니메이션 즉시 재생**, 말풍선 스타일·폰트(픽셀/프리텐다드) 토글
4. JSON을 바꿨으면 앱 재시작 (애니메이션은 시작 시 1회 로드)

말풍선에 실제 텍스트를 흘려보고 싶으면:

```bash
node scripts/send.js notify "제목" "메시지가 길면 말풍선이 옆으로 늘어나요" success
```

## 커스텀 아이디어

아트만 바꿔도 되고, 앱을 통째로 뜯어도 됩니다:

**아트 쪽**

- **캐릭터 갈아끼우기** — 감정 9종 파일명만 지키면 고양이든 문어든 코드 수정 없이 교체
- **프레임 추가/속도 조절** — pages 배열에 페이지 추가, `ANIM`에서 fps 조절
- **말풍선 4번째 스타일** — JSON 1개 + `BUBBLE_STYLES` 1줄
- **팔레트 스왑** — grid는 hex 문자열 배열이라 스크립트로 일괄 치환하면 컬러 바리에이션 순삭

**앱 쪽**

- **새 상태/행동 추가** — `ANIM`에 상태 등록 후 `POST /state {"state":"내상태"}`로 트리거, main.js 상태 머신에 규칙 추가
- **새 연동** — [integrations/mascot-client.js](integrations/mascot-client.js) 재사용해서 webpack/git hook/CI/슬랙 무엇이든 웹훅으로 연결
- **새 웹훅 엔드포인트** — main.js 라우팅에 추가 (예: `POST /pomodoro`로 뽀모도로 타이머)
- **안내 패널 리스킨** — guide.\* 3파일이 독립적이라 통째로 다른 UI로 교체 가능
- **창 동작 실험** — 여러 마리 소환, 화면 가장자리 따라 걷기, 다른 모니터 이주 등 main.js에서 자유롭게
