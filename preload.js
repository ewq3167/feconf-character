'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mascot', {
  // 메인 → 렌더러 이벤트 구독
  onState: (cb) => ipcRenderer.on('mascot:state', (_e, d) => cb(d)),
  onNotify: (cb) => ipcRenderer.on('mascot:notify', (_e, d) => cb(d)),
  onDnd: (cb) => ipcRenderer.on('mascot:dnd', (_e, d) => cb(d)),

  // 렌더러 → 메인
  getConfig: () => ipcRenderer.invoke('mascot:getConfig'),
  drag: (dx, dy) => ipcRenderer.send('mascot:drag', { dx, dy }),
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
  hide: () => ipcRenderer.send('dev:hide'),
});
