// Яркость экрана.
// Только крутилка. Поворот меняет яркость, нажатие переключает экран и в конце включает все сразу.

const { createPlugin, Actions } = require('./connection');
const { createDdc } = require('./ddc');
const { faceImage } = require('./face');
const {
  ALL_MONITORS,
  applyTicks,
  averageBrightness,
  chooseMonitor,
  nextMonitorId,
  normalizeStep
} = require('./level');

const ddc = createDdc();
const sessions = new Map();
const lastImage = new Map();
const desired = new Map();
const switchedAt = new Map();
let pumping = false;

const plugin = createPlugin({
  onClose() {
    ddc.close();
  }
});

function render(context) {
  const session = sessions.get(context);
  if (!session) return;
  const image = faceImage(session);
  if (lastImage.get(context) === image) return;
  lastImage.set(context, image);
  plugin.setTitle(context, '');
  plugin.setImage(context, image);
}

function publish(context) {
  const session = sessions.get(context);
  if (!session) return;
  plugin.sendToPropertyInspector(context, {
    monitors: (session.monitors || []).map((monitor) => ({
      id: monitor.id,
      name: monitor.name,
      primary: !!monitor.primary,
      hdr: !!monitor.hdr
    })),
    monitorId: session.monitorId,
    step: session.step,
    brightness: session.brightness
  });
}

function remember(id, value, context) {
  desired.set(id, { value, context });
  pump();
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (desired.size) {
      const [id, job] = desired.entries().next().value;
      desired.delete(id);
      try {
        const actual = await ddc.set(id, job.value);
        if (desired.has(id)) continue;
        for (const [context, session] of sessions) {
          const monitor = (session.monitors || []).find((item) => item.id === id);
          if (monitor) monitor.brightness = actual;
          if (session.monitorId === id) session.brightness = actual;
          else if (session.monitorId === ALL_MONITORS && monitor) session.brightness = averageBrightness(session.monitors);
          else continue;
          session.status = 'ready';
          render(context);
          publish(context);
        }
      } catch (error) {
        plugin.log(`Яркость: ${error.message || error}`);
        plugin.showAlert(job.context);
        if (!desired.has(id)) refresh(job.context);
      }
    }
  } finally {
    pumping = false;
    if (desired.size) pump();
  }
}

async function refresh(context) {
  const session = sessions.get(context);
  if (!session) return;
  session.token = (session.token || 0) + 1;
  const token = session.token;
  let monitors = [];
  try {
    monitors = await ddc.list();
  } catch (error) {
    if (!sessions.get(context) || session.token !== token) return;
    plugin.log(`Яркость: ${error.message || error}`);
    session.status = 'error';
    session.brightness = null;
    render(context);
    publish(context);
    return;
  }
  if (!sessions.get(context) || session.token !== token) return;
  session.monitors = monitors.map((monitor) => {
    if (!desired.has(monitor.id)) return monitor;
    const kept = (session.monitors || []).find((item) => item.id === monitor.id);
    return kept ? { ...monitor, brightness: kept.brightness } : monitor;
  });
  if (session.monitorId === ALL_MONITORS) {
    if (!session.monitors.length) {
      session.status = 'missing';
      session.brightness = null;
      session.name = '';
    } else {
      session.name = 'ВСЕ';
      session.min = 0;
      session.max = 100;
      session.status = 'ready';
      if (!session.monitors.some((monitor) => desired.has(monitor.id))) {
        session.brightness = averageBrightness(session.monitors);
      }
    }
    render(context);
    publish(context);
    return;
  }
  const chosen = chooseMonitor(session.monitors, session.monitorId);
  if (!chosen) {
    session.status = 'missing';
    session.brightness = null;
    session.name = '';
    render(context);
    publish(context);
    return;
  }
  if (chosen.id !== session.monitorId) {
    session.monitorId = chosen.id;
    plugin.setSettings(context, { monitorId: chosen.id, step: session.step });
  }
  session.name = chosen.name;
  session.min = chosen.min;
  session.max = chosen.max;
  session.status = 'ready';
  if (!desired.has(chosen.id)) session.brightness = chosen.brightness;
  render(context);
  publish(context);
}

