'use strict';

// ===========================================================================
// 마스코트 — 파란 마름모 달팽이
// 아트/애니메이션: charactor/*.json (마름모 아트보드 포맷, 유저 제작)
//   페이지 1장 = 프레임 1장. 셀 1칸 = 기울어진(-20°) 둥근 마름모 블록,
//   같은 색 연속 구간(가로/세로)은 캡슐로 병합해서 그린다.
//   이펙트(Zzz/!/하트/물음표)도 아트 프레임 안에 포함되어 있다.
// 감정 매핑 (파일 네이밍 기반):
//   잠-숨→sleeping   전진→walking   갸웃→working·curious   인사→greet
//   신남→happy      놀람→notify    사랑→love   빼꼼→peek   깸→wake
// ===========================================================================

const cv = document.getElementById('cat');
const ctx = cv.getContext('2d');

// 논리 좌표계 64x44, 백킹 6배
const LW = 64;
const LH = 44;
const SCALE = 6;
cv.width = LW * SCALE;
cv.height = LH * SCALE;
ctx.scale(SCALE, SCALE);
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

const bubble = document.getElementById('bubble');
const bTitle = document.getElementById('bubble-title');
const bMsg = document.getElementById('bubble-msg');
const dndBadge = document.getElementById('dnd-badge');

// ---- 애니메이션 레지스트리 ---------------------------------------------------
// file: charactor/스네일-와이드-<file>.json, loop: 상태 유지 중 반복 여부
const FILE_PREFIX = '스네일-와이드-';
const ANIM = {
  idle: { file: '갸웃-롱', fps: 0, loop: true }, // 중립 포즈(1프레임) + 바운스
  sleeping: { file: '잠-숨-롱', fps: 4, loop: true },
  walking: { file: '전진', fps: 10, loop: true },
  working: { file: '갸웃-롱', fps: 6, loop: true },
  happy: { file: '신남-롱', fps: 9, loop: true },
  notify: { file: '놀람-롱', fps: 8, loop: true },
  greet: { file: '인사-롱', fps: 8, loop: false },
  love: { file: '사랑-롱', fps: 8, loop: false },
  curious: { file: '갸웃-롱', fps: 8, loop: false },
  peek: { file: '빼꼼-롱', fps: 7, loop: false },
  wake: { file: '깸-롱', fps: 8, loop: false },
};

// ---- 프레임 렌더링 (마름모 캡슐 병합) ------------------------------------------
const CELLPX = 10; // 오프스크린 셀 픽셀 (백킹 해상도에 맞춤)
let animsRaw = null; // { '스네일-와이드-…': { pages } }
let VIEW = null; // 그리드 px → 논리 좌표 매핑 { s, ox, oy, cellL, tanA }
const frameCache = new Map(); // file → HTMLCanvasElement[]

function skewX(y, H, tanA) {
  return (H - y) * tanA; // 위로 갈수록 오른쪽 (원본 아트 기울기)
}

function toward(a, b, dist) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.min(0.5, dist / len);
  return [a[0] + dx * t, a[1] + dy * t];
}

// 둥근 마름모 블록 — (x,y,w,h)는 스큐 전 그리드 px 사각형
function drawBlock(g, x, y, w, h, color, m) {
  x -= m.ov;
  y -= m.ov;
  w += m.ov * 2;
  h += m.ov * 2;
  const P = [
    [x + skewX(y, m.H, m.tanA), y],
    [x + w + skewX(y, m.H, m.tanA), y],
    [x + w + skewX(y + h, m.H, m.tanA), y + h],
    [x + skewX(y + h, m.H, m.tanA), y + h],
  ];
  const r = Math.min(m.r, w / 2, h / 2);
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    const p = P[i];
    const a = toward(p, P[(i + 3) % 4], r);
    const b = toward(p, P[(i + 1) % 4], r);
    if (i === 0) g.moveTo(a[0], a[1]);
    else g.lineTo(a[0], a[1]);
    g.quadraticCurveTo(p[0], p[1], b[0], b[1]);
  }
  g.closePath();
  g.fill();
}

