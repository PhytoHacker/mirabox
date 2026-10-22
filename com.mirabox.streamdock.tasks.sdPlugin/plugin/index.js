// Число открытых задач Google. Нажатие открывает список.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createPlugin, Actions } = require('./connection');
const { selectedCount } = require('./count');
const {
  TASKS_PAGE,
  readSettings,
  redirectUri,
  createPkce,
  authUrl,
  allowedLink,
  explainError
} = require('./auth');
const { exchangeCode, refreshAccessToken, fetchEmail, countOpenTasks } = require('./google');
const { startLoginServer } = require('./login-server');
const face = require('./face');

const plugin = createPlugin();
const keys = new Map();
const shown = new Map();
const inspectors = new Set();
const lastPress = new Map();
const animFrame = new Map();
const celebrated = new Set();
let animTimer = null;

let timer = null;
let refreshing = false;
let queued = false;
let loggingIn = false;
let loginServer = null;
let lastLogged = '';

const cache = {
  total: null,
  counts: {},
  lists: [],
  error: '',
  ready: false
};

let memory = {
  clientId: '',
  refreshToken: '',
  accessToken: '',
  expiresAt: 0,
  email: ''
};

function tokenFile() {
  const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(base, 'HotSpot', 'StreamDock', 'data', 'google-tasks.json');
}

function readTokenFile() {
  try {
    const body = JSON.parse(fs.readFileSync(tokenFile(), 'utf8'));
    if (!body || typeof body.clientId !== 'string' || typeof body.refreshToken !== 'string' || !body.refreshToken) {
      return null;
    }
    return {
      clientId: body.clientId,
      refreshToken: body.refreshToken,
      email: typeof body.email === 'string' ? body.email : ''
    };
  } catch (error) {
    return null;
  }
}

function writeTokenFile(session) {
  const file = tokenFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({
    clientId: session.clientId,
    refreshToken: session.refreshToken,
    email: session.email || ''
  }), 'utf8');
  fs.renameSync(tmp, file);
}

function clearTokenFile() {
  try {
    fs.unlinkSync(tokenFile());
  } catch (error) {
    if (error.code !== 'ENOENT') plugin.log('Не удалось забыть вход');
  }
}

function loadMemory() {
  const saved = readTokenFile();
  if (!saved) return;
  memory = {
    clientId: saved.clientId,
    refreshToken: saved.refreshToken,
    accessToken: '',
    expiresAt: 0,
    email: saved.email
  };
}

function openUrl(url) {
  const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
}

function credentials() {
  for (const settings of keys.values()) {
    if (settings.clientId && settings.clientSecret) return settings;
  }
  return null;
}

function signedIn(settings) {
  return !!(settings?.clientId && memory.clientId === settings.clientId && memory.refreshToken);
}

function viewFor(settings) {
  const active = signedIn(settings);
  const count = active ? selectedCount(cache, settings.listId) : null;
  const missing = active && cache.ready && settings.listId && count == null;
  const error = cache.error || (missing ? 'Такого списка уже нет.' : '');
  return {
    signedIn: active,
    count,
    error,
    email: active ? memory.email : '',
    lists: cache.lists,
    listId: settings.listId,
    interval: settings.interval,
    caption: listCaption(settings),
    ready: cache.ready
  };
}

function listCaption(settings) {
  if (!settings.showName) return '';
  if (!settings.listId) return 'Все';
  const list = cache.lists.find((item) => item.id === settings.listId);
  return list && list.title ? list.title : '';
}

function beginCelebration(context) {
  animFrame.set(context, 0);
  if (!animTimer) animTimer = setInterval(stepCelebration, face.FRAME_MS);
}

