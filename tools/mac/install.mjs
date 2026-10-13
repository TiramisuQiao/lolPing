#!/usr/bin/env node
// Install the locally built bundle without sudo; preserve any previous install.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('The macOS build currently requires an Apple Silicon Mac and arm64 Node.js.');
}
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--no-open')) throw new Error('Usage: node tools/mac/install.mjs [--no-open]');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = join(root, 'release/mac-arm64/lolPing.app');
const applications = join(homedir(), 'Applications');
const target = join(applications, 'lolPing.app');
const executable = '/Contents/MacOS/lolPing';
if (!existsSync(source)) throw new Error('Build the app first: npm run dist:mac');
const processes = execFileSync('/bin/ps', ['-axo', 'comm='], { encoding: 'utf8' });
if (processes.split('\n').some((line) => line.trim().endsWith(`/lolPing.app${executable}`))) {
  throw new Error('Quit lolPing from its menu bar icon before installing.');
}
const verify = (bundle) => {
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], { stdio: 'inherit' });
  execFileSync('/usr/bin/lipo', ['-verify_arch', 'arm64', bundle + executable], { stdio: 'inherit' });
  execFileSync('/usr/bin/lipo', ['-verify_arch', 'arm64', join(bundle, 'Contents/Resources/hook-helper')], { stdio: 'inherit' });
};
verify(source);
mkdirSync(applications, { recursive: true });
const staging = mkdtempSync(join(applications, '.lolPing-install-'));
let backup;
try {
  const staged = join(staging, 'lolPing.app');
  execFileSync('/usr/bin/ditto', [source, staged], { stdio: 'inherit' });
  verify(staged);
  if (existsSync(target)) {
    backup = `${target}.backup-${Date.now()}`;
    renameSync(target, backup);
  }
  try {
    renameSync(staged, target);
  } catch (error) {
    if (backup) renameSync(backup, target);
    throw error;
  }
} finally {
  rmSync(staging, { recursive: true, force: true });
}
console.log(`Installed: ${target}`);
if (backup) console.log(`Previous app preserved: ${backup}`);
console.log('Allow lolPing in System Settings → Privacy & Security → Accessibility, then hold Option and drag.');
if (!args.includes('--no-open')) {
  const service = `gui/${process.getuid()}/com.tiramisuqiao.lolping.background`;
  if (spawnSync('/bin/launchctl', ['print', service], { stdio: 'ignore' }).status === 0) {
    execFileSync('/bin/launchctl', ['kickstart', service], { stdio: 'inherit' });
  } else {
    execFileSync('/usr/bin/open', [target], { stdio: 'inherit' });
  }
}
