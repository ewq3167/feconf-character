#!/usr/bin/env node
'use strict';

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP_NAME = 'FEConf Mascot';
const BUNDLE_ID = 'org.feconf.mascot.dev';
const ICON_SRC = path.join(ROOT, 'assets', 'icon.icns');

function runQuiet(command, args) {
  return spawnSync(command, args, { stdio: 'ignore' });
}

function patchPlist(plistPath, key, value) {
  const result = runQuiet('/usr/bin/plutil', ['-replace', key, '-string', value, plistPath]);
  if (result.status !== 0) {
    throw new Error(`Info.plist 업데이트 실패: ${key}`);
  }
}

function sourceElectronApp() {
  const electronExecutable = require('electron');
  return path.resolve(path.dirname(electronExecutable), '..', '..');
}

function ensureBrandedElectron() {
  const electronExecutable = require('electron');
  if (process.platform !== 'darwin') return require('electron');
  if (!fs.existsSync(ICON_SRC)) {
    throw new Error(`앱 아이콘을 찾을 수 없습니다: ${ICON_SRC}`);
  }

  const electronApp = sourceElectronApp();
  const contentsDir = path.join(electronApp, 'Contents');
  const resourcesDir = path.join(contentsDir, 'Resources');
  const plistPath = path.join(contentsDir, 'Info.plist');
  const stockIconPath = path.join(resourcesDir, 'electron.icns');
  const stockIconBackupPath = path.join(resourcesDir, 'electron.icns.original');
  const plistBackupPath = path.join(contentsDir, 'Info.plist.original');

  if (!fs.existsSync(stockIconBackupPath) && fs.existsSync(stockIconPath)) {
    fs.copyFileSync(stockIconPath, stockIconBackupPath);
  }
  if (!fs.existsSync(plistBackupPath) && fs.existsSync(plistPath)) {
    fs.copyFileSync(plistPath, plistBackupPath);
  }

  fs.copyFileSync(ICON_SRC, stockIconPath);
  fs.copyFileSync(ICON_SRC, path.join(resourcesDir, 'feconf.icns'));

  patchPlist(plistPath, 'CFBundleDisplayName', APP_NAME);
  patchPlist(plistPath, 'CFBundleName', APP_NAME);
  patchPlist(plistPath, 'CFBundleIconFile', 'feconf.icns');
  patchPlist(plistPath, 'CFBundleIdentifier', BUNDLE_ID);

  runQuiet('/usr/bin/touch', [electronApp]);
  runQuiet(
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
    ['-f', electronApp]
  );

  return electronExecutable;
}

const electronExecutable = ensureBrandedElectron();
const child = spawn(electronExecutable, [ROOT, ...process.argv.slice(2)], {
  cwd: ROOT,
  env: {
    ...process.env,
    ELECTRON_DEV_BRANDED: '1',
  },
  stdio: 'inherit',
});

function forward(signal) {
  if (!child.killed) child.kill(signal);
}

process.on('SIGINT', () => forward('SIGINT'));
process.on('SIGTERM', () => forward('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