function stepCelebration() {
  for (const [context, frame] of [...animFrame]) {
    if (!keys.has(context)) {
      animFrame.delete(context);
      continue;
    }
    const next = frame + 1;
    if (next >= face.FRAME_COUNT) {
      animFrame.delete(context);
      celebrated.add(context);
    } else animFrame.set(context, next);
    shown.delete(context);
    paint(context);
  }
  if (animFrame.size === 0 && animTimer) {
    clearInterval(animTimer);
    animTimer = null;
  }
}

function tagged(spec, view) {
  if (view.caption) spec.caption = view.caption;
  return spec;
}

function imageSpec(context, view) {
  if (!(view.signedIn && view.count != null)) {
    animFrame.delete(context);
    if (view.signedIn && view.error) return { text: '!' };
    return { bare: true };
  }
  if (view.count !== 0) {
    animFrame.delete(context);
    celebrated.delete(context);
    return tagged({ text: String(view.count) }, view);
  }
  if (celebrated.has(context)) return tagged({ done: true }, view);
  if (!animFrame.has(context)) beginCelebration(context);
  return tagged({ burst: animFrame.get(context) }, view);
}

function paint(context) {
  const settings = keys.get(context);
  if (!settings) return;
  const spec = imageSpec(context, viewFor(settings));
  const key = JSON.stringify(spec);
  if (shown.get(context) === key) return;
  shown.set(context, key);
  plugin.setTitle(context, '');
  plugin.setImage(context, face.image(spec));
}

function publish(context) {
  const settings = keys.get(context);
  if (!settings || !inspectors.has(context)) return;
  const view = viewFor(settings);
  plugin.sendToPropertyInspector(context, {
    count: view.count,
    error: view.error,
    email: view.email,
    signedIn: view.signedIn,
    lists: view.lists,
    listId: view.listId,
    interval: view.interval,
    ready: view.ready
  });
}

function paintAll() {
  for (const context of keys.keys()) paint(context);
  for (const context of inspectors) publish(context);
}

function forgetSession() {
  memory = { clientId: '', refreshToken: '', accessToken: '', expiresAt: 0, email: '' };
  cache.total = null;
  cache.counts = {};
  cache.lists = [];
  cache.ready = false;
  cache.error = '';
  clearTokenFile();
}

async function ensureToken(settings) {
  if (!settings?.clientId || !settings.clientSecret) {
    throw Object.assign(new Error('signed-out'), { code: 'signed-out' });
  }
  if (memory.clientId !== settings.clientId) {
    throw Object.assign(new Error('signed-out'), { code: 'signed-out' });
  }
  if (memory.accessToken && memory.expiresAt > Date.now() + 60000) return memory.accessToken;
  if (!memory.refreshToken) throw Object.assign(new Error('signed-out'), { code: 'signed-out' });
  try {
    const next = await refreshAccessToken(fetch, {
      clientId: settings.clientId,
      clientSecret: settings.clientSecret,
      refreshToken: memory.refreshToken
    });
    memory.accessToken = next.accessToken;
    memory.expiresAt = next.expiresAt;
    if (next.refreshToken) memory.refreshToken = next.refreshToken;
    if (!memory.email) memory.email = await fetchEmail(fetch, memory.accessToken);
    writeTokenFile(memory);
    return memory.accessToken;
  } catch (error) {
    if (error.phase === 'refresh' && (error.status === 400 || error.status === 401)) forgetSession();
    throw error;
  }
}

async function refreshAll() {
  if (keys.size === 0) return;
  if (refreshing) {
    queued = true;
    return;
  }
  refreshing = true;
  try {
    const settings = credentials();
    if (settings && signedIn(settings)) {
      try {
        const token = await ensureToken(settings);
        const data = await countOpenTasks(fetch, token);
        cache.total = data.total;
        cache.counts = data.counts;
        cache.lists = data.lists;
        cache.ready = true;
        cache.error = '';
      } catch (error) {
        if (error.code !== 'signed-out') cache.error = explainError(error);
      }
    }
    if (cache.error && cache.error !== lastLogged) plugin.log(cache.error);
    lastLogged = cache.error;
    paintAll();
  } finally {
    refreshing = false;
    if (queued) {
      queued = false;
      refreshAll();
    }
  }
}

