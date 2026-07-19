#!/usr/bin/env node
'use strict';

// ===========================================================================
// mascot-watch — 아무 명령이나 감싸서 결과를 달팽이에게 알려주는 래퍼
//
//   npx mascot-watch npm run build
//   npx mascot-watch -- vitest run
//   npx mascot-watch --label "타입체크" tsc --noEmit
//
// 시작 → 달팽이 집중(빌드 중) · 성공(exit 0) → 기뻐함 · 실패 → 놀람(흔들림)
// 명령의 stdout/stderr 는 그대로 통과시키고, 종료 코드도 그대로 전달해요.
// 프레임워크에 무관하게 build·test·lint·tsc 무엇이든 감쌀 수 있어요.
// ===========================================================================

const { spawn } = require('child_process');
const m = require('./mascot-client');

const argv = process.argv.slice(2);

// --label "이름" 옵션 파싱, `--` 구분자 지원
let label = null;
const cmd = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if ((a === '--label' || a === '-l') && cmd.length === 0) {
    label = argv[++i];
  } else if (a === '--' && cmd.length === 0) {
    // 이후는 전부 실행할 명령
    cmd.push(...argv.slice(i + 1));
    break;
  } else {
    cmd.push(a);
  }
}

if (cmd.length === 0) {
  console.error('사용법: mascot-watch [--label 이름] <명령> [인자...]');
  console.error('예:    mascot-watch npm run build');
  process.exit(2);
}

const name = label || cmd.join(' ');
const startedAt = Date.now();

function secs() {
  return `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
}

// 시작 알림 → 집중 상태
m.building(name);

const child = spawn(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' });

child.on('error', (err) => {
  m.fail('실행 Fail...', `${cmd[0]}: ${err.message}`);
  console.error(`[mascot-watch] 실행 실패: ${err.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  const dur = secs();
  if (code === 0) {
    m.success('⭐️ 야호~성공~🎵⭐️', `${name} · ${dur}`);
  } else {
    m.fail('작업 Fail...', `${name} · 종료코드 ${code != null ? code : signal} · ${dur}`);
  }
  // 전송이 나갈 짧은 여유 후 원래 종료 코드로 종료
  setTimeout(() => process.exit(code == null ? 1 : code), 120);
});

// Ctrl+C 등은 자식에게 전달
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => child.kill(sig));
});
