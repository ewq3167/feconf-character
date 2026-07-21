'use strict';

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  screen,
  globalShortcut,
  nativeImage,
  Notification,
  shell,
} = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ---------------------------------------------------------------------------
// 설정 (config.json 으로 덮어쓸 수 있음)
// ---------------------------------------------------------------------------
const DEFAULT_CONFIG = {
  port: 7842,          // 웹훅 HTTP 서버 포트
  token: '',           // 설정 시 웹훅 요청에 x-token 헤더 필요 (빈 값이면 인증 없음)
  width: 315, // 달팽이 좌하단 + 말풍선/D-day 팝업 우상단 구성
  height: 260,
  margin: 24,          // 화면 모서리로부터 여백
  corner: 'bottom-right', // bottom-right | bottom-left | top-right | top-left
  idleSleepMs: 90000,  // 이 시간 동안 이벤트 없으면 잠자기
  guideTitle: '컨퍼런스 안내',
  guideSubtitle: '오늘의 세션',
  guideWidth: 320,
  guideHeight: 500, // before/after 화면이 스크롤 없이 들어가는 높이
};

function loadConfig() {
  const cfgPath = path.join(__dirname, 'config.json');
  let cfg = { ...DEFAULT_CONFIG };
  try {
    if (fs.existsSync(cfgPath)) {
      Object.assign(cfg, JSON.parse(fs.readFileSync(cfgPath, 'utf8')));
    }
  } catch (e) {
    console.error('[config] 읽기 실패, 기본값 사용:', e.message);
  }
  return cfg;
}

const CONFIG = loadConfig();

let win = null;
let guideWin = null;
let tray = null;
let server = null;
let dnd = false;           // Do Not Disturb
let sleepTimer = null;
let overridePhase = null;  // 개발용 phase 강제 (before|dayof|after|null)
let mockNow = null;        // 개발용 모의 시각(ms), null = 실시간
let devWin = null;
const scheduledTimers = [];

// 코딩 중 걷기(반대 모서리로 이동) 상태
let mover = null;
let walkTarget = null;      // { x, y } 목표 위치
let walkGoal = null;        // 'away'(반대 모서리) | 'home'(제자리)
let lastDir = -1;           // 바라보는 방향(-1 왼쪽, +1 오른쪽)
let workingUntil = 0;       // 이 시각까지 코딩중으로 간주
let returnTimer = null;
const WALK_SPEED = 4;       // 틱당 이동 px
const WALK_TICK = 33;       // ~30fps

// ---------------------------------------------------------------------------
// 창 위치 계산
// ---------------------------------------------------------------------------
function cornerPosition() {
  const display = screen.getPrimaryDisplay();
  const wa = display.workArea; // 메뉴바/독 제외 영역
  const { width: w, height: h, margin, corner } = CONFIG;
  let x = wa.x + wa.width - w - margin;
  let y = wa.y + wa.height - h - margin;
  if (corner.includes('left')) x = wa.x + margin;
  if (corner.includes('top')) y = wa.y + margin;
  return { x: Math.round(x), y: Math.round(y) };
}

function createWindow() {
  const { x, y } = cornerPosition();
  win = new BrowserWindow({
    width: CONFIG.width,
    height: CONFIG.height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 기본은 클릭 통과 — 렌더러가 캐릭터/말풍선 위에 커서가 올라오면 해제한다.
  // forward: true 로 mousemove 는 계속 렌더러에 전달되어 hover 감지가 가능.
  win.setIgnoreMouseEvents(true, { forward: true });

  win.on('closed', () => {
    win = null;
  });
}

// ---------------------------------------------------------------------------
// 안내 패널 창
// ---------------------------------------------------------------------------
function createGuideWindow() {
  guideWin = new BrowserWindow({
    width: CONFIG.guideWidth,
    height: CONFIG.guideHeight,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  guideWin.setAlwaysOnTop(true, 'screen-saver');
  guideWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  guideWin.loadFile(path.join(__dirname, 'renderer', 'guide.html'));

  // 닫기 대신 숨김 (앱은 계속 상주)
  guideWin.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      guideWin.hide();
    }
  });
}

function positionGuide() {
  if (!win || !guideWin) return;
  const [mx, my] = win.getPosition();
  const wa = screen.getPrimaryDisplay().workArea;
  const gw = CONFIG.guideWidth;
  const gh = CONFIG.guideHeight;
  const gap = 8;

  // 기본: 마스코트 왼쪽에 배치, 하단 정렬
  let gx = mx - gw + 20; // 살짝 겹치게
  let gy = my + CONFIG.height - gh;

  // 왼쪽 공간 부족하면 오른쪽에
  if (gx < wa.x + 4) gx = mx + CONFIG.width - 20;
  // 화면 경계 클램프
  gx = Math.max(wa.x + 4, Math.min(gx, wa.x + wa.width - gw - 4));
  gy = Math.max(wa.y + 4, Math.min(gy, wa.y + wa.height - gh - 4));

  guideWin.setPosition(Math.round(gx), Math.round(gy));
}

function loadConference() {
  const p = path.join(__dirname, 'conference.json');
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error('[conference] 읽기 실패:', e.message);
  }
  return {};
}

