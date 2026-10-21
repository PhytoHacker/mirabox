const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { buildAlarmWav } = require('./wav');

const wavPath = path.join(__dirname, 'alarm.wav');
const procs = new Map();

function ensureWav() {
  if (!fs.existsSync(wavPath)) fs.writeFileSync(wavPath, buildAlarmWav());
  return wavPath;
}

function start(context, onError) {
  if (process.platform !== 'win32') return;
  if (procs.has(context)) return;
  let file;
  try {
    file = ensureWav();
  } catch (error) {
    onError?.(error);
    return;
  }
  const safe = file.replace(/'/g, "''");
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `$player = New-Object System.Media.SoundPlayer '${safe}'`,
    'while ($true) { $player.PlaySync(); Start-Sleep -Milliseconds 350 }'
  ].join('; ');
  const proc = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-STA', '-WindowStyle', 'Hidden', '-Command', command],
    { windowsHide: true, stdio: 'ignore' }
  );
  procs.set(context, proc);
  proc.on('error', (error) => {
    if (procs.get(context) === proc) procs.delete(context);
    onError?.(error);
  });
  proc.on('exit', () => {
    if (procs.get(context) === proc) procs.delete(context);
  });
}

function stop(context) {
  const proc = procs.get(context);
  if (!proc) return;
  procs.delete(context);
  try {
    proc.kill();
  } catch (_) {}
}

function stopAll() {
  for (const context of [...procs.keys()]) stop(context);
}

module.exports = { start, stop, stopAll, ensureWav };