function change(context, ticks) {
  const session = sessions.get(context);
  if (!session || session.status !== 'ready' || session.brightness == null) {
    plugin.showAlert(context);
    return;
  }
  if (session.monitorId === ALL_MONITORS) {
    let moved = false;
    for (const monitor of session.monitors || []) {
      const next = applyTicks(monitor.brightness, ticks, session.step, monitor.min, monitor.max);
      if (next == null || next === monitor.brightness) continue;
      monitor.brightness = next;
      remember(monitor.id, next, context);
      moved = true;
    }
    if (!moved) return;
    session.brightness = averageBrightness(session.monitors);
    render(context);
    return;
  }
  const next = applyTicks(session.brightness, ticks, session.step, session.min, session.max);
  if (next == null || next === session.brightness) return;
  const monitor = (session.monitors || []).find((item) => item.id === session.monitorId);
  if (monitor) monitor.brightness = next;
  session.brightness = next;
  render(context);
  remember(session.monitorId, next, context);
}

function showCurrent(session) {
  if (session.monitorId === ALL_MONITORS) {
    session.name = 'ВСЕ';
    session.min = 0;
    session.max = 100;
    session.brightness = averageBrightness(session.monitors);
    session.status = session.monitors.length ? 'ready' : 'missing';
    return;
  }
  const chosen = (session.monitors || []).find((monitor) => monitor.id === session.monitorId);
  if (!chosen) return;
  session.name = chosen.name;
  session.min = chosen.min;
  session.max = chosen.max;
  session.brightness = chosen.brightness;
  session.status = 'ready';
}

function cycle(context) {
  const now = Date.now();
  if (now - (switchedAt.get(context) || 0) < 200) return;
  const session = sessions.get(context);
  if (!session?.monitors?.length) {
    plugin.showAlert(context);
    return;
  }
  switchedAt.set(context, now);
  session.monitorId = nextMonitorId(session.monitors, session.monitorId);
  showCurrent(session);
  render(context);
  publish(context);
  plugin.setSettings(context, { monitorId: session.monitorId, step: session.step });
}

plugin.monitor = new Actions({
  default: {
    monitorId: '',
    step: 5
  },
  _willAppear(data) {
    const settings = data.payload?.settings || {};
    sessions.set(data.context, {
      monitorId: typeof settings.monitorId === 'string' ? settings.monitorId : '',
      step: normalizeStep(settings.step),
      brightness: null,
      min: 0,
      max: 100,
      name: '',
      status: 'loading',
      monitors: [],
      token: 0
    });
    lastImage.delete(data.context);
    render(data.context);
    refresh(data.context);
  },
  _willDisappear(data) {
    sessions.delete(data.context);
    lastImage.delete(data.context);
    switchedAt.delete(data.context);
  },
  _didReceiveSettings(data) {
    const session = sessions.get(data.context);
    if (!session) return;
    const incoming = data.payload?.settings || {};
    const monitorId = typeof incoming.monitorId === 'string' ? incoming.monitorId : session.monitorId;
    const step = normalizeStep(incoming.step ?? session.step);
    const monitorChanged = monitorId !== session.monitorId;
    session.step = step;
    session.monitorId = monitorId;
    if (monitorChanged) refresh(data.context);
  },
  dialRotate({ context, payload }) {
    change(context, Number(payload?.ticks) || 0);
  },
  dialDown({ context }) {
    cycle(context);
  },
  sendToPlugin({ context, payload }) {
    if (payload?.command !== 'monitors') return;
    refresh(context);
  },
  propertyInspectorDidAppear({ context }) {
    refresh(context);
  }
});

process.on('uncaughtException', (error) => {
  console.error('[brightness]', error);
});
process.on('unhandledRejection', (error) => {
  console.error('[brightness]', error);
});
