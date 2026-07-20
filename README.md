# 빌드 메이트 달팽이 🐌

코드로 그린 픽셀아트 데스크탑 달팽이. 화면 구석에 상주하며 내 **빌드·테스트·타입체크·dev 서버** 상태를 대신 지켜봐 줍니다. 터미널을 계속 쳐다보지 않아도, 달팽이 표정만 보면 지금 상태를 알 수 있어요. (Electron)

> FE 개발자용 데일리 메이트 + 컨퍼런스 안내를 겸합니다. 긴 빌드를 돌려놓고 딴짓하다 끝난 줄 모르는 순간, 달팽이가 화면 구석에서 결과를 알려줘요.

🎨 **커스텀하고 싶다면** → 기본 제공 셋(캐릭터 18종·말풍선 3종·폰트)의 포맷 스펙부터 앱 구조 맵·웹훅 API까지, 뜯어고치는 데 필요한 스펙은 [CUSTOMIZING.md](CUSTOMIZING.md)에 정리되어 있어요.

## 특징

- 🐌 **마름모 픽셀 애니메이션 달팽이** — [charactor/](charactor/)의 아트보드 JSON(페이지 = 프레임)을 그대로 재생. 네이밍 기반 감정 매핑(잠-숨/전진/갸웃/인사/신남/놀람/사랑/빼꼼/깸)
- 🔧 **빌드/테스트 메이트** — `vite build`·`vitest`·`tsc`·`eslint` 등의 시작/성공/실패에 반응
  - `npx mascot-watch <명령>` 으로 **아무 명령이나** 감싸거나, **Vite 플러그인**으로 dev 루프 실시간 연동
- 🪟 투명 · 항상 위 · 드래그 이동 가능한 창 (독/작업표시줄 숨김, 트레이 상주, 빈 영역은 클릭 통과)
- 💗 **마스코트 클릭 → 인사 + FECONF D-day 팝업** (컨퍼런스 안내 패널은 트레이 메뉴에서)
- 🔔 **웹훅**으로 알림 수신 → SVG 말풍선(픽셀 폰트) + OS 알림 + 캐릭터 반응
- 🗓 **세션 스케줄**(schedule.json)에 맞춰 자동 알림
- 😴 유휴 시 자동으로 잠자기(숨결 z), 깨울 땐 깸 애니메이션으로 부스스 일어남
- 🔕 방해 금지(DND) 모드
- ⌨️ 전역 단축키: `Cmd/Ctrl+Shift+M`(숨김/표시), `Cmd/Ctrl+Shift+H`(인사)

## 상태(애니메이션)

캐릭터 프레임은 [charactor/](charactor/)의 `스네일-와이드-*.json` — 파일 네이밍이 곧 감정입니다.

| 상태       | 애니메이션    | 언제                                    |
| ---------- | ------------ | --------------------------------------- |
| `idle`     | 중립 + 바운스 | 평상시 (가끔 갸웃/빼꼼 랜덤 재생)          |
| `working`  | 갸웃-롱 루프  | **빌드/테스트 진행 중** · 반대 모서리 도착  |
| `happy`    | 신남-롱      | **빌드 성공** · 알림 직후                 |
| `notify`   | 놀람-롱      | **빌드 실패** · 알림 수신 (실패는 놀람 유지) |
| `walking`  | 전진 루프     | `/activity`(코딩) 이동 중                |
| `sleeping` | 잠-숨-롱     | 유휴 90초 (z 숨결)                       |
| `greet`    | 인사-롱      | 클릭 · 트레이 인사 · 첫 등장              |
| `love`     | 사랑-롱      | 일회성 감정 (웹훅/개발자 패널)             |
| `curious`  | 갸웃-롱      | idle 중 두리번                           |
| `peek`     | 빼꼼-롱      | idle 중 껍데기 숨기                       |
| `wake`     | 깸-롱        | 잠에서 깨어나는 전환                      |

## 실행

```bash
npm install      # electron 설치
npm start        # 마스코트 실행
```

## 알림 보내기 (웹훅)

앱은 `http://127.0.0.1:7842` 에서 대기합니다.

```bash
# 알림 (제목/메시지/레벨)
curl -X POST localhost:7842/notify \
  -H 'Content-Type: application/json' \
  -d '{"title":"세션 시작","message":"메인홀 키노트가 시작됩니다","level":"success"}'

# 사용자 활동 → 작업중 상태
curl -X POST localhost:7842/activity -d '{"state":"working"}'

# 임의 상태 지정
curl -X POST localhost:7842/state -d '{"state":"happy","ttl":3000}'

# 상태 확인
curl localhost:7842/health
```

편의 스크립트:

```bash
node scripts/send.js notify "제목" "메시지" success
node scripts/send.js activity working
node scripts/send.js state sleeping
```

