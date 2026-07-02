'use strict';

// ===========================================================================
// 픽셀아트 마스코트 — 코드로 그리는 카카오옐로 고양이
// 상태: idle / working / happy / notify / sleeping
// ===========================================================================

const cv = document.getElementById('cat');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

const bubble = document.getElementById('bubble');
const bTitle = document.getElementById('bubble-title');
const bMsg = document.getElementById('bubble-msg');
const dndBadge = document.getElementById('dnd-badge');
const shadow = document.getElementById('shadow');

// ---- 팔레트 -----------------------------------------------------------------
const C = {
  outline: '#2b2620',
  body: '#FDDC3F',
  shade: '#EAC420',
  pink: '#F79FB4',
  white: '#ffffff',
  eye: '#2b2620',
  mouth: '#C24C5B',
  red: '#E8433B',
  z: '#7aa7d8',
};

// ---- 그리기 헬퍼 (논리 좌표 = 64x64) ---------------------------------------
function fill(x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}
function clr(x, y, w, h) {
  ctx.clearRect(x | 0, y | 0, w | 0, h | 0);
}
// 1px 어두운 외곽선이 있는 블록
function block(x, y, w, h, c) {
  fill(x, y, w, h, C.outline);
  fill(x + 1, y + 1, w - 2, h - 2, c);
}
// 위로 뾰족한 삼각형 (귀). apexY = 꼭짓점, h = 높이
function tri(cx, apexY, h, c) {
  for (let i = 0; i < h; i++) {
    const half = i + 1;
    fill(cx - half, apexY + i, half * 2, 1, c);
  }
}

// ---- 상태 관리 --------------------------------------------------------------
let baseState = 'idle'; // idle | sleeping | walking | working (지속 상태)
let temp = null; // { state, until }  (일시 상태)
let lastLook = { t: 0, dx: 0, dy: 0 };
let walkDir = -1; // 걷는 방향(-1 왼쪽, +1 오른쪽)
const BASE_STATES = ['idle', 'sleeping', 'walking', 'working'];

function effectiveState() {
  if (temp && performance.now() < temp.until) return temp.state;
  temp = null;
  return baseState;
}

function setTemp(state, ttl) {
  temp = { state, until: performance.now() + (ttl || 3000) };
}

// ===========================================================================
// 캐릭터 렌더링
// ===========================================================================
function drawCat(now) {
  const t = now / 1000;
  const state = effectiveState();
  ctx.clearRect(0, 0, 64, 64);

  // --- 상태별 모션 파라미터 ---
  let bobSpeed = 1.6,
    bobAmp = 1.2,
    tailSpeed = 1.4,
    tailAmp = 2;
  if (state === 'happy') {
    bobSpeed = 7;
    bobAmp = 3;
    tailSpeed = 9;
    tailAmp = 3;
  } else if (state === 'working') {
    bobSpeed = 5;
    bobAmp = 0.8;
    tailSpeed = 6;
    tailAmp = 1;
  } else if (state === 'notify') {
    bobSpeed = 9;
    bobAmp = 3.5;
    tailSpeed = 10;
    tailAmp = 3;
  } else if (state === 'sleeping') {
    bobSpeed = 0.9;
    bobAmp = 0.8;
    tailSpeed = 0.5;
    tailAmp = 1;
  } else if (state === 'walking') {
    bobSpeed = 8;
    bobAmp = 1.6;
    tailSpeed = 9;
    tailAmp = 3;
  }

  const bob = Math.round(Math.sin(t * bobSpeed) * bobAmp);
  const breathe = state === 'sleeping' ? Math.round(Math.sin(t * 0.9) * 1) : 0;
  // 걷기: 좌우 뒤뚱 + 발 번갈아
  const gait = state === 'walking' ? Math.sin(t * 8) : 0;
  const waddle = state === 'walking' ? Math.round(gait * 2) : 0;

  ctx.save();
  ctx.translate(waddle, bob);

  // 그림자 반응
  const sScale = 1 - bob * 0.03;
  shadow.style.transform = `scaleX(${sScale.toFixed(3)})`;

  // ============ 꼬리 (뒤쪽부터) ============
  const tw = Math.sin(t * tailSpeed) * tailAmp;
  const tail = [
    [45, 46],
    [48, 44],
    [50, 41],
    [51, 37],
    [50, 34],
  ];
  tail.forEach(([tx, ty], i) => {
    const off = Math.round((tw * (i + 1)) / tail.length);
    block(tx + off, ty, 4, 4, C.body);
  });

  // ============ 몸통 ============
  block(20, 34 + breathe, 24, 22 - breathe, C.body);
  clr(20, 34 + breathe, 2, 2); // 상단 코너 라운드
  clr(42, 34 + breathe, 2, 2);
  clr(20, 54, 2, 2); // 하단 코너
  clr(42, 54, 2, 2);
  // 배 하이라이트
  fill(26, 44, 12, 9, C.white);
  clr(26, 44, 1, 1);
  clr(37, 44, 1, 1);

  // 앞발 (walking 시 번갈아 스텝)
  const pawLy = 52 - (gait > 0.2 ? 2 : 0);
  const pawRy = 52 - (gait < -0.2 ? 2 : 0);
  block(23, pawLy, 7, 6, C.body);
  block(34, pawRy, 7, 6, C.body);

  // ============ 귀 ============
  tri(23, 6, 8, C.outline);
  tri(23, 7, 6, C.body);
  tri(23, 10, 3, C.pink);
  tri(41, 6, 8, C.outline);
  tri(41, 7, 6, C.body);
  tri(41, 10, 3, C.pink);

  // ============ 머리 ============
  block(16, 12, 32, 24, C.body);
  // 라운드 코너
  clr(16, 12, 2, 2);
  clr(46, 12, 2, 2);
  clr(16, 34, 2, 2);
  clr(46, 34, 2, 2);
  clr(16, 12, 1, 3);
  clr(47, 12, 1, 3);

  // 볼터치
  fill(19, 27, 4, 3, C.pink);
  fill(41, 27, 4, 3, C.pink);

  drawFace(state, t);

  ctx.restore();

  // ============ 상태 이펙트 (머리 위) ============
  ctx.save();
  ctx.translate(0, bob);
  if (state === 'sleeping') drawZzz(t);
  else if (state === 'notify') drawBang(t);
  else if (state === 'working') drawDots(t);
  ctx.restore();
}

