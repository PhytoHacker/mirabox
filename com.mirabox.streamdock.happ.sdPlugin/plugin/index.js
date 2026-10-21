const path = require('path');
const { spawn } = require('child_process');
const { createPlugin, Actions } = require('./connection');
const { COMMANDS } = require('./commands');
const { appearance, readConnected, readToggleSettings } = require('./status');
const { createTintCache } = require('./tint');

const tintCaption = createTintCache(path.join(__dirname, '..', 'static', 'toggle-on.png'));
const tintPlain = createTintCache(path.join(__dirname, '..', 'static', 'toggle-plain.png'));

const plugin = createPlugin();
const lastPress = new Map();
const shown = new Map();
const visible = new Set();
const options = new Map();
const linked = new Map();
let timer = null;
let reading = false;
let queued = false;

function launch(url) {
  const child = spawn('cmd.exe', ['/d', '/c', 'start', '', url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
}

function press(context, url, confirm) {
  const now = Date.now();
  if (now - (lastPress.get(context) || 0) < 400) return;
  lastPress.set(context, now);
  try {
    launch(url);
    if (confirm) plugin.showOk(context);
  } catch (error) {
    plugin.log(error.message || String(error));
    plugin.showAlert(context);
  }
}

function remember(data) {
  options.set(data.context, readToggleSettings(data.payload?.settings));
  shown.delete(data.context);
}

function paint(context, connected) {
  linked.set(context, connected);
  const view = appearance(connected, options.get(context));
  const key = `${view.state}|${view.title}|${view.color}|${view.plain ? 'plain' : 'caption'}`;
  if (shown.get(context) === key) return;
  shown.set(context, key);
  plugin.setState(context, view.state);
  plugin.setImage(context, (view.plain ? tintPlain : tintCaption)(view.color));
  plugin.setTitle(context, view.title);
  plugin.log(connected ? 'Happ включён' : 'Happ выключен');
}

async function refresh() {
  if (visible.size === 0) return;
  if (reading) {
    queued = true;
    return;
  }
  reading = true;
  try {
    const connected = await readConnected();
    for (const context of visible) paint(context, connected);
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
  options.delete(context);
  linked.delete(context);
  if (visible.size === 0 && timer) {
    clearInterval(timer);
    timer = null;
  }
}

function pressToggle(context) {
  press(context, COMMANDS.toggle, false);
  shown.delete(context);
  setTimeout(refresh, 400);
  setTimeout(refresh, 1200);
  setTimeout(refresh, 2500);
  setTimeout(refresh, 4000);
}

for (const [name, url] of Object.entries(COMMANDS)) {
  if (name === 'toggle') continue;
  const run = ({ context }) => press(context, url, true);
  plugin[name] = new Actions({
    keyDown: run,
    dialDown: run,
    touchTap: run
  });
}

plugin.toggle = new Actions({
  willAppear(data) {
    remember(data);
    watch(data.context);
  },
  didReceiveSettings(data) {
    remember(data);
    if (visible.has(data.context) && linked.has(data.context)) paint(data.context, linked.get(data.context));
  },
  willDisappear({ context }) {
    unwatch(context);
  },
  keyDown({ context }) {
    pressToggle(context);
  },
  dialDown({ context }) {
    pressToggle(context);
  },
  touchTap({ context }) {
    pressToggle(context);
  }
});

process.on('uncaughtException', (error) => {
  console.error('[happ]', error);
});
process.on('unhandledRejection', (error) => {
  console.error('[happ]', error);
});
