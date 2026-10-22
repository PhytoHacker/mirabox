const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = 'C:\\Users\\User\\Desktop\\zapr';
const DEFAULT_STRATEGY = 'general (ALT11).bat';

const STOP_PARTS = [
  'net stop zapret',
  'sc delete zapret',
  'taskkill /F /IM winws.exe',
  'net stop WinDivert',
  'sc delete WinDivert',
  'net stop WinDivert14',
  'sc delete WinDivert14'
];

function readSettings(raw) {
  return {
    root: String(raw?.root ?? '').trim() || DEFAULT_ROOT,
    strategy: String(raw?.strategy ?? '').trim() || DEFAULT_STRATEGY
  };
}

function sortKey(name) {
  return name.replace(/\d+/g, (digits) => digits.padStart(8, '0'));
}

function menuNames(names) {
  return names
    .filter((name) => {
      const lower = name.toLowerCase();
      return lower.endsWith('.bat') && !lower.startsWith('service');
    })
    .sort((a, b) => {
      const left = sortKey(a);
      const right = sortKey(b);
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    });
}

function strategyIndex(names, strategy) {
  const index = menuNames(names).indexOf(strategy);
  return index < 0 ? null : index + 1;
}

function listStrategies(root) {
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

function serviceRunning(output) {
  const match = String(output || '').match(/STATE\s*:\s*\d+\s+([A-Z_]+)/i);
  return match?.[1]?.toUpperCase() === 'RUNNING';
}

function processRunning(output) {
  return /^\s*winws\.exe\b/im.test(String(output || ''));
}

function isRunning({ serviceOutput, tasklistOutput }) {
  return serviceRunning(serviceOutput) || processRunning(tasklistOutput);
}

function psLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

// Меню service.bat в скрытом окне не дочитывает ответы и висит на pause.
// Тот же конфиг запускает сам bat: он поднимает winws.exe и сразу заканчивается.
function startScript(root, strategy) {
  const bat = path.win32.join(root, strategy);
  return [
    `$bat = ${psLiteral(bat)}`,
    'if (-not (Test-Path -LiteralPath $bat)) { exit 2 }',
    "$dir = Join-Path $env:TEMP ('zapret-run-' + [guid]::NewGuid().ToString('n'))",
    'New-Item -ItemType Directory -Path $dir | Out-Null',
    "$launcher = Join-Path $dir 'run.bat'",
    '$text = "@echo off`r`ncall `"$bat`"`r`n"',
    '[System.IO.File]::WriteAllText($launcher, $text)',
    "$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d','/c', $launcher) -WindowStyle Hidden -PassThru",
    '$ok = $proc.WaitForExit(30000)',
    'Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue',
    'if (-not $ok) {',
    '  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue',
    '  exit 3',
    '}',
    'exit 0'
  ].join('\n');
}

// Как пункт Remove Services: вместе с winws выгружается драйвер WinDivert.
function stopCommand() {
  return STOP_PARTS.join(' & ');
}

function stopScript() {
  return [
    `$command = ${psLiteral(stopCommand())}`,
    "$arg = '/d /c \"' + $command + '\"'",
    "$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList $arg -WindowStyle Hidden -PassThru",
    '$ok = $proc.WaitForExit(60000)',
    'if (-not $ok) {',
    '  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue',
    '  exit 3',
    '}',
    'exit 0'
  ].join('\n');
}

function encodePowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function elevationArguments(script) {
  const encoded = encodePowerShell(script);
  const command = [
    "$proc = Start-Process -FilePath powershell.exe -Verb RunAs -WindowStyle Hidden -PassThru -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand','" +
      encoded +
      "')",
    'if (-not $proc) { exit 1 }',
    'if (-not $proc.WaitForExit(90000)) {',
    '  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue',
    '  exit 3',
    '}',
    'if ($null -eq $proc.ExitCode) { exit 1 }',
    'exit $proc.ExitCode'
  ].join('; ');
  return ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command];
}

module.exports = {
  DEFAULT_ROOT,
  DEFAULT_STRATEGY,
  STOP_PARTS,
  readSettings,
  menuNames,
  strategyIndex,
  listStrategies,
  serviceRunning,
  processRunning,
  isRunning,
  startScript,
  stopCommand,
  stopScript,
  encodePowerShell,
  elevationArguments
};
