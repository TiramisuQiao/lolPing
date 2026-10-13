#!/usr/bin/env node
// Run the installed app independently of a terminal, and recover abnormal exits.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

if (process.platform !== 'darwin') throw new Error('This command requires macOS.');
const action = process.argv[2] ?? 'enable';
if (!['enable', 'disable', 'status'].includes(action) || process.argv.length > 3) {
  throw new Error('Usage: node tools/mac/background.mjs [enable|disable|status]');
}
const label = 'com.tiramisuqiao.lolping.background';
const domain = `gui/${process.getuid()}`;
const service = `${domain}/${label}`;
const app = join(homedir(), 'Applications/lolPing.app');
const executable = join(app, 'Contents/MacOS/lolPing');
const agents = join(homedir(), 'Library/LaunchAgents');
const plist = join(agents, `${label}.plist`);
const logs = join(homedir(), 'Library/Logs/lolPing');
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });
const loaded = () => spawnSync('/bin/launchctl', ['print', service], { stdio: 'ignore' }).status === 0;

if (action === 'status') {
  if (!loaded()) {
    console.log('Background service is not loaded.');
    process.exitCode = 1;
  } else run('/bin/launchctl', ['print', service]);
} else if (action === 'disable') {
  if (loaded()) run('/bin/launchctl', ['bootout', service]);
  if (existsSync(plist)) unlinkSync(plist);
  console.log('Background service removed. You can still open lolPing from Applications.');
} else {
  if (!existsSync(executable)) throw new Error('Install lolPing first: npm run install:mac');
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
  if (loaded()) {
    // Enabling an existing service must not interrupt the running app.
    run('/bin/launchctl', ['kickstart', service]);
    console.log('Background service is already enabled.');
    process.exit(0);
  }
  // Stop a manually launched copy, so the single-instance lock belongs to the supervised process.
  const isRunning = () => execFileSync('/bin/ps', ['-axo', 'comm='], { encoding: 'utf8' })
    .split('\n').some((line) => line.trim() === executable);
  if (isRunning()) {
    // argv avoids interpreting an application path as AppleScript source.
    run('/usr/bin/osascript', ['-e', 'on run argv\n tell application (item 1 of argv) to quit\nend run', app]);
  }
  // Electron flushes settings and stops the input helper asynchronously after the Quit event.
  for (let attempt = 0; attempt < 100 && isRunning(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (isRunning()) throw new Error('lolPing is still quitting. Try again once it has closed.');
  mkdirSync(agents, { recursive: true });
  mkdirSync(logs, { recursive: true });
  const xml = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>${xml(executable)}</string></array>
  <key>LimitLoadToSessionType</key><string>Aqua</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>15</integer>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardOutPath</key><string>${xml(join(logs, 'background.log'))}</string>
  <key>StandardErrorPath</key><string>${xml(join(logs, 'background-error.log'))}</string>
</dict></plist>
`, { mode: 0o644 });
  run('/usr/bin/plutil', ['-lint', plist]);
  run('/bin/launchctl', ['bootstrap', domain, plist]);
  console.log('Background service enabled: starts at login and restarts after abnormal exits.');
  console.log('Choosing Quit from the menu bar stops lolPing normally.');
  console.log(`Logs: ${logs}`);
}