// 자정 기준 날짜 비교로 phase 결정
function startOfDay(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function effNow() {
  return mockNow != null ? mockNow : Date.now();
}
function conferencePhase(conf) {
  if (overridePhase) return overridePhase;
  const start = startOfDay(conf.startDate || conf.date);
  const end = startOfDay(conf.endDate || conf.startDate || conf.date);
  const today = startOfDay(new Date(effNow()));
  if (isNaN(start)) return 'dayof';
  if (today < start) return 'before';
  if (today > end) return 'after';
  return 'dayof';
}

function guideData() {
  const conf = loadConference();
  return {
    items: loadSchedule(),
    conference: conf,
    phase: conferencePhase(conf),
    title: CONFIG.guideTitle || conf.name || '컨퍼런스 안내',
    subtitle: CONFIG.guideSubtitle,
    now: effNow(),
  };
}

function pushGuideData() {
  if (!guideWin || guideWin.isDestroyed()) return;
  const send = () => guideWin.webContents.send('guide:data', guideData());
  if (guideWin.webContents.isLoading()) {
    guideWin.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

function toggleGuide() {
  if (!guideWin) createGuideWindow();
  if (guideWin.isVisible()) {
    guideWin.hide();
  } else {
    positionGuide();
    pushGuideData();
    guideWin.showInactive(); // 포커스 뺏지 않고 표시
  }
}

function showGuide() {
  if (!guideWin) createGuideWindow();
  positionGuide();
  pushGuideData();
  if (!guideWin.isVisible()) guideWin.showInactive();
}

// ---------------------------------------------------------------------------
// 개발자 미리보기 창 (phase/시간 스크럽)
// ---------------------------------------------------------------------------
function createDevWindow() {
  devWin = new BrowserWindow({
    width: 340,
    height: 800,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  devWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  devWin.loadFile(path.join(__dirname, 'renderer', 'dev.html'));
  devWin.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      devWin.hide();
      // 창을 닫으면 실시간으로 복귀
      overridePhase = null;
      mockNow = null;
      pushGuideData();
    }
  });
}

function toggleDev() {
  if (!devWin) createDevWindow();
  if (devWin.isVisible()) {
    devWin.hide();
    overridePhase = null;
    mockNow = null;
    pushGuideData();
  } else {
    const wa = screen.getPrimaryDisplay().workArea;
    devWin.setPosition(wa.x + 40, wa.y + 60);
    devWin.show(); // 입력 위해 포커스 허용
    showGuide();
  }
}

// ---------------------------------------------------------------------------
// 마스코트로 이벤트 전송
// ---------------------------------------------------------------------------
function sendToMascot(channel, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

function scheduleSleep() {
  if (sleepTimer) clearTimeout(sleepTimer);
  sleepTimer = setTimeout(() => {
    sendToMascot('mascot:state', { state: 'sleeping' });
  }, CONFIG.idleSleepMs);
}

// ---------------------------------------------------------------------------
// 코딩 중 걷기 — 반대 모서리로 이동, 멈추면 제자리 복귀
// ---------------------------------------------------------------------------
function cornerXY(corner) {
  const wa = screen.getPrimaryDisplay().workArea;
  const { width: w, height: h, margin: m } = CONFIG;
  const x = corner.includes('left') ? wa.x + m : wa.x + wa.width - w - m;
  const y = corner.includes('top') ? wa.y + m : wa.y + wa.height - h - m;
  return { x: Math.round(x), y: Math.round(y) };
}
function oppositeCorner(corner) {
  const lr = corner.includes('left') ? 'right' : 'left';
  const tb = corner.includes('top') ? 'bottom' : 'top';
  return `${tb}-${lr}`;
}

function startMover() {
  if (!mover) mover = setInterval(stepWalk, WALK_TICK);
}
function stopMover() {
  if (mover) {
    clearInterval(mover);
    mover = null;
  }
}
function stepWalk() {
  if (!win || win.isDestroyed() || !walkTarget) {
    stopMover();
    return;
  }
  const [x, y] = win.getPosition();
  const dx = walkTarget.x - x;
  const dy = walkTarget.y - y;
  const dist = Math.hypot(dx, dy);
  if (dist <= WALK_SPEED) {
    win.setPosition(walkTarget.x, walkTarget.y);
    stopMover();
    onArrive();
    return;
  }
  win.setPosition(
    Math.round(x + (dx / dist) * WALK_SPEED),
    Math.round(y + (dy / dist) * WALK_SPEED)
  );
  const dir = dx < 0 ? -1 : 1;
  if (dir !== lastDir) {
    lastDir = dir;
    sendToMascot('mascot:state', { state: 'walking', dir });
  }
  if (guideWin && guideWin.isVisible()) positionGuide(); // 안내 패널 따라오기
}
function onArrive() {
  walkTarget = null;
  if (walkGoal === 'home') {
    walkGoal = null;
    sendToMascot('mascot:state', { state: 'idle' });
    scheduleSleep();
  } else {
    // 반대 모서리 도착 → 그 자리에서 집중
    sendToMascot('mascot:state', { state: 'working' });
  }
}
function startCodingWalk(data = {}) {
  const linger = data.lingerMs || data.ttl || 6000;
  workingUntil = Date.now() + linger;
  if (walkGoal !== 'away') {
    walkGoal = 'away';
    walkTarget = cornerXY(oppositeCorner(CONFIG.corner));
    sendToMascot('mascot:state', { state: 'walking', dir: lastDir });
    startMover();
  }
  if (returnTimer) clearTimeout(returnTimer);
  returnTimer = setTimeout(() => {
    if (Date.now() >= workingUntil) returnHome();
  }, linger + 60);
}
function returnHome() {
  walkGoal = 'home';
  walkTarget = cornerXY(CONFIG.corner);
  sendToMascot('mascot:state', { state: 'walking', dir: lastDir });
  startMover();
}

// 외부에서 들어온 활동/알림을 처리하는 공통 함수
function handleEvent(kind, data = {}) {
  scheduleSleep();
  if (kind === 'notify') {
    sendToMascot('mascot:notify', {
      title: data.title || '알림',
      message: data.message || '',
      level: data.level || 'info', // info | success | warn | urgent
    });
    if (!dnd) {
      try {
        if (Notification.isSupported()) {
          new Notification({
            title: data.title || '알림',
            body: data.message || '',
            silent: false,
          }).show();
        }
      } catch (_) {}
    }
  } else if (kind === 'activity') {
    // 타이핑/코딩 등 사용자 활동 → 반대 모서리로 걸어감 (멈추면 복귀)
    startCodingWalk(data);
  } else if (kind === 'state') {
    sendToMascot('mascot:state', { state: data.state, ttl: data.ttl });
  }
}

// ---------------------------------------------------------------------------
// HTTP 웹훅 서버
// ---------------------------------------------------------------------------
function startServer() {
  server = http.createServer((req, res) => {
    // CORS (로컬 웹훅/브라우저에서 편하게 호출)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, `http://localhost:${CONFIG.port}`);

    if (req.method === 'GET' && url.pathname === '/debug/capture') {
      // 개발용: 창 내용을 PNG로 캡처 (?win=guide 로 안내 패널)
      const which = url.searchParams.get('win');
      const doCapture = (target) => {
        if (target && !target.isDestroyed()) {
          target.webContents.capturePage().then((img) => {
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(img.toPNG());
          });
        } else {
          res.writeHead(503);
          res.end();
        }
      };
      if (which === 'guide') {
        overridePhase = url.searchParams.get('phase') || null; // 개발용 phase 강제
        const mk = url.searchParams.get('mock');
        mockNow = mk ? (/^\d+$/.test(mk) ? Number(mk) : new Date(mk).getTime()) : null;
        if (!guideWin) createGuideWindow();
        positionGuide();
        pushGuideData();
        guideWin.showInactive();
        setTimeout(() => {
          doCapture(guideWin);
          overridePhase = null; // 실제 클릭 시엔 날짜 기반 phase로 복귀
          mockNow = null;
        }, 550);
      } else if (which === 'dev') {
        if (!devWin) createDevWindow();
        const wa = screen.getPrimaryDisplay().workArea;
        devWin.setPosition(wa.x + 40, wa.y + 60);
        devWin.showInactive();
        setTimeout(() => doCapture(devWin), 750);
      } else {
        doCapture(win);
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/debug/pos') {
      const pos = win && !win.isDestroyed() ? win.getPosition() : null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ pos, walkGoal, walkTarget }));
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, dnd, version: app.getVersion() }));
    }

    // 토큰 인증 (설정된 경우)
    if (CONFIG.token) {
      const tok = req.headers['x-token'] || url.searchParams.get('token');
      if (tok !== CONFIG.token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
      }
    }

    if (req.method !== 'POST') {
      res.writeHead(404);
      return res.end();
    }

    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 1e6) req.destroy(); // 1MB 초과 차단
    });
    req.on('end', () => {
      let data = {};
      try {
        data = body ? JSON.parse(body) : {};
      } catch (_) {
        // form/query 로도 받아줌
        for (const [k, v] of url.searchParams) data[k] = v;
      }

      if (url.pathname === '/notify') {
        if (dnd) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: true, suppressed: 'dnd' }));
        }
        handleEvent('notify', data);
      } else if (url.pathname === '/activity') {
        handleEvent('activity', data);
      } else if (url.pathname === '/state') {
        handleEvent('state', data);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'unknown endpoint' }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  server.on('error', (e) => {
    console.error('[server] 오류:', e.message);
  });
  server.listen(CONFIG.port, '127.0.0.1', () => {
    console.log(`[server] http://127.0.0.1:${CONFIG.port} 대기중`);
  });
}