function arm() {
  if (timer) clearInterval(timer);
  timer = null;
  if (keys.size === 0) return;
  const seconds = Math.min(...[...keys.values()].map((settings) => settings.interval));
  timer = setInterval(refreshAll, seconds * 1000);
}

async function login(context) {
  const settings = keys.get(context);
  if (!settings?.clientId || !settings.clientSecret) {
    cache.error = 'Нужны ID и секрет клиента.';
    publish(context);
    plugin.showAlert(context);
    return;
  }
  if (loggingIn) return;
  loggingIn = true;
  cache.error = '';
  publish(context);
  try {
    const pkce = createPkce();
    loginServer = await startLoginServer(pkce.state);
    const port = loginServer.port;
    openUrl(authUrl({
      clientId: settings.clientId,
      redirectUri: redirectUri(port),
      challenge: pkce.challenge,
      state: pkce.state
    }));
    const code = await loginServer.done;
    const token = await exchangeCode(fetch, {
      code,
      clientId: settings.clientId,
      clientSecret: settings.clientSecret,
      redirectUri: redirectUri(port),
      verifier: pkce.verifier
    });
    memory = {
      clientId: settings.clientId,
      refreshToken: token.refreshToken,
      accessToken: token.accessToken,
      expiresAt: token.expiresAt,
      email: ''
    };
    if (!memory.refreshToken) {
      throw Object.assign(new Error('no-refresh'), { code: 'no-refresh', phase: 'exchange' });
    }
    memory.email = await fetchEmail(fetch, memory.accessToken);
    writeTokenFile(memory);
    plugin.showOk(context);
    await refreshAll();
  } catch (error) {
    const message = explainError(error);
    if (message) {
      cache.error = message;
      plugin.log(message);
      plugin.showAlert(context);
    }
    paintAll();
  } finally {
    loginServer = null;
    loggingIn = false;
  }
}

function logout() {
  if (loginServer) loginServer.close();
  loginServer = null;
  forgetSession();
  shown.clear();
  paintAll();
}

function press(context) {
  const now = Date.now();
  if (now - (lastPress.get(context) || 0) < 400) return;
  lastPress.set(context, now);
  openUrl(TASKS_PAGE);
}

function remember(data) {
  keys.set(data.context, readSettings(data.payload?.settings));
  shown.delete(data.context);
}

loadMemory();

plugin.count = new Actions({
  willAppear(data) {
    remember(data);
    paint(data.context);
    arm();
    refreshAll();
  },
  willDisappear({ context }) {
    keys.delete(context);
    shown.delete(context);
    inspectors.delete(context);
    animFrame.delete(context);
    celebrated.delete(context);
    if (animFrame.size === 0 && animTimer) {
      clearInterval(animTimer);
      animTimer = null;
    }
    arm();
  },
  didReceiveSettings(data) {
    remember(data);
    paint(data.context);
    arm();
    publish(data.context);
    refreshAll();
  },
  propertyInspectorDidAppear({ context }) {
    inspectors.add(context);
    publish(context);
    refreshAll();
  },
  propertyInspectorDidDisappear({ context }) {
    inspectors.delete(context);
  },
  sendToPlugin({ context, payload }) {
    const command = payload?.command;
    if (command === 'login') login(context);
    else if (command === 'logout') logout();
    else if (command === 'refresh') refreshAll();
    else if (command === 'open') {
      const url = allowedLink(payload.link);
      if (url) openUrl(url);
    }
  },
  keyDown({ context }) {
    press(context);
  },
  dialDown({ context }) {
    press(context);
  },
  touchTap({ context }) {
    press(context);
  }
});

process.on('uncaughtException', (error) => {
  console.error('[tasks]', error);
});
process.on('unhandledRejection', (error) => {
  console.error('[tasks]', error);
});
