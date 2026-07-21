'use strict';

// 컨퍼런스 안내 패널 — 행사 전 / 당일 / 이후 3가지 상태
// 시간은 main 이 넘겨준 data.now 를 기준으로 흐름(simNow) → 개발용 모의 시각 지원

const contentEl = document.getElementById('content');
const clockEl = document.getElementById('clock');
const titleEl = document.getElementById('title');
const subtitleEl = document.getElementById('subtitle');
const footerEl = document.getElementById('footer-text');

let data = { items: [], conference: {}, phase: 'dayof' };

// ---- 시뮬레이션 시계 ---------------------------------------------------------
let baseNow = Date.now();
let baseMono = performance.now();
function setBase(d) {
  baseNow = d && typeof d.now === 'number' ? d.now : Date.now();
  baseMono = performance.now();
}
function simNow() {
  return baseNow + (performance.now() - baseMono);
}

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// ---- SVG 아이콘 (Lucide 스타일 stroke + Discord 로고) ----
const ICONS = {
  calendar:
    '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  map: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3Z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
  arrow: '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
  pencil: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  discord:
    '<path fill="currentColor" stroke="none" d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.291.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/>',
};
function iconEl(name, cls) {
  const span = el('span', cls);
  span.innerHTML =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return span;
}

function startOfDay(ds) {
  const d = ds != null ? new Date(ds) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function fmtDate(ds) {
  const d = new Date(ds);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${WD[d.getDay()]})`;
}
function dateRange(conf) {
  const s = conf.startDate || conf.date;
  const e = conf.endDate || s;
  if (!s) return '';
  if (startOfDay(s) === startOfDay(e)) return fmtDate(s);
  return `${fmtDate(s)} ~ ${fmtDate(e)}`;
}
function ddayCount(conf) {
  const start = startOfDay(conf.startDate || conf.date);
  return Math.round((start - startOfDay(simNow())) / 86400000);
}
function fmtEta(ms) {
  const min = Math.round(ms / 60000);
  if (min <= 0) return '지금';
  if (min < 60) return `${min}분 후`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분 후` : `${h}시간 후`;
}
function statusOf(item, now) {
  const t = new Date(item.time).getTime();
  const lead = (item.leadMinutes != null ? item.leadMinutes : 5) * 60000;
  if (now >= t) return { key: 'done', label: '종료' };
  if (now >= t - lead) return { key: 'soon', label: '곧 시작' };
  if (now >= t - 30 * 60000) return { key: 'upcoming', label: '예정' };
  return { key: 'scheduled', label: '예정' };
}

function openLink(url) {
  if (url && window.mascot && window.mascot.openExternal) window.mascot.openExternal(url);
}

// 디스코드 카드 (전/후 공통)
function discordCard(conf) {
  const d = conf.discord;
  if (!d || !d.url) return null;
  const card = el('button', 'link-card discord');
  card.appendChild(iconEl('discord', 'lc-icon'));
  const body = el('div', 'lc-body');
  body.appendChild(el('div', 'lc-title', 'Discord 커뮤니티'));
  if (d.note) body.appendChild(el('div', 'lc-sub', d.note));
  card.appendChild(body);
  card.appendChild(iconEl('arrow', 'lc-arrow'));
  card.addEventListener('click', () => openLink(d.url));
  return card;
}

// -------------------- 행사 전 --------------------
function renderBefore(conf) {
  subtitleEl.textContent = '행사 준비중';
  footerEl.textContent = '디스코드에서 미리 만나요 👋';

  const d = ddayCount(conf);
  const hero = el('div', 'hero');
  hero.appendChild(el('div', 'hero-label', '행사까지'));
  hero.appendChild(el('div', 'hero-dday', d <= 0 ? 'D-DAY' : `D-${d}`));
  contentEl.appendChild(hero);

  const info = el('div', 'info-list');
  const rows = [
    ['calendar', dateRange(conf)],
    ['pin', conf.venue],
    ['map', conf.address],
  ];
  for (const [icon, val] of rows) {
    if (!val) continue;
    const r = el('div', 'info-row');
    r.appendChild(iconEl(icon, 'info-icon'));
    r.appendChild(el('span', 'info-val', val));
    info.appendChild(r);
  }
  contentEl.appendChild(info);

  if (data.items && data.items.length) {
    contentEl.appendChild(
      el('div', 'session-count', `총 ${data.items.length}개 세션이 준비되고 있어요`)
    );
  }

  const dc = discordCard(conf);
  if (dc) contentEl.appendChild(dc);
}