// ---------------------------------------------------------------------------
// 컨퍼런스 세션 스케줄
// ---------------------------------------------------------------------------
function loadSchedule() {
  const p = path.join(__dirname, 'schedule.json');
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error('[schedule] 읽기 실패:', e.message);
  }
  return [];
}

function armSchedule() {
  scheduledTimers.forEach((t) => clearTimeout(t));
  scheduledTimers.length = 0;

  const items = loadSchedule();
  const now = Date.now();
  for (const it of items) {
    const t = new Date(it.time).getTime();
    if (isNaN(t)) continue;
    // 세션 시작 leadMinutes(기본 5분) 전에 알림
    const lead = (it.leadMinutes != null ? it.leadMinutes : 5) * 60000;
    const fireAt = t - lead;
    const delay = fireAt - now;
    if (delay <= 0) continue; // 이미 지난 건 무시
    const timer = setTimeout(() => {
      handleEvent('notify', {
        title: it.title || '세션 안내',
        message: it.message || `곧 시작합니다: ${it.title || ''}`,
        level: it.level || 'info',
      });
    }, delay);
    scheduledTimers.push(timer);
  }
  console.log(`[schedule] 예약된 알림 ${scheduledTimers.length}개`);
}

// ---------------------------------------------------------------------------
// 트레이
// ---------------------------------------------------------------------------
function trayIcon() {
  // 16x16 간단한 고양이 실루엣 (base64 PNG). 없으면 빈 이미지로도 동작.
  const img = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAcElEQVR4nGNgGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKBgFo2AUjIJRMAoAyQwF8fSAqSMAAAAASUVORK5CYII='
  );
  return img;
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: '👋 인사시키기', click: () => handleEvent('state', { state: 'greet' }) },
    { label: '📋 안내 패널 열기/닫기', click: () => toggleGuide() },
    {
      label: '🔔 테스트 알림',
      click: () =>
        handleEvent('notify', {
          title: '테스트 알림',
          message: '마스코트가 잘 반응하는지 확인!',
          level: 'success',
        }),
    },
    { type: 'separator' },
    {
      label: dnd ? '🔕 방해 금지: 켜짐' : '🔔 방해 금지: 꺼짐',
      click: () => {
        dnd = !dnd;
        sendToMascot('mascot:dnd', { dnd });
        rebuildTray();
      },
    },
    { label: '📍 위치 재정렬', click: () => { if (win) { const { x, y } = cornerPosition(); win.setPosition(x, y); } } },
    { label: '🗓 스케줄 다시 로드', click: () => armSchedule() },
    { label: '🛠 개발자 미리보기 (phase/시간)', click: () => toggleDev() },
    { type: 'separator' },
    { label: `🌐 웹훅: http://127.0.0.1:${CONFIG.port}`, enabled: false },
    { label: '종료', click: () => app.quit() },
  ]);
}

