'use strict';

// 개발자 미리보기 — phase 전환 + 모의 시각 스크럽

let conf = {};
let items = [];
let curPhase = ''; // '' = 자동(날짜 기반)
let curMock = null; // ms 또는 null(실시간)

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');

function startOfDayMs(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function toDTLocal(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function confDayStart() {
  const s = conf.startDate || conf.date;
  return s ? startOfDayMs(new Date(s).getTime()) : startOfDayMs(Date.now());
}

async function init() {
  try {
    const d = await window.dev.getInit();
    conf = d.conference || {};
    items = d.items || [];
  } catch (_) {}
  buildChips();
  syncTimeControls(Date.now());
  apply();
}

function buildChips() {
  const ds = confDayStart();
  const de = startOfDayMs(new Date(conf.endDate || conf.startDate || Date.now()).getTime());
  const chips = [
    ['📅 3일 전', ds - 3 * 86400000 + 10 * 3600000],
    ['🌅 당일 09:00', ds + 9 * 3600000],
  ];
  if (items.length) {
    const sorted = [...items].sort((a, b) => new Date(a.time) - new Date(b.time));
    const first = new Date(sorted[0].time).getTime();
    const last = new Date(sorted[sorted.length - 1].time).getTime();
    chips.push(['⏰ 첫 세션 직전', first - 3 * 60000]);
    chips.push(['🎤 세션 진행 중', first + 20 * 60000]);
    chips.push(['🎉 마지막 일정', last]);
  }
  chips.push(['🌙 다음날', de + 86400000 + 10 * 3600000]);

  const wrap = $('chips');
  wrap.innerHTML = '';
  for (const [label, ms] of chips) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = label;
    b.addEventListener('click', () => {
      curMock = ms;
      syncTimeControls(ms);
      apply();
    });
    wrap.appendChild(b);
  }
}

// datetime-local + slider + 라벨을 주어진 시각으로 동기화
function syncTimeControls(ms) {
  const d = new Date(ms);
  $('dt').value = toDTLocal(ms);
  const mins = d.getHours() * 60 + d.getMinutes();
  $('slider').value = mins;
  $('time-label').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function apply() {
  // phase 세그먼트 하이라이트
  document.querySelectorAll('#phase-seg button').forEach((b) => {
    b.classList.toggle('on', (b.dataset.phase || '') === (curPhase || ''));
  });
  // 실시간 버튼 상태
  $('realtime').classList.toggle('active', curMock == null);

  let res = null;
  try {
    res = await window.dev.apply({ phase: curPhase || null, mockNow: curMock });
  } catch (_) {}
  if (res) {
    $('ro-phase').textContent = res.phase;
    const d = new Date(res.now);
    $('ro-time').textContent =
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())} (${curMock == null ? '실시간' : '모의'})`;
  }
}

// ---- 이벤트 바인딩 ----
document.querySelectorAll('#phase-seg button').forEach((b) => {
  b.addEventListener('click', () => {
    curPhase = b.dataset.phase || '';
    apply();
  });
});

$('dt').addEventListener('change', () => {
  const ms = new Date($('dt').value).getTime();
  if (!isNaN(ms)) {
    curMock = ms;
    syncTimeControls(ms);
    apply();
  }
});

$('slider').addEventListener('input', () => {
  const mins = parseInt($('slider').value, 10);
  const base = curMock != null ? startOfDayMs(curMock) : startOfDayMs(Date.now());
  curMock = base + mins * 60000;
  $('time-label').textContent = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  $('dt').value = toDTLocal(curMock);
  apply();
});

$('realtime').addEventListener('click', () => {
  curMock = null;
  syncTimeControls(Date.now());
  apply();
});

// ---- 달팽이 상태/감정 ----
document.querySelectorAll('#snail-base button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#snail-base button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    window.dev.setState(b.dataset.state); // ttl 없음 → 지속 상태
  });
});

document.querySelectorAll('#snail-emotes .chip').forEach((b) => {
  b.addEventListener('click', () => {
    window.dev.setState(b.dataset.state); // ttl 없음 → 렌더러가 애니메이션 길이만큼 재생
    b.classList.add('flash');
    setTimeout(() => b.classList.remove('flash'), 350);
  });
});

$('hide').addEventListener('click', () => {
  if (window.dev && window.dev.hide) window.dev.hide();
});

init();