// -------------------- 당일 --------------------
function renderDayof(conf) {
  subtitleEl.textContent = data.subtitle || '오늘의 세션';
  footerEl.textContent = '✕ 버튼이나 트레이 메뉴로 닫을 수 있어요';

  const now = simNow();
  const items = [...(data.items || [])].sort((a, b) => new Date(a.time) - new Date(b.time));

  // 다음 세션 배너
  const next = items.find((it) => new Date(it.time).getTime() > now);
  if (next) {
    const banner = el('div', 'next-banner');
    banner.appendChild(el('span', 'dot'));
    const b = el('div');
    b.appendChild(el('div', 'nb-label', '다음 세션'));
    b.appendChild(el('div', 'nb-title', next.title || '다음 세션'));
    banner.appendChild(b);
    banner.appendChild(el('span', 'nb-eta', fmtEta(new Date(next.time).getTime() - now)));
    contentEl.appendChild(banner);
  }

  const list = el('ul', 'list');
  if (!items.length) {
    list.appendChild(el('li', 'empty', '등록된 세션이 없어요.'));
  }
  for (const it of items) {
    const st = statusOf(it, now);
    const li = el('li', 'item ' + (st.key === 'soon' ? 'soon' : st.key === 'done' ? 'done' : ''));
    li.appendChild(el('div', 'time', hhmm(new Date(it.time).getTime())));
    const body = el('div', 'body');
    body.appendChild(el('div', 't-title', it.title || '세션'));
    if (it.message) body.appendChild(el('div', 't-msg', it.message));
    li.appendChild(body);
    li.appendChild(el('span', 'badge ' + st.key, st.label));
    list.appendChild(li);
  }
  contentEl.appendChild(list);
}

// -------------------- 행사 후 --------------------
function renderAfter(conf) {
  subtitleEl.textContent = '행사가 마무리됐어요';
  footerEl.textContent = '후기 한 줄이면 큰 힘이 돼요 🙏';

  const thanks = el('div', 'thanks');
  thanks.appendChild(el('div', 'thanks-emoji', '🎉'));
  thanks.appendChild(el('div', 'thanks-title', '함께해 주셔서 고마워요!'));
  thanks.appendChild(el('div', 'thanks-sub', '오늘 하루 어떠셨나요? 짧은 후기를 남겨주세요.'));
  contentEl.appendChild(thanks);

  if (conf.reviewUrl) {
    const btn = el('button', 'cta');
    btn.appendChild(iconEl('pencil', 'cta-icon'));
    btn.appendChild(document.createTextNode('후기 남기기'));
    btn.addEventListener('click', () => openLink(conf.reviewUrl));
    contentEl.appendChild(btn);
    if (conf.reviewNote) contentEl.appendChild(el('div', 'cta-note', conf.reviewNote));
  }

  const dc = discordCard(conf);
  if (dc) {
    contentEl.appendChild(el('div', 'after-more', '커뮤니티에서 계속 이야기해요'));
    contentEl.appendChild(dc);
  }
}

// -------------------- 렌더 디스패치 --------------------
function render() {
  const conf = data.conference || {};
  titleEl.textContent = data.title || conf.name || '컨퍼런스 안내';
  contentEl.innerHTML = '';
  contentEl.className = 'phase-' + (data.phase || 'dayof');

  if (data.phase === 'before') renderBefore(conf);
  else if (data.phase === 'after') renderAfter(conf);
  else renderDayof(conf);

  tickClock();
}

function tickClock() {
  const d = new Date(simNow());
  clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function refresh() {
  if (window.mascot && window.mascot.guideGetData) {
    try {
      const d = await window.mascot.guideGetData();
      if (d) {
        data = d;
        setBase(d);
      }
    } catch (_) {}
  }
  render();
}

document.getElementById('close').addEventListener('click', () => {
  if (window.mascot && window.mascot.guideClose) window.mascot.guideClose();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && window.mascot && window.mascot.guideClose) window.mascot.guideClose();
});

if (window.mascot && window.mascot.onGuideData) {
  window.mascot.onGuideData((d) => {
    if (d) {
      data = d;
      setBase(d);
    }
    render();
  });
}

refresh();
setInterval(tickClock, 1000); // 시계는 매초
setInterval(render, 15000); // 상태/카운트다운은 15초마다 갱신
