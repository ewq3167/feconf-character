'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mascot', {
  // 메인 → 렌더러 이벤트 구독
  onState: (cb) => ipcRenderer.on('mascot:state', (_e, d) => cb(d)),
  onNotify: (cb) => ipcRenderer.on('mascot:notify', (_e, d) => cb(d)),
  onDnd: (cb) => ipcRenderer.on('mascot:dnd', (_e, d) => cb(d)),
  onBubbleStyle: (cb) => ipcRenderer.on('mascot:bubble', (_e, d) => cb(d)),
  onFont: (cb) => ipcRenderer.on('mascot:font', (_e, d) => cb(d)),
  // 개발용 — /debug/dday 로 클릭 팝업(D-day)을 더블클릭 없이 띄운다
  onDday: (cb) => ipcRenderer.on('mascot:dday', (_e, d) => cb(d)),

  // 렌더러 → 메인
  getConfig: () => ipcRenderer.invoke('mascot:getConfig'),
  getAnims: () => ipcRenderer.invoke('mascot:getAnims'),
  drag: (dx, dy) => ipcRenderer.send('mascot:drag', { dx, dy }),
  setIgnoreMouse: (ignore) => ipcRenderer.send('mascot:setIgnoreMouse', ignore),
  click: () => ipcRenderer.send('mascot:click'),
  rightClick: () => ipcRenderer.send('mascot:rightclick'),

  // 안내 패널
  guideGetData: () => ipcRenderer.invoke('guide:getData'),
  guideClose: () => ipcRenderer.send('guide:close'),
  onGuideData: (cb) => ipcRenderer.on('guide:data', (_e, d) => cb(d)),
  openExternal: (url) => ipcRenderer.send('open:external', url),
});

// 개발자 미리보기 패널용
contextBridge.exposeInMainWorld('dev', {
  getInit: () => ipcRenderer.invoke('dev:getInit'),
  apply: (opts) => ipcRenderer.invoke('dev:apply', opts),
  setState: (state, ttl) => ipcRenderer.send('dev:state', { state, ttl }),
  setBubble: (style) => ipcRenderer.send('dev:bubble', { style }),
  setFont: (font) => ipcRenderer.send('dev:font', { font }),
  hide: () => ipcRenderer.send('dev:hide'),
});
