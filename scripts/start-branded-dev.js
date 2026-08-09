#!/usr/bin/env node
'use strict';

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP_NAME = 'FEConf Mascot';
const BUNDLE_ID = 'org.feconf.mascot';
const HELPER_BUNDLE_ID = `${BUNDLE_ID}.helper`;
const OUT_DIR = path.join(ROOT, 'out');
const BRANDED_APP = path.join(OUT_DIR, `${APP_NAME}.app`);
const ICON_SRC = path.join(ROOT, 'assets', 'icon.icns');
const PORT = process.env.MASCOT_PORT || 7842;

function runQuiet(command, args) {
  return spawnSync(command, args, { stdio: 'ignore' });
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} 실패`);
  }
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

function patchHelperPlists(contentsDir) {
  const frameworksDir = path.join(contentsDir, 'Frameworks');
  for (const helper of [
    'Electron Helper.app',
    'Electron Helper (GPU).app',
    'Electron Helper (Plugin).app',
    'Electron Helper (Renderer).app',
  ]) {
    const plistPath = path.join(frameworksDir, helper, 'Contents', 'Info.plist');
    if (fs.existsSync(plistPath)) {
      patchPlist(plistPath, 'CFBundleIdentifier', HELPER_BUNDLE_ID);
    }
  }
}

function ensureBrandedApp() {
  if (process.platform !== 'darwin') return null;
  if (!fs.existsSync(ICON_SRC)) {
    throw new Error(`앱 아이콘을 찾을 수 없습니다: ${ICON_SRC}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(BRANDED_APP)) {
    run('/usr/bin/ditto', ['--rsrc', '--extattr', sourceElectronApp(), BRANDED_APP]);
  }

  const contentsDir = path.join(BRANDED_APP, 'Contents');
  const resourcesDir = path.join(contentsDir, 'Resources');
  const plistPath = path.join(contentsDir, 'Info.plist');

  fs.copyFileSync(ICON_SRC, path.join(resourcesDir, 'feconf.icns'));

  patchPlist(plistPath, 'CFBundleDisplayName', APP_NAME);
  patchPlist(plistPath, 'CFBundleName', APP_NAME);
  patchPlist(plistPath, 'CFBundleIconFile', 'feconf.icns');
  patchPlist(plistPath, 'CFBundleIdentifier', BUNDLE_ID);
  patchHelperPlists(contentsDir);

  runQuiet('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', BRANDED_APP]);
  runQuiet('/usr/bin/touch', [BRANDED_APP]);
  runQuiet(
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
    ['-f', BRANDED_APP]
  );

  return BRANDED_APP;
}

const brandedApp = ensureBrandedApp();

if (brandedApp) {
  const health = spawnSync('curl', ['-fsS', `http://127.0.0.1:${PORT}/health`], {
    stdio: 'ignore',
  });
  if (health.status === 0) {
    console.log(`${APP_NAME} is already running on port ${PORT}.`);
    process.exit(0);
  }

  run('/usr/bin/open', ['-n', brandedApp, '--args', ROOT, ...process.argv.slice(2)]);
  console.log(`${APP_NAME} launched.`);
  process.exit(0);
}

const child = spawn(require('electron'), [ROOT, ...process.argv.slice(2)], {
  cwd: ROOT,
  env: { ...process.env, ELECTRON_DEV_BRANDED: '1' },
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