function buildFrame(page) {
  const cfg = page.cfg;
  const cell = CELLPX;
  const tanA = Math.tan((Math.abs(cfg.angleDeg) * Math.PI) / 180);
  const H = cfg.rows * cell;
  const c = document.createElement('canvas');
  c.width = Math.ceil(cfg.cols * cell + H * tanA) + 4;
  c.height = H + 4;
  const g = c.getContext('2d');
  g.translate(2, 2);
  const m = {
    H,
    tanA,
    r: (cfg.radius / cfg.cell) * cell,
    ov: (cfg.overlap / cfg.cell) * cell,
  };

  // 1) 가로 같은 색 run 병합 → 캡슐. 길이 1은 세로 병합 후보로 보류
  const singles = [];
  for (let y = 0; y < cfg.rows; y++) {
    const row = page.grid[y] || [];
    for (let x = 0; x < cfg.cols; ) {
      const col = row[x];
      if (!col) {
        x++;
        continue;
      }
      let x2 = x;
      while (x2 + 1 < cfg.cols && row[x2 + 1] === col) x2++;
      if (x2 > x) drawBlock(g, x * cell, y * cell, (x2 - x + 1) * cell, cell, col, m);
      else singles.push({ x, y, col });
      x = x2 + 1;
    }
  }
  // 2) 외따로 선 세로 열(더듬이 줄기 등) → 세로 캡슐
  singles.sort((a, b) => a.x - b.x || a.y - b.y);
  for (let i = 0; i < singles.length; ) {
    const s = singles[i];
    let j = i;
    while (
      j + 1 < singles.length &&
      singles[j + 1].x === s.x &&
      singles[j + 1].y === singles[j].y + 1 &&
      singles[j + 1].col === s.col
    )
      j++;
    drawBlock(g, s.x * cell, s.y * cell, cell, (j - i + 1) * cell, s.col, m);
    i = j + 1;
  }
  return c;
}

// macOS 파일명은 NFD 로 올 수 있으므로 키를 NFC 로 정규화해서 찾는다
function animData(file) {
  return animsRaw ? animsRaw[(FILE_PREFIX + file).normalize('NFC')] : null;
}

function framesFor(file) {
  let frames = frameCache.get(file);
  if (!frames) {
    const data = animData(file);
    frames = data ? data.pages.map(buildFrame) : [];
    frameCache.set(file, frames);
  }
  return frames;
}

// 전체 애니메이션의 점유 영역(bbox)을 재서 논리 좌표 매핑을 만든다.
// 모든 프레임이 같은 매핑을 쓰므로 상태가 바뀌어도 캐릭터 위치가 튀지 않는다.
function computeView() {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    tanA = 0.36;
  for (const data of Object.values(animsRaw)) {
    for (const page of data.pages) {
      const cfg = page.cfg;
      const cell = CELLPX;
      const H = cfg.rows * cell;
      tanA = Math.tan((Math.abs(cfg.angleDeg) * Math.PI) / 180);
      for (let y = 0; y < cfg.rows; y++) {
        const row = page.grid[y] || [];
        for (let x = 0; x < cfg.cols; x++) {
          if (!row[x]) continue;
          minX = Math.min(minX, x * cell + skewX((y + 1) * cell, H, tanA));
          maxX = Math.max(maxX, (x + 1) * cell + skewX(y * cell, H, tanA));
          minY = Math.min(minY, y * cell);
          maxY = Math.max(maxY, (y + 1) * cell);
        }
      }
    }
  }
  const s = Math.min(62 / (maxX - minX), 40 / (maxY - minY));
  VIEW = {
    s,
    ox: (LW - (maxX - minX) * s) / 2 - (minX + 2) * s, // -2: buildFrame 패딩 보정
    oy: 42.5 - (maxY + 2) * s,
    cellL: CELLPX * s,
    tanA,
  };
}