레벨: `info` · `success` · `warn` · `urgent`(흔들림 + 오래 표시)

## 🔧 빌드 메이트로 쓰기 (FE 개발 연동)

빌드/테스트/타입체크의 **시작 → 성공/실패**를 달팽이가 대신 지켜봐 줍니다.
빌드 시작 → 집중(`working`), 성공 → 기뻐함(`happy`), 실패 → 놀람(`notify`).
**앱이 꺼져 있으면 조용히 무시**되므로 빌드에 전혀 영향을 주지 않아요.

### 1) `mascot-watch` — 아무 명령이나 감싸기 (프레임워크 무관, 가장 안정적)

```bash
npx mascot-watch npm run build         # 빌드
npx mascot-watch -- vitest run         # 테스트
npx mascot-watch --label "타입체크" tsc --noEmit
```

- 명령의 출력·종료코드를 **그대로 통과**시켜요 (CI/기존 스크립트에 무해)
- `package.json` 스크립트에 그대로 넣어도 됩니다: `"build": "mascot-watch vite build"`

### 2) Vite 플러그인 — dev 루프 실시간 연동

```js
// vite.config.js
import mascot from './integrations/vite-plugin-mascot.js';

export default {
  plugins: [mascot()], // { hmr: false } 로 저장 시 반응 끄기
};
```

- **dev 서버 준비됨** → `🚀 준비 완료` + 로컬 주소
- **파일 저장(HMR)** → 집중 → 잠시 뒤 `✅ 적용됨`
- **`vite build` 성공/실패** → `✅ 빌드 완료 · N.Ns` / `🚨 빌드 실패`

### 환경변수

| 변수             | 기본값      | 설명                                  |
| ---------------- | ----------- | ------------------------------------- |
| `MASCOT_PORT`    | `7842`      | 앱 웹훅 포트                          |
| `MASCOT_TOKEN`   | (없음)      | 앱에 `token` 설정 시 함께 지정        |
| `MASCOT_HOST`    | `127.0.0.1` | 앱 호스트                             |
| `MASCOT_DISABLE` | (없음)      | `1` 이면 전송 완전히 끔 (CI 등에서)   |

> 직접 연동도 간단해요 — 무엇이든 `POST localhost:7842/state {"state":"working"}` 로 집중,
> `POST /notify {"level":"success"}` 로 성공, `{"level":"urgent"}` 로 실패를 보내면 됩니다.
> 재사용 헬퍼는 [integrations/mascot-client.js](integrations/mascot-client.js) 참고.

## 🤖 Claude Code 연동 — 작업 끝나면 달팽이가 알려줌