// ---- 얼굴(눈/코/입) ---------------------------------------------------------
function drawFace(state, t) {
  const lx = 22,
    rx = 36,
    ey = 21; // 눈 기준 좌표

  // 깜빡임 (idle/working/walking 에서만)
  const blink = (state === 'idle' || state === 'working' || state === 'walking') && t % 4.2 < 0.14;

  if (state === 'sleeping' || blink) {
    // 감은 눈 (부드러운 곡선)
    closedEye(lx);
    closedEye(rx);
  } else if (state === 'walking') {
    // 걷는 방향을 바라봄
    openEye(lx, ey, walkDir);
    openEye(rx, ey, walkDir);
  } else if (state === 'happy' || state === 'notify') {
    happyEye(lx, ey);
    happyEye(rx, ey);
  } else if (state === 'working') {
    // 집중한 실눈
    fill(lx, ey + 2, 5, 2, C.eye);
    fill(rx, ey + 2, 5, 2, C.eye);
  } else {
    // idle — 또렷한 눈 + 살짝 두리번
    if (t - lastLook.t > 2.5) {
      lastLook = {
        t,
        dx: [0, 0, 1, -1, 0][Math.floor(t) % 5],
        dy: 0,
      };
    }
    openEye(lx, ey, lastLook.dx);
    openEye(rx, ey, lastLook.dx);
  }

  // 코
  fill(31, 27, 2, 2, C.pink);

  // 입
  if (state === 'happy' || state === 'notify') {
    // 활짝 웃는 입
    block(29, 30, 6, 4, C.mouth);
    fill(31, 32, 2, 1, C.pink); // 혀
  } else if (state === 'working') {
    fill(31, 31, 2, 2, C.outline); // 오물오물 집중
  } else if (state === 'sleeping') {
    fill(30, 31, 4, 1, C.outline); // 무표정 라인
  } else {
    // idle 미소 ‿
    fill(29, 30, 1, 1, C.outline);
    fill(30, 31, 4, 1, C.outline);
    fill(34, 30, 1, 1, C.outline);
  }
}

function openEye(x, y, dx) {
  block(x, y, 6, 7, C.white);
  fill(x + 2 + dx, y + 2, 2, 3, C.eye); // 눈동자
  fill(x + 2 + dx, y + 2, 1, 1, C.white); // 반사광
}
function happyEye(x, y) {
  // ^ 모양
  fill(x, y + 4, 1, 1, C.eye);
  fill(x + 1, y + 2, 1, 1, C.eye);
  fill(x + 2, y + 1, 2, 1, C.eye);
  fill(x + 4, y + 2, 1, 1, C.eye);
  fill(x + 5, y + 4, 1, 1, C.eye);
}
function closedEye(x) {
  // ‿ 모양 (감은 눈)
  fill(x, 25, 1, 1, C.eye);
  fill(x + 1, 26, 4, 1, C.eye);
  fill(x + 5, 25, 1, 1, C.eye);
}

// ---- 이펙트 -----------------------------------------------------------------
function drawZzz(t) {
  const zs = [
    { s: 4, ph: 0 },
    { s: 3, ph: 1 },
    { s: 2, ph: 2 },
  ];
  zs.forEach(({ s, ph }) => {
    const p = (t * 0.6 + ph) % 3; // 0~3 반복
    const x = 44 + p * 3;
    const y = 12 - p * 4;
    ctx.globalAlpha = Math.max(0, 1 - p / 3);
    drawZ(x, y, s, C.z);
  });
  ctx.globalAlpha = 1;
}
function drawZ(x, y, s, c) {
  fill(x, y, s, 1, c);
  fill(x + s - Math.ceil(s / 2), y + 1, 1, 1, c);
  fill(x, y + 2, s, 1, c);
}
function drawBang(t) {
  const b = Math.abs(Math.sin(t * 8)) * 3;
  const y = 2 - b;
  fill(31, y, 2, 5, C.red);
  fill(31, y + 6, 2, 2, C.red);
}
function drawDots(t) {
  const n = Math.floor((t * 3) % 4); // 0,1,2,3
  for (let i = 0; i < 3; i++) {
    fill(47 + i * 3, 14, 2, 2, i < n ? C.outline : C.shade);
  }
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

  // 캐릭터 반응
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
      baseState = state; // 지속 상태 전환
    } else {
      setTemp(state, ttl || 3000);
      if (baseState === 'sleeping') baseState = 'idle'; // 깨우기
    }
  });
  window.mascot.onDnd(({ dnd }) => {
    dndBadge.classList.toggle('hidden', !dnd);
  });
}

// ===========================================================================
// 드래그 이동 & 클릭
// ===========================================================================
let dragging = false;
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
    // 클릭 → 인사
    setTemp('happy', 1800);
    if (baseState === 'sleeping') baseState = 'idle';
    if (window.mascot) window.mascot.click();
  }
  dragging = false;
});

// ===========================================================================
// 애니메이션 루프
// ===========================================================================
function loop(now) {
  drawCat(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