if (window.mascot && window.mascot.getAnims) {
  window.mascot.getAnims().then((d) => {
    animsRaw = d;
    computeView();
    framesFor(ANIM.idle.file); // 첫 화면용 미리 빌드
  });
}

// ---- 상태 관리 --------------------------------------------------------------
let baseState = 'idle'; // idle | sleeping | walking | working (지속 상태)
let temp = null; // { state, until }  (일시 상태)
let walkDir = -1; // 걷는 방향(-1 왼쪽, +1 오른쪽)
const BASE_STATES = ['idle', 'sleeping', 'walking', 'working'];

function effectiveState() {
  if (temp && performance.now() < temp.until) return temp.state;
  temp = null;
  return baseState;
}

function setTemp(state, ttl) {
  temp = { state, until: performance.now() + (ttl || defaultTtl(state)) };
}

// 일회성 감정은 애니메이션 길이만큼 재생
function defaultTtl(state) {
  const a = ANIM[state];
  if (!a || !animsRaw) return 2000;
  if (a.loop) return 3000;
  const data = animData(a.file);
  const n = data ? data.pages.length : 8;
  return (n / a.fps) * 1000 + 120;
}

// 잠에서 깨는 전환 — 깸 애니메이션을 먼저 재생하고 이어서 next 실행
function wakeThen(next) {
  setTemp('wake');
  if (next) setTimeout(next, defaultTtl('wake'));
}

// ===========================================================================
// 캐릭터 렌더링
// ===========================================================================
let lastState = null;
let stateStart = 0;
let nextQuirk = 0; // idle 중 가끔 갸웃/빼꼼

function drawCat(now) {
  const state = effectiveState();
  if (state !== lastState) {
    lastState = state;
    stateStart = now;
  }
  ctx.clearRect(0, 0, LW, LH);
  if (!animsRaw || !VIEW) return;

  // idle 로 가만히 있으면 가끔 두리번(갸웃)/빼꼼
  if (state !== 'idle') {
    nextQuirk = now + 8000;
  } else if (now > nextQuirk) {
    setTemp(Math.random() < 0.6 ? 'curious' : 'peek');
    nextQuirk = now + 9000 + Math.random() * 10000;
  }

  const a = ANIM[state] || ANIM.idle;
  const frames = framesFor(a.file);
  if (!frames.length) return;
  let idx = 0;
  if (a.fps > 0) {
    idx = Math.floor(((now - stateStart) / 1000) * a.fps);
    idx = a.loop ? idx % frames.length : Math.min(idx, frames.length - 1);
  }
  const frame = frames[idx];

  ctx.save();
  // 기본은 왼쪽을 보는 그림 — 오른쪽으로 걸을 땐 좌우 반전
  if (state === 'walking' && walkDir > 0) {
    ctx.translate(LW, 0);
    ctx.scale(-1, 1);
  }
  // idle 홀드 중엔 그리드 칸 단위 바운스 (기울기 축을 따라: 아래 1칸 = 왼쪽 tanA칸)
  if (state === 'idle') {
    const bob = Math.round(Math.sin((now / 1000) * 1.6) * 0.6);
    ctx.translate(-bob * VIEW.tanA * VIEW.cellL, bob * VIEW.cellL);
  }
  ctx.drawImage(frame, VIEW.ox, VIEW.oy, frame.width * VIEW.s, frame.height * VIEW.s);
  ctx.restore();
}

// ===========================================================================
// 알림 말풍선
// ===========================================================================
let bubbleTimer = null;
const LEVEL_ICON = { info: '💬', success: '✅', warn: '⚠️', urgent: '🚨' };

