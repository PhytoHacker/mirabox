const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { buildBellWav } = require('./wav');

const bellPath = path.join(__dirname, 'sounds', 'bell.wav');
const procs = new Map();
const PREVIEW = '__preview';

const playerScript = [
  "$ErrorActionPreference = 'Stop'",
  "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; using System.Text; public static class Winmm { [DllImport(\"winmm.dll\", CharSet=CharSet.Auto)] public static extern int mciSendString(string command, StringBuilder buffer, int bufferSize, IntPtr hwndCallback); }'",
  "$path = $env:TIMER_SOUND",
  "$type = $env:TIMER_TYPE",
  "$loop = $env:TIMER_LOOP -eq '1'",
  "[void][Winmm]::mciSendString('close timerbell', $null, 0, [IntPtr]::Zero)",
  "$open = if ($type) { 'open \"' + $path + '\" type ' + $type + ' alias timerbell' } else { 'open \"' + $path + '\" alias timerbell' }",
  "$code = [Winmm]::mciSendString($open, $null, 0, [IntPtr]::Zero)",
  "if ($code -ne 0) { throw \"mci open $code\" }",
  "do {",
  "  $play = [Winmm]::mciSendString('play timerbell wait', $null, 0, [IntPtr]::Zero)",
  "  if ($play -ne 0) { throw \"mci play $play\" }",
  "  if ($loop) {",
  "    [void][Winmm]::mciSendString('seek timerbell to start', $null, 0, [IntPtr]::Zero)",
  "    Start-Sleep -Milliseconds 350",
  "  }",
  "} while ($loop)"
].join('\n');

function ensureBell() {
  if (!fs.existsSync(bellPath)) {
    fs.mkdirSync(path.dirname(bellPath), { recursive: true });
    fs.writeFileSync(bellPath, buildBellWav());
  }
  return bellPath;
}

function resolveFile(soundFile) {
  if (typeof soundFile === 'string' && soundFile && fs.existsSync(soundFile)) return soundFile;
  return ensureBell();
}

function mciType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.wav') return 'waveaudio';
  if (ext === '.mp3') return 'mpegvideo';
  return '';
}

function spawnPlayer(context, file, loop, onError) {
  stop(context);
  const proc = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-STA', '-WindowStyle', 'Hidden', '-Command', playerScript],
    {
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        TIMER_SOUND: file,
        TIMER_TYPE: mciType(file),
        TIMER_LOOP: loop ? '1' : '0'
      }
    }
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

function start(context, soundFile, onError) {
  if (process.platform !== 'win32') return;
  let file;
  try {
    file = resolveFile(soundFile);
  } catch (error) {
    onError?.(error);
    return;
  }
  spawnPlayer(context, file, true, onError);
}

function playOnce(soundFile, onError) {
  if (process.platform !== 'win32') return;
  let file;
  try {
    file = resolveFile(soundFile);
  } catch (error) {
    onError?.(error);
    return;
  }
  spawnPlayer(PREVIEW, file, false, onError);
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
  stop(PREVIEW);
  for (const context of [...procs.keys()]) stop(context);
}

module.exports = { start, playOnce, stop, stopAll, ensureBell, resolveFile };
