# 컨퍼런스 마스코트 🐌

코드로 그린 픽셀아트 데스크탑 마스코트. 화면 구석에 상주하며 **웹훅·스케줄·사용자 활동**에 반응하고, 컨퍼런스 안내 알림을 말풍선으로 띄웁니다. (Electron)

## 특징

- 🎨 코드로 그린 픽셀아트 **보라색 달팽이** (외부 이미지 에셋 없음)
- 🪟 투명 · 항상 위 · 드래그 이동 가능한 창 (독/작업표시줄 숨김, 트레이 상주)
- 📋 **왼쪽 클릭 → 안내 패널** · **오른쪽 클릭 → 개발자 미리보기** — 안내 패널은 날짜에 따라 3가지 상태로 자동 전환 (다시 클릭/✕/Esc로 닫기)
- 🎛 안내 패널은 **미니멀 모노크롬 디자인** (흰 카드 · 헤어라인 · 잉크 액센트, 색상은 CSS 변수로 관리)
- 🔔 **웹훅**으로 알림 수신 → 말풍선 + OS 알림 + 캐릭터 반응
- 🗓 **세션 스케줄**(schedule.json)에 맞춰 자동 알림
- 🚶 **코딩하면 걸어다님** — `/activity`(코딩/타이핑) 감지 중엔 화면 **반대 모서리로 걸어가고**(뒤뚱뒤뚱 + 발 번갈아), 멈추면 원래 자리로 돌아옴. `lingerMs`(기본 6초) 동안 활동이 없으면 귀가
- 😴 유휴 시 자동으로 잠자기(Zzz), 이벤트 오면 깨어남
- 🔕 방해 금지(DND) 모드
- ⌨️ 전역 단축키: `Cmd/Ctrl+Shift+M`(숨김/표시), `Cmd/Ctrl+Shift+H`(인사)

## 상태(애니메이션)

| 상태       | 언제                     | 모습                        |
| ---------- | ------------------------ | --------------------------- |
| `idle`     | 평상시                   | 두리번 · 깜빡 · 더듬이 살랑   |
| `walking`  | `/activity`(코딩) 이동 중 | 뒤뚱뒤뚱 · 방향 시선          |
| `working`  | 반대 모서리 도착·집중     | 실눈 집중 · `...`           |
| `happy`    | 클릭 · 인사 · 알림 직후   | 더듬이 쫑긋 · ^^ · 활짝 웃음 |
| `notify`   | 알림 수신                | 느낌표 튀어오름             |
| `sleeping` | 유휴 90초                | 눈 감고 Zzz                |

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

## 타이핑/코딩에 반응시키기

에디터/터미널에서 활동이 감지될 때 `/activity`를 호출하면 됩니다. 예:

- **VS Code**: 확장/태스크에서 저장·타이핑 시 `curl localhost:7842/activity` 호출
- **Claude Code / CLI 훅**: 작업 시작 시 `node scripts/send.js activity working`, 완료 시 `notify`
- **git hook**: `pre-commit` 에서 `node scripts/send.js state happy`

## 안내 패널 — 날짜별 3가지 상태

마스코트를 **왼쪽 클릭**하면 뜨는 안내 패널은 **오늘 날짜와 행사 날짜([conference.json](conference.json)의 `startDate`~`endDate`)를 비교**해 자동으로 바뀝니다.

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

**캐릭터 오른쪽 클릭** 또는 **트레이 메뉴 → "🛠 개발자 미리보기"** 를 열면 어두운 컨트롤 패널이 뜹니다:

- **Phase 세그먼트** — `자동`(날짜 기반) / `행사 전` / `당일` / `이후` 강제 전환
- **모의 시각** — 날짜·시간 직접 입력 또는 슬라이더로 하루를 스크럽
- **프리셋** — `3일 전` · `당일 09:00` · `첫 세션 직전` · `세션 진행 중` · `마지막 일정` · `다음날` 로 시간 점프
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
