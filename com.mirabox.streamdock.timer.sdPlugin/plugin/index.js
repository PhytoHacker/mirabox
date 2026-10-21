// Таймер крутилки N4 Pro.
// Щелчок крутилки — старт и пауза, три быстрых щелчка — сброс, поворот — время.

const { createPlugin, Actions } = require('./connection');
const alarm = require('./alarm');
const { createGesture } = require('./gesture');
const { faceImage } = require('./ring');
const {
  STATUS,
  formatTitle,
  ringPercent,
  faceStyle,
  normalizeSettings,
  normalizeStep,
  restoreSession,
  toSettings,
  reduce
} = require('./logic');

const sessions = new Map();
const lastTitle = new Map();
const lastRing = new Map();
const persistSoon = new Map();
const watched = new Set();
let pulse = null;

const plugin = createPlugin({
  onClose() {
    alarm.stopAll();
  }
});

function render(context) {
  const session = sessions.get(context);
  if (!session) return;
  const blinkOn = Math.floor(Date.now() / 500) % 2 === 0;
  const title = formatTitle(session, true);
  const [time, label] = title.split('\n');
  const percent = ringPercent(session);
  const style = faceStyle(session);
  const ringKey = [
    time,
    style.showStatus ? label : '',
    session.status,
    session.status === STATUS.ALARM && !blinkOn ? '0' : '1',
    Math.round(percent * 100),
    style.theme,
    style.running,
    style.digits,
    style.background,
    style.showStatus ? '1' : '0'
  ].join('|');
  if (lastTitle.get(context) !== '') {
    lastTitle.set(context, '');
    plugin.setTitle(context, '');
  }
  if (lastRing.get(context) !== ringKey) {
    lastRing.set(context, ringKey);
    plugin.setImage(context, faceImage({
      percent,
      time,
      label,
      status: session.status,
      blinkOn,
      style
    }));
  }
}

function persist(context) {
  const session = sessions.get(context);
  if (!session) return;
  clearTimeout(persistSoon.get(context));
  plugin.setSettings(context, toSettings(session));
}

function playAlarm(context) {
  const session = sessions.get(context);
  if (!session?.soundEnabled) return;
  alarm.start(context, session.soundFile, (error) => plugin.log(`Сигнал: ${error.message || error}`));
}

function persistLater(context) {
  clearTimeout(persistSoon.get(context));
  persistSoon.set(
    context,
    setTimeout(() => persist(context), 250)
  );
}

function ensurePulse() {
  if (pulse) return;
  pulse = setInterval(() => {
    if (watched.size === 0) {
      clearInterval(pulse);
      pulse = null;
      return;
    }
    for (const context of [...watched]) {
      const session = sessions.get(context);
      if (!session) {
        watched.delete(context);
        continue;
      }
      if (session.status === STATUS.RUNNING) dispatch(context, { type: 'tick' });
      else if (session.status === STATUS.ALARM) render(context);
      else watched.delete(context);
    }
  }, 200);
}

function watch(context) {
  watched.add(context);
  ensurePulse();
}

function unwatch(context) {
  watched.delete(context);
}

function applyEffects(context, effects) {
  const session = sessions.get(context);
  for (const effect of effects) {
    if (effect === 'watch') watch(context);
    else if (effect === 'unwatch') unwatch(context);
    else if (effect === 'alarm-start') {
      watch(context);
      if (session?.soundEnabled) playAlarm(context);
      plugin.showAlert(context);
    } else if (effect === 'alarm-stop') alarm.stop(context);
    else if (effect === 'persist') persist(context);
    else if (effect === 'persist-soon') persistLater(context);
    else if (effect === 'render') render(context);
  }
}

function dispatch(context, event) {
  const session = sessions.get(context);
  if (!session) return;
  const result = reduce(session, event, Date.now());
  sessions.set(context, result.session);
  applyEffects(context, result.effects);
}

const gesture = createGesture({
  confirmMs: 400,
  windowMs: 900,
  onToggle: (context) => dispatch(context, { type: 'short' }),
  onReset: (context) => dispatch(context, { type: 'hold' }),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (id) => clearTimeout(id)
});

plugin.knob = new Actions({
  default: {
    durationSec: 300,
    stepSec: 60,
    soundEnabled: true,
    soundFile: '',
    theme: 'neon',
    accent: '#3ddc97',
    digitColor: '#f4f7fb',
    background: '#070b10',
    showStatus: true
  },
  _willAppear(data) {
    const context = data.context;
    const settings = normalizeSettings(data.payload?.settings);
    if (!sessions.has(context)) {
      const session = restoreSession(settings, Date.now());
      sessions.set(context, session);
      if (session.status === STATUS.RUNNING || session.status === STATUS.ALARM) watch(context);
      if (session.status === STATUS.ALARM && session.soundEnabled) playAlarm(context);
    } else {
      const session = sessions.get(context);
      sessions.set(context, {
        ...session,
        stepSec: settings.stepSec,
        soundEnabled: settings.soundEnabled,
        soundFile: settings.soundFile
      });
      if (session.status === STATUS.ALARM && !settings.soundEnabled) alarm.stop(context);
    }
    lastTitle.delete(context);
    lastRing.delete(context);
    render(context);
  },
  _didReceiveSettings(data) {
    const context = data.context;
    const session = sessions.get(context);
    if (!session) return;
    const incoming = data.payload?.settings || {};
    const stepSec = normalizeStep(incoming.stepSec);
    const soundEnabled = incoming.soundEnabled !== false && incoming.soundEnabled !== 'false';
    const soundFile = typeof incoming.soundFile === 'string' ? incoming.soundFile : '';
    const fileChanged = soundFile !== (session.soundFile || '');
    const theme = incoming.theme || session.theme || 'neon';
    const accent = incoming.accent || session.accent;
    const digitColor = incoming.digitColor || session.digitColor;
    const background = incoming.background || session.background;
    const showStatus = incoming.showStatus !== false && incoming.showStatus !== 'false';
    sessions.set(context, {
      ...sessions.get(context),
      stepSec,
      soundEnabled,
      soundFile,
      theme,
      accent,
      digitColor,
      background,
      showStatus
    });
    lastRing.delete(context);
    render(context);
    if (session.status === STATUS.ALARM && !soundEnabled) alarm.stop(context);
    if (session.status === STATUS.ALARM && soundEnabled && (!session.soundEnabled || fileChanged)) playAlarm(context);
  },
  dialDown({ context }) {
    gesture.press(context);
  },
  dialUp() {},
  keyDown({ context }) {
    gesture.press(context);
  },
  keyUp() {},
  touchTap({ context }) {
    gesture.press(context);
  },
  sendToPlugin({ context, payload }) {
    if (payload?.command !== 'previewSound') return;
    const session = sessions.get(context);
    alarm.playOnce(session?.soundFile, (error) => plugin.log(`Сигнал: ${error.message || error}`));
  },
  dialRotate({ context, payload }) {
    if (payload?.pressed) return;
    dispatch(context, { type: 'rotate', ticks: payload?.ticks || 0 });
  }
});

process.on('uncaughtException', (error) => {
  console.error('[timer]', error);
});
process.on('unhandledRejection', (error) => {
  console.error('[timer]', error);
});
