const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  DEFAULT_ROOT,
  DEFAULT_STRATEGY,
  STOP_PARTS,
  readSettings,
  strategyIndex,
  listStrategies,
  isRunning,
  startScript,
  stopCommand,
  stopScript,
  encodePowerShell,
  elevationArguments
} = require('./toggle');

const MENU = [
  'general.bat',
  'general (SIMPLE FAKE).bat',
  'general (SIMPLE FAKE ALT2).bat',
  'general (FAKE TLS AUTO).bat',
  'general (SIMPLE FAKE ALT).bat',
  'general (FAKE TLS AUTO ALT3).bat',
  'general (FAKE TLS AUTO ALT2).bat',
  'general (FAKE TLS AUTO ALT).bat',
  'general (ALT9).bat',
  'general (ALT8).bat',
  'general (ALT7).bat',
  'general (ALT6).bat',
  'general (ALT5).bat',
  'general (ALT4).bat',
  'general (ALT3).bat',
  'general (ALT2).bat',
  'general (ALT12).bat',
  'general (ALT11).bat',
  'general (ALT).bat',
  'general (ALT10).bat',
  'service.bat'
];

test('пустые настройки получают путь и конфиг по умолчанию', () => {
  assert.deepEqual(readSettings(undefined), {
    root: DEFAULT_ROOT,
    strategy: DEFAULT_STRATEGY
  });
  assert.deepEqual(readSettings({ root: '  ', strategy: '' }), {
    root: DEFAULT_ROOT,
    strategy: DEFAULT_STRATEGY
  });
});

test('свои путь и конфиг обрезаются по краям', () => {
  assert.deepEqual(readSettings({ root: ' D:\\zapr ', strategy: ' general.bat ' }), {
    root: 'D:\\zapr',
    strategy: 'general.bat'
  });
});

test('ALT11 остаётся 11-м пунктом меню, service.bat в список не входит', () => {
  assert.equal(strategyIndex(MENU, 'general (ALT11).bat'), 11);
  assert.equal(strategyIndex(MENU, 'service.bat'), null);
  assert.equal(strategyIndex(MENU, 'нет такого.bat'), null);
});

test('папка отдаёт имена файлов', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zapret-'));
  fs.writeFileSync(path.join(dir, 'general (ALT11).bat'), '');
  fs.writeFileSync(path.join(dir, 'service.bat'), '');
  fs.mkdirSync(path.join(dir, 'bin'));
  assert.deepEqual(listStrategies(dir).sort(), ['general (ALT11).bat', 'service.bat']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('в установленной папке ALT11 тоже 11-й', () => {
  if (!fs.existsSync(DEFAULT_ROOT)) return;
  assert.equal(strategyIndex(listStrategies(DEFAULT_ROOT), DEFAULT_STRATEGY), 11);
});

test('служба RUNNING или процесс winws означают включено', () => {
  const running = `
        STATE              : 4  RUNNING
                                (STOPPABLE, NOT_PAUSABLE, ACCEPTS_SHUTDOWN)
`;
  const stopped = '        STATE              : 1  STOPPED';
  const processLine = 'winws.exe                     5460 Services                   0      1 340 K';
  const absent = 'INFO: No tasks are running which match the specified criteria.';
  assert.equal(isRunning({ serviceOutput: running, tasklistOutput: absent }), true);
  assert.equal(isRunning({ serviceOutput: stopped, tasklistOutput: processLine }), true);
  assert.equal(isRunning({ serviceOutput: stopped, tasklistOutput: absent }), false);
  assert.equal(isRunning({ serviceOutput: '', tasklistOutput: '' }), false);
});

test('выгрузка повторяет Remove Services и не останавливается на ошибке', () => {
  assert.equal(stopCommand(), STOP_PARTS.join(' & '));
  assert.equal(stopCommand().includes('&&'), false);
  assert.match(stopScript(), /taskkill \/F \/IM winws\.exe/);
  assert.match(stopScript(), /WinDivert14/);
  assert.match(stopScript(), /WaitForExit\(60000\)/);
});

test('скрипт включения запускает bat со скобками в имени', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zapret-bat-'));
  const out = path.join(dir, 'out.txt');
  fs.writeFileSync(
    path.join(dir, 'general (ALT11).bat'),
    `@echo off\r\necho OK> "${out}"\r\n`
  );
  execFileSync(
    'powershell.exe',
    ['-NoProfile', '-EncodedCommand', encodePowerShell(startScript(dir, 'general (ALT11).bat'))],
    { encoding: 'buffer' }
  );
  assert.match(fs.readFileSync(out, 'utf8'), /OK/);
  fs.rmSync(dir, { recursive: true, force: true });
});

function assertPowerShell(script) {
  const command = [
    '$raw = [Console]::In.ReadToEnd()',
    '$errors = $null',
    '[void][System.Management.Automation.Language.Parser]::ParseInput($raw, [ref]$null, [ref]$errors)',
    'if ($errors -and $errors.Count) { exit 1 }',
    'exit 0'
  ].join('; ');
  execFileSync('powershell.exe', ['-NoProfile', '-Command', command], { input: script });
}

test('скрипты включения, выгрузки и повышения прав разбираются', () => {
  assertPowerShell(startScript('C:\\Users\\User\\Desktop\\zapr', 'general (ALT11).bat'));
  assertPowerShell(stopScript());
  assertPowerShell(elevationArguments('Write-Output ok').at(-1));
});

test('команда повышения прав содержит тот же скрипт', () => {
  const script = stopScript();
  const args = elevationArguments(script);
  const command = args[args.length - 1];
  const encoded = command.match(/-EncodedCommand','([^']+)'/)[1];
  let text = Buffer.from(encoded, 'base64').toString('utf16le');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  assert.equal(text, script);
  assert.equal(args[0], '-NoProfile');
});
