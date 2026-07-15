'use strict';

// 달팽이 클릭 시 뜨는 스타버스트 팝업 — D-day + 디스코드 바로가기
// 시간/행사정보는 main 의 guideData()(conference.startDate, discord, now)를 재사용

const ddayEl = document.getElementById('dday');
const btn = document.getElementById('discord-btn');

let data = { conference: {}, now: Date.now() };

function startOfDay(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function ddayText(conf, now) {
  const s = conf.startDate || conf.date;
  if (!s) return 'D-–';
  const diff = Math.round((startOfDay(new Date(s).getTime()) - startOfDay(now)) / 86400000);
  if (diff > 0) return 'D-' + diff;
  if (diff === 0) return 'D-DAY';
  return '종료';
}

function render() {
  const conf = data.conference || {};
  ddayEl.textContent = ddayText(conf, data.now || Date.now());

  const url = conf.discord && conf.discord.url;
  if (url) {
    btn.classList.remove('hidden');
    btn.onclick = (e) => {
      e.stopPropagation(); // 배경 클릭(닫기)과 분리
      if (window.mascot && window.mascot.openExternal) window.mascot.openExternal(url);
    };
  } else {
    btn.classList.add('hidden');
  }
}

async function refresh() {
  if (window.mascot && window.mascot.guideGetData) {
    try {
      const d = await window.mascot.guideGetData();
      if (d) data = d;
    } catch (_) {}
  }
  render();
}

if (window.mascot && window.mascot.onGuideData) {
  window.mascot.onGuideData((d) => {
    if (d) data = d;
    render();
  });
}

// 닫기: Esc, 또는 버튼 밖 배경 클릭
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && window.mascot && window.mascot.guideClose) window.mascot.guideClose();
});
document.addEventListener('click', (e) => {
  if (!btn.contains(e.target) && window.mascot && window.mascot.guideClose) {
    window.mascot.guideClose();
  }
});

refresh();
setInterval(refresh, 60000); // D-day 갱신
