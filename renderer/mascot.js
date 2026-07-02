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
  body: '#C9A6F0', // 연보라 몸통(발/머리)
  shade: '#A87BE0', // 어두운 보라 음영
  shell: '#8E5BD6', // 껍데기 보라
  shellDark: '#5E3AA6', // 나선 라인
  shellLight: '#BE97EC', // 껍데기 하이라이트
  pink: '#F0A6D0', // 볼터치
  white: '#ffffff',
  eye: '#2b2620',
  mouth: '#7A3A6E',
  red: '#E8433B', // notify 이펙트
  z: '#B39DDB', // 졸음 표시
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

// 눈 자루(더듬이) 끝 위치 — 매 프레임 drawCat 에서 갱신
let stalkTipL = { x: 45, y: 15 };
let stalkTipR = { x: 51, y: 12 };

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

  const sway = Math.sin(t * tailSpeed) * tailAmp; // 더듬이 흔들림

  // ============ 발 (몸통 바닥) ============
  block(8, 45 + breathe, 47, 9 - breathe, C.body);
  clr(8, 45 + breathe, 2, 1);
  clr(53, 45 + breathe, 2, 1);
  clr(8, 45 + breathe, 1, 3); // 왼쪽 꼬리 끝 둥글게
  clr(8, 52, 3, 2);
  clr(52, 52, 3, 2);
  fill(11, 51, 41, 2, C.shade); // 바닥 그림자
  fill(13, 46, 30, 1, C.shellLight); // 윗면 하이라이트

  // ============ 머리 (앞쪽/오른쪽) ============
  block(42, 34, 15, 18, C.body);
  clr(42, 34, 2, 2);
  clr(55, 34, 2, 2);
  clr(42, 50, 2, 2);
  clr(55, 50, 2, 2);
  fill(51, 43, 3, 2, C.pink); // 볼터치

  // ============ 껍데기 (나선 돔) ============
  drawShell(t);

  // ============ 더듬이 (눈 자루) ============
  const tlx = 45 + Math.round(sway * 0.4);
  const trx = 51 + Math.round(sway * 0.6);
  const tlTop = 15;
  const trTop = 12;
  drawStalk(46, 36, tlx + 2, tlTop + 6);
  drawStalk(52, 36, trx + 2, trTop + 6);
  stalkTipL = { x: tlx, y: tlTop };
  stalkTipR = { x: trx, y: trTop };

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

// ---- 얼굴(눈 자루 끝 눈알 + 입) --------------------------------------------
function drawFace(state, t) {
  const L = stalkTipL,
    R = stalkTipR;

  // 깜빡임 (idle/working/walking 에서만)
  const blink = (state === 'idle' || state === 'working' || state === 'walking') && t % 4.2 < 0.14;

  if (state === 'sleeping' || blink) {
    snailClosedEye(L.x, L.y);
    snailClosedEye(R.x, R.y);
  } else if (state === 'walking') {
    // 걷는 방향을 바라봄
    snailEye(L.x, L.y, walkDir);
    snailEye(R.x, R.y, walkDir);
  } else if (state === 'happy' || state === 'notify') {
    snailHappyEye(L.x, L.y);
    snailHappyEye(R.x, R.y);
  } else if (state === 'working') {
    // 집중한 실눈
    block(L.x, L.y + 2, 5, 3, C.white);
    fill(L.x + 1, L.y + 3, 3, 1, C.eye);
    block(R.x, R.y + 2, 5, 3, C.white);
    fill(R.x + 1, R.y + 3, 3, 1, C.eye);
  } else {
    // idle — 또렷한 눈 + 살짝 두리번
    if (t - lastLook.t > 2.5) {
      lastLook = {
        t,
        dx: [0, 0, 1, -1, 0][Math.floor(t) % 5],
        dy: 0,
      };
    }
    snailEye(L.x, L.y, lastLook.dx);
    snailEye(R.x, R.y, lastLook.dx);
  }

  // 입 (머리 앞쪽)
  const mx = 47,
    my = 45;
  if (state === 'happy' || state === 'notify') {
    // 활짝 웃는 입
    block(mx, my, 6, 4, C.mouth);
    fill(mx + 2, my + 2, 2, 1, C.pink); // 혀
  } else if (state === 'working') {
    fill(mx + 2, my + 1, 2, 2, C.outline); // 오물오물 집중
  } else if (state === 'sleeping') {
    fill(mx + 1, my + 1, 4, 1, C.outline); // 무표정 라인
  } else {
    // idle 미소 ‿
    fill(mx, my, 1, 1, C.outline);
    fill(mx + 1, my + 1, 4, 1, C.outline);
    fill(mx + 5, my, 1, 1, C.outline);
  }
}

// 눈 자루 끝의 동그란 눈알
function snailEye(x, y, dx) {
  block(x, y, 5, 6, C.white);
  fill(x + 1 + (dx || 0), y + 2, 2, 3, C.eye); // 눈동자
  fill(x + 1 + (dx || 0), y + 2, 1, 1, C.white); // 반사광
}
function snailHappyEye(x, y) {
  // ^ 모양
  fill(x, y + 4, 1, 1, C.eye);
  fill(x + 1, y + 2, 1, 1, C.eye);
  fill(x + 2, y + 1, 2, 1, C.eye);
  fill(x + 4, y + 2, 1, 1, C.eye);
  fill(x + 5, y + 4, 1, 1, C.eye);
}
function snailClosedEye(x, y) {
  // ‿ 모양 (감은 눈)
  fill(x, y + 3, 1, 1, C.eye);
  fill(x + 1, y + 4, 3, 1, C.eye);
  fill(x + 4, y + 3, 1, 1, C.eye);
}

// ---- 껍데기 / 더듬이 그리기 -------------------------------------------------
// 채워진 원(픽셀 디스크)
function disc(cx, cy, r, c) {
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    if (w > 0) fill(cx - w, cy + y, w * 2, 1, c);
  }
}
function drawShell(t) {
  const cx = 25,
    cy = 31,
    R = 13;
  disc(cx, cy, R + 1, C.outline); // 외곽선
  disc(cx, cy, R, C.shell);
  disc(cx, cy, R - 3, C.shellLight); // 안쪽 밝은 링
  disc(cx, cy, R - 5, C.shell);
  drawSpiral(cx, cy, R - 1, C.shellDark); // 나선
  fill(cx - 1, cy - 1, 2, 2, C.shellDark); // 중심점
  // 좌상단 하이라이트 테두리
  for (let a = Math.PI * 0.92; a < Math.PI * 1.5; a += 0.12) {
    const x = Math.round(cx + Math.cos(a) * (R - 1));
    const y = Math.round(cy + Math.sin(a) * (R - 1));
    fill(x, y, 2, 2, C.shellLight);
  }
}
function drawSpiral(cx, cy, R, c) {
  const maxA = Math.PI * 2 * 2.3; // 2.3 회전
  for (let a = 0.5; a < maxA; a += 0.1) {
    const r = (a / maxA) * R;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    fill(x, y, 2, 2, c);
  }
}
// 눈 자루(머리 → 눈알 아래)
function drawStalk(x0, y0, x1, y1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    fill(x, y, 2, 2, C.body);
  }
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
