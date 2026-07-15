'use strict';

// ===========================================================================
// 마스코트 전송 클라이언트 — 빌드/테스트 도구에서 상태를 보내는 공용 헬퍼
//   const m = require('./mascot-client');
//   m.building('vite')  → 달팽이 집중(빌드 중)
//   m.success('빌드 완료', '1.8s')  → 달팽이 기뻐함
//   m.fail('빌드 실패', 'TS error 3개')  → 달팽이 놀람(흔들림)
// 앱이 꺼져 있어도 조용히 무시(개발 흐름을 절대 막지 않음).
// ===========================================================================

const http = require('http');

const HOST = process.env.MASCOT_HOST || '127.0.0.1';
const PORT = Number(process.env.MASCOT_PORT) || 7842;
const TOKEN = process.env.MASCOT_TOKEN || '';
// MASCOT_DISABLE=1 이면 전송을 완전히 끔
const DISABLED = process.env.MASCOT_DISABLE === '1';

function post(pathName, payload) {
  return new Promise((resolve) => {
    if (DISABLED) return resolve(false);
    const body = JSON.stringify(payload || {});
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path: pathName,
        method: 'POST',
        timeout: 800,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(TOKEN ? { 'x-token': TOKEN } : {}),
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve(true));
      }
    );
    // 앱이 안 떠 있으면 조용히 넘어감
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.write(body);
    req.end();
  });
}

// 지속 "집중" 상태로 전환 (ttl 없음 → baseState = working)
function state(name) {
  return post('/state', { state: name });
}
// 말풍선이 레벨별 아이콘(💬/✅/⚠️/🚨)을 자동으로 붙이므로 title 엔 이모지 생략
function building(label) {
  return post('/notify', {
    title: '빌드 드갑니다',
    message: label ? `${label} 컴파일 중…` : '컴파일 중…',
    level: 'info',
  }).then(() => state('working'));
}
function success(title, message) {
  // 지속 working 해제 → idle 로 되돌린 뒤 축하
  return state('idle').then(() =>
    post('/notify', { title: title || '빌드 완료', message: message || '', level: 'success' })
  );
}
function warn(title, message) {
  return state('idle').then(() =>
    post('/notify', { title: title || '경고', message: message || '', level: 'warn' })
  );
}
function fail(title, message) {
  return state('idle').then(() =>
    post('/notify', { title: title || '빌드 실패', message: message || '', level: 'urgent' })
  );
}
function ready(title, message) {
  return post('/notify', { title: title || 'dev 서버 준비 완료', message: message || '', level: 'success' });
}

module.exports = { post, state, building, success, warn, fail, ready };