function rebuildTray() {
  if (tray) tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('컨퍼런스 마스코트');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => handleEvent('state', { state: 'greet' }));
}

// ---------------------------------------------------------------------------
// IPC (렌더러 → 메인)
// ---------------------------------------------------------------------------
ipcMain.handle('mascot:getConfig', () => ({ dnd, port: CONFIG.port }));
// 캐릭터 애니메이션 (charactor/*.json — 마름모 아트보드 포맷)
ipcMain.handle('mascot:getAnims', () => {
  const dir = path.join(__dirname, 'charactor');
  const out = {};
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        out[path.basename(f, '.json').normalize('NFC')] = JSON.parse(
          fs.readFileSync(path.join(dir, f), 'utf8')
        );
      } catch (e) {
        console.error('[anims] 파싱 실패:', f, e.message);
      }
    }
  } catch (e) {
    console.error('[anims] 읽기 실패:', e.message);
  }
  return out;
});
ipcMain.on('mascot:setIgnoreMouse', (_e, ignore) => {
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(!!ignore, { forward: true });
  }
});
ipcMain.on('mascot:drag', (_e, { dx, dy }) => {
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(x + Math.round(dx), y + Math.round(dy));
});
ipcMain.on('mascot:click', () => {
  // 인사 + D-day 팝업은 렌더러가 창 안 오버레이로 처리 (안내 패널은 트레이에서)
  scheduleSleep();
});
ipcMain.on('mascot:rightclick', () => {
  toggleDev();
});

