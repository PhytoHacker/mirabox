const { execFile, spawn } = require('child_process');
const { createPlugin, Actions } = require('./connection');
const {
  DEFAULT_ROOT,
  DEFAULT_STRATEGY,
  readSettings,
  listStrategies,
  isRunning,
  startScript,
  stopScript,
  elevationArguments
} = require('./toggle');

const PRESS_GAP = 400;
const visible = new Set();
const shown = new Map();
const lastPress = new Map();
let timer = null;
let reading = false;
let queued = false;
let busy = false;

const plugin = createPlugin({
  onClose() {
    if (timer) clearInterval(timer);
  }
});

function exec(file, args) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      resolve(`${stdout || ''}${stderr || ''}`);
    });
  });
}

async function queryRunning() {
  const [serviceOutput, tasklistOutput] = await Promise.all([
    exec('sc.exe', ['query', 'zapret']),
    exec('tasklist.exe', ['/FI', 'IMAGENAME eq winws.exe', '/NH'])
  ]);
  return isRunning({ serviceOutput, tasklistOutput });
}

function paint(context, running) {
  const state = running ? 1 : 0;
  const title = running ? 'ВКЛ' : 'ВЫКЛ';
  const key = `${state}|${title}`;
  if (shown.get(context) === key) return;
  shown.set(context, key);
  plugin.setState(context, state);
  plugin.setTitle(context, title);
  plugin.log(running ? 'Zapret включён' : 'Zapret выключен');
}

async function refresh() {
  if (visible.size === 0) return;
  if (reading) {
    queued = true;
    return;
  }
  reading = true;
  try {
    const running = await queryRunning();
    for (const context of visible) {
      paint(context, running);
      plugin.sendToPropertyInspector(context, { running });
    }
  } catch (error) {
    plugin.log(error.message || String(error));
  } finally {
    reading = false;
    if (queued) {
      queued = false;
      refresh();
    }
  }
}

function watch(context) {
  visible.add(context);
  refresh();
  if (!timer) timer = setInterval(refresh, 1000);
}

function unwatch(context) {
  visible.delete(context);
  shown.delete(context);
  lastPress.delete(context);
  if (visible.size === 0 && timer) {
    clearInterval(timer);
    timer = null;
  }
}

function scheduleRefresh() {
  for (const delay of [400, 1200, 2500, 4000]) setTimeout(refresh, delay);
}

function runElevated(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', elevationArguments(script), { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error((stderr || '').trim() || `Не удалось выполнить команду (${code})`));
    });
  });
}

async function pressToggle(context) {
  const now = Date.now();
  if (now - (lastPress.get(context) || 0) < PRESS_GAP) return;
  if (busy) return;
  lastPress.set(context, now);
  busy = true;
  const settings = readSettings(plugin.toggle.data[context]);
  try {
    const running = await queryRunning();
    if (running) {
      await runElevated(stopScript());
    } else {
      let names;
      try {
        names = listStrategies(settings.root);
      } catch (error) {
        throw new Error('Папка zapret не найдена');
      }
      if (!names.includes(settings.strategy)) throw new Error(`Нет конфига ${settings.strategy}`);
      await runElevated(startScript(settings.root, settings.strategy));
    }
    const after = await queryRunning();
    for (const item of visible) shown.delete(item);
    for (const item of visible) paint(item, after);
    if (after === running) {
      plugin.showAlert(context);
      plugin.log(running ? 'Zapret не выключился' : 'Zapret не включился');
    }
  } catch (error) {
    plugin.log(error.message || String(error));
    plugin.showAlert(context);
  } finally {
    busy = false;
    scheduleRefresh();
  }
}

plugin.toggle = new Actions({
  default: {
    root: DEFAULT_ROOT,
    strategy: DEFAULT_STRATEGY
  },
  _willAppear(data) {
    watch(data.context);
  },
  _willDisappear(data) {
    unwatch(data.context);
  },
  _didReceiveSettings() {},
  // keyDown, dialDown и touchTap приходят на одно нажатие.
  keyDown({ context }) {
    pressToggle(context);
  },
  dialDown({ context }) {
    pressToggle(context);
  },
  touchTap({ context }) {
    pressToggle(context);
  },
  dialRotate() {},
  sendToPlugin() {
    refresh();
  },
  propertyInspectorDidAppear() {
    refresh();
  }
});

process.on('uncaughtException', (error) => {
  console.error('[zapret]', error);
});
process.on('unhandledRejection', (error) => {
  console.error('[zapret]', error);
});