function showBubble({ title, message, level }) {
  bubble.className = 'level-' + (level || 'info');
  bTitle.innerHTML = '';
  const icon = document.createElement('span');
  icon.textContent = LEVEL_ICON[level] || '💬';
  const txt = document.createElement('span');
  txt.textContent = title || '알림';
  bTitle.appendChild(icon);
  bTitle.appendChild(txt);
  bMsg.textContent = message || '';
  bMsg.style.display = message ? 'block' : 'none';
  bubble.classList.remove('hidden');
  // 리플로우로 애니메이션 재시작
  void bubble.offsetWidth;

  if (bubbleTimer) clearTimeout(bubbleTimer);
  const dur = level === 'urgent' ? 12000 : 6500;
  bubbleTimer = setTimeout(hideBubble, dur);

  // 캐릭터 반응: 놀람 → 신남
  setTemp('notify', 1600);
  setTimeout(() => setTemp('happy', 1800), 1600);
}
function hideBubble() {
  bubble.classList.add('hidden');
}
bubble.addEventListener('click', hideBubble);

// ===========================================================================
// 메인 프로세스 이벤트 연결
// ===========================================================================
if (window.mascot) {
  window.mascot.onNotify((d) => showBubble(d));
  window.mascot.onState(({ state, ttl, dir }) => {
    if (dir != null) walkDir = dir;
    if (!ttl && BASE_STATES.includes(state)) {
      const prev = baseState;
      baseState = state;
      if (prev === 'sleeping' && state !== 'sleeping') wakeThen(); // 깨어나는 연출
    } else if (ANIM[state]) {
      if (baseState === 'sleeping') {
        baseState = 'idle';
        wakeThen(() => setTemp(state, ttl));
      } else {
        setTemp(state, ttl);
      }
    }
  });
  window.mascot.onDnd(({ dnd }) => {
    dndBadge.classList.toggle('hidden', !dnd);
  });
}

// ===========================================================================
// 클릭 통과 (투명 영역)
// ===========================================================================
// 창은 300x320 이지만 실제 캐릭터는 하단 일부뿐 — 캐릭터/말풍선 위에 커서가
// 있을 때만 마우스를 잡고, 나머지 투명 영역은 아래 앱으로 클릭을 통과시킨다.
// (메인 프로세스가 forward:true 로 mousemove 를 계속 보내줘서 hover 감지 가능)
let dragging = false;

function setIgnoreMouse(ignore) {
  if (window.mascot && window.mascot.setIgnoreMouse) {
    window.mascot.setIgnoreMouse(ignore);
  }
}
function overInteractive() {
  return cv.matches(':hover') || bubble.matches(':hover');
}
for (const el of [cv, bubble]) {
  el.addEventListener('mouseenter', () => setIgnoreMouse(false));
  el.addEventListener('mouseleave', () => {
    // 드래그 중 커서가 잠깐 벗어나도 창을 놓치지 않도록 유지
    if (!dragging && !overInteractive()) setIgnoreMouse(true);
  });
}
setIgnoreMouse(true);

// ===========================================================================
// 드래그 이동 & 클릭
// ===========================================================================
let moved = 0;
let last = { x: 0, y: 0 };

cv.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return; // 왼쪽 버튼만 드래그/클릭 처리
  dragging = true;
  moved = 0;
  last = { x: e.screenX, y: e.screenY };
});

// 오른쪽 클릭 → 개발자 미리보기 패널
cv.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (window.mascot) window.mascot.rightClick();
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.screenX - last.x;
  const dy = e.screenY - last.y;
  moved += Math.abs(dx) + Math.abs(dy);
  last = { x: e.screenX, y: e.screenY };
  if (window.mascot) window.mascot.drag(dx, dy);
});
window.addEventListener('mouseup', () => {
  if (dragging && moved < 4) {
    // 클릭 → 자고 있으면 깨우고, 아니면 인사
    if (baseState === 'sleeping') {
      baseState = 'idle';
      wakeThen(() => setTemp('greet'));
    } else {
      setTemp('greet');
    }
    if (window.mascot) window.mascot.click();
  }
  dragging = false;
  // 드래그가 끝났을 때 커서가 캐릭터 밖이면 다시 클릭 통과로
  if (!overInteractive()) setIgnoreMouse(true);
});

// ===========================================================================
// 애니메이션 루프
// ===========================================================================
function loop(now) {
  drawCat(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