ipcMain.handle('guide:getData', () => guideData());
ipcMain.on('guide:close', () => {
  if (guideWin && guideWin.isVisible()) guideWin.hide();
});
ipcMain.on('open:external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
});

// 개발자 미리보기
ipcMain.handle('dev:getInit', () => ({
  conference: loadConference(),
  items: loadSchedule(),
}));
ipcMain.handle('dev:apply', (_e, opts = {}) => {
  overridePhase = opts.phase || null;
  mockNow = opts.mockNow != null ? opts.mockNow : null;
  showGuide();
  return { now: effNow(), phase: conferencePhase(loadConference()) };
});
// 달팽이 상태/감정 전환 (dev 패널)
ipcMain.on('dev:state', (_e, opts = {}) => {
  handleEvent('state', { state: opts.state, ttl: opts.ttl });
});
// 말풍선 스타일 전환 (dev 패널)
ipcMain.on('dev:bubble', (_e, opts = {}) => {
  sendToMascot('mascot:bubble', { style: opts.style });
});
// 말풍선 폰트 전환 (dev 패널)
ipcMain.on('dev:font', (_e, opts = {}) => {
  sendToMascot('mascot:font', { font: opts.font });
});
ipcMain.on('dev:hide', () => {
  if (devWin && devWin.isVisible()) devWin.hide();
  overridePhase = null;
  mockNow = null;
  pushGuideData();
});

// ---------------------------------------------------------------------------
// 앱 라이프사이클
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide(); // 독 아이콘 숨김
  createWindow();
  createTray();
  startServer();
  armSchedule();
  scheduleSleep();

  // 전역 단축키
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (!win) return;
    if (win.isVisible()) win.hide();
    else win.show();
  });
  globalShortcut.register('CommandOrControl+Shift+H', () =>
    handleEvent('state', { state: 'greet' })
  );

  // 첫 인사
  setTimeout(() => handleEvent('state', { state: 'greet' }), 800);
});

app.on('window-all-closed', () => {
  // 트레이 상주 앱 — 창 닫혀도 종료하지 않음
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopMover();
  if (returnTimer) clearTimeout(returnTimer);
  if (server) server.close();
});