[Claude Code](https://claude.com/claude-code)의 **훅**에 마스코트를 연결하면, Claude Code가 작업을 마치거나 확인을 기다릴 때 달팽이가 대신 알려줘요. (긴 작업 돌려놓고 딴짓하다 놓치는 걸 방지)

**설정 방법** — `~/.claude/settings.json`(전역) 또는 프로젝트의 `.claude/settings.json` 에 `hooks` 를 추가하세요. 이미 다른 설정이 있으면 **`hooks` 키만 병합**하면 됩니다.

```jsonc
{
  "hooks": {
    // 작업 완료 → 달팽이 팔짝 (초록 말풍선)
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST localhost:7842/notify -H 'Content-Type: application/json' -d '{\"title\":\"⭐️ 야호~작업 완료~🎵⭐️\",\"message\":\"Claude Code가 작업을 마쳤어요\",\"level\":\"success\"}' >/dev/null 2>&1 || true"
          }
        ]
      }
    ],
    // 권한/입력 대기 → 달팽이 놀람 (노란 말풍선)
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST localhost:7842/notify -H 'Content-Type: application/json' -d '{\"title\":\"확인이 필요해요\",\"message\":\"Claude Code가 입력을 기다리고 있어요\",\"level\":\"warn\"}' >/dev/null 2>&1 || true"
          }
        ]
      }
    ]
  }
}
```

- 앱이 꺼져 있으면 `|| true` 로 조용히 무시돼요 → **Claude Code 작업을 절대 막지 않아요.**
- 포트를 바꿨거나 토큰을 쓰면 URL·헤더를 맞춰주세요 (`-H "x-token: 토큰"`).
- 설정 후 바로 적용 안 되면 Claude Code에서 `/hooks` 를 한 번 열거나 재시작하세요. 훅 관리·삭제도 `/hooks` 에서 할 수 있어요.
- 다른 CLI·CI·스크립트도 똑같이 `POST /notify` 한 줄이면 연동됩니다.

## 타이핑/코딩에 반응시키기

에디터/터미널에서 활동이 감지될 때 `/activity`를 호출하면 됩니다. 예:

- **VS Code**: 확장/태스크에서 저장·타이핑 시 `curl localhost:7842/activity` 호출
- **Claude Code / CLI 훅**: 작업 시작 시 `node scripts/send.js activity working`, 완료 시 `notify`
- **git hook**: `pre-commit` 에서 `node scripts/send.js state happy`

## 안내 패널 — 날짜별 3가지 상태

트레이 메뉴 → "📋 안내 패널"로 여는 안내 패널은 **오늘 날짜와 행사 날짜([conference.json](conference.json)의 `startDate`~`endDate`)를 비교**해 자동으로 바뀝니다. (마스코트 클릭은 D-day 팝업)

| 상태             | 시점               | 내용                                             |
| ---------------- | ------------------ | ------------------------------------------------ |
| 🗓 **before**    | 행사 전            | D-day 카운트다운 · 날짜 · 장소 · 주소 · Discord   |
| 🎤 **dayof**     | 행사 당일          | 다음 세션 카운트다운 + 오늘의 세션 타임라인       |
| 🎉 **after**     | 행사 후            | 감사 인사 + **후기 남기기** 버튼 + Discord        |

행사 정보는 [conference.json](conference.json) 에서 편집합니다:

```json
{
  "name": "우리 컨퍼런스 2026",
  "startDate": "2026-09-20",
  "endDate": "2026-09-20",
  "venue": "코엑스 그랜드볼룸 (3층)",
  "address": "서울 강남구 영동대로 513",
  "discord": { "url": "https://discord.gg/...", "note": "공지·네트워킹 채널" },
  "reviewUrl": "https://forms.gle/...",
  "reviewNote": "1분이면 끝나요 🙌"
}
```

`before`/`after`에서 Discord 카드와 후기 버튼을 누르면 기본 브라우저로 링크가 열립니다.

## 🛠 개발자 미리보기 (phase/시간 스크럽)

실제 날짜를 기다리지 않고 안내 패널의 **행사 전/당일/이후** 상태와 **시간대별 세션 상태**를 바로 확인할 수 있어요.

**트레이 메뉴 → "🛠 개발자 미리보기"** 를 열면 어두운 컨트롤 패널이 뜹니다:

- **Phase 세그먼트** — `자동`(날짜 기반) / `행사 전` / `당일` / `이후` 강제 전환
- **모의 시각** — 날짜·시간 직접 입력 또는 슬라이더로 하루를 스크럽
- **프리셋** — `3일 전` · `당일 09:00` · `첫 세션 직전` · `세션 진행 중` · `마지막 일정` · `다음날` 로 시간 점프
- **달팽이 상태** — 지속 상태(기본/작업/걷기/잠) 세그먼트 + 일회성 감정 칩(인사·신남·놀람·사랑·갸웃·빼꼼·깸)으로 애니메이션 즉시 확인
- **결과 readout** — 지금 적용된 phase와 시각 표시

바꾸는 즉시 안내 패널이 그 시각 기준으로 다시 그려집니다. (시계·`N분 후` 카운트다운·`곧 시작`/`종료` 뱃지 모두 반영) 패널을 닫으면 자동으로 실시간으로 복귀해요.

> 내부적으로 main 이 넘겨준 `now` 기준으로 렌더러가 시간을 흘려보내기 때문에(`simNow`), 모의 시각을 12:58로 맞추면 13:00 세션이 "곧 시작 → 종료"로 바뀌는 것까지 그대로 지켜볼 수 있어요.

## 스케줄 편집

[schedule.json](schedule.json) 에 세션을 넣으면 `leadMinutes` 전에 자동 알림이 뜹니다. 트레이 메뉴 → "🗓 스케줄 다시 로드" 로 재적용.

```json
{ "time": "2026-07-01T14:30:00", "leadMinutes": 10, "title": "AI 세션", "message": "곧 시작!", "level": "success" }
```

## 설정 (선택)

`config.json` 을 만들면 기본값을 덮어씁니다.

```json
{
  "port": 7842,
  "token": "비밀토큰",
  "corner": "bottom-right",
  "idleSleepMs": 90000,
  "guideTitle": "우리 컨퍼런스 2026",
  "guideSubtitle": "오늘의 세션"
}
```

안내 패널 헤더 제목/부제는 `guideTitle` · `guideSubtitle` 로 바꿀 수 있어요.

`token` 을 넣으면 웹훅 요청에 `x-token` 헤더(또는 `?token=`)가 필요합니다.

## 크레딧

- 말풍선 텍스트 폰트: **Mona (MonaS12)** by [Monad ABXY](https://github.com/MonadABXY/mona-font) — SIL Open Font License 1.1 ([라이선스](renderer/fonts/MonaS-OFL-LICENSE.txt), 앱에 번들)
