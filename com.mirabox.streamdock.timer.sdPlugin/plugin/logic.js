const MAX_SEC = 6 * 60 * 60;
const HOLD_MS = 700;
const FAST_ROTATE_MS = 70;
const STEPS = [5, 15, 30, 60, 300];

const STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  ALARM: 'alarm'
});

const THEMES = Object.freeze({
  neon: {
    background: '#070b10',
    digits: '#f4f7fb',
    track: '#1c2836',
    tick: '#3d4d62',
    tickMajor: '#8ea0b8',
    idle: '#7aa2d6',
    running: '#3ddc97',
    paused: '#f0ba5a',
    alarm: '#ff5a6a'
  },
  amber: {
    background: '#120d08',
    digits: '#fff4e0',
    track: '#3a2a18',
    tick: '#6a5030',
    tickMajor: '#e2c08a',
    idle: '#e2c08a',
    running: '#ffb020',
    paused: '#ffd27a',
    alarm: '#ff6a3d'
  },
  ice: {
    background: '#071018',
    digits: '#e7f6ff',
    track: '#163044',
    tick: '#2d5570',
    tickMajor: '#9fd4ee',
    idle: '#7ec8e3',
    running: '#4fd2ff',
    paused: '#b9e6ff',
    alarm: '#ff6b8a'
  },
  blood: {
    background: '#100608',
    digits: '#ffe8ea',
    track: '#3a1418',
    tick: '#6a3036',
    tickMajor: '#e7a0a6',
    idle: '#e7a0a6',
    running: '#ff4d5a',
    paused: '#ffb0b6',
    alarm: '#ff2a2a'
  }
});

function normalizeTheme(value) {
  return Object.prototype.hasOwnProperty.call(THEMES, value) || value === 'custom' ? value : 'neon';
}

function normalizeColor(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

function showStatusFrom(value) {
  return value !== false && value !== 'false';
}

const LABELS = Object.freeze({
  idle: 'ПУСК',
  running: 'ИДЕТ',
  paused: 'СТОП',
  alarm: 'КОНЕЦ'
});

function faceStyle(settings = {}) {
  const theme = normalizeTheme(settings.theme);
  const showStatus = showStatusFrom(settings.showStatus);
  if (theme !== 'custom') return { theme, showStatus, ...THEMES[theme] };
  const accent = normalizeColor(settings.accent, THEMES.neon.running);
  return {
    theme,
    showStatus,
    background: normalizeColor(settings.background, THEMES.neon.background),
    digits: normalizeColor(settings.digitColor, THEMES.neon.digits),
    track: '#243040',
    tick: '#3d4d62',
    tickMajor: '#8ea0b8',
    idle: accent,
    running: accent,
    paused: accent,
    alarm: accent
  };
}

function clampDuration(seconds) {
  const n = Math.round(Number(seconds) || 0);
  if (n < 0) return 0;
  if (n > MAX_SEC) return MAX_SEC;
  return n;
}

function normalizeStep(value) {
  const n = Number(value);
  return STEPS.includes(n) ? n : 60;
}

function soundEnabledFrom(value) {
  return value !== false && value !== 'false';
}

function displaySeconds(remainingMs) {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000 - 1e-6);
}

function formatTime(totalSeconds) {
  const sec = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function ringPercent(session) {
  if (!session || session.status === STATUS.ALARM || session.durationSec <= 0) return 0;
  return Math.max(0, Math.min(1, displaySeconds(session.remainingMs) / session.durationSec));
}

function formatTitle(session, blinkOn = true) {
  const seconds = session.status === STATUS.ALARM ? 0 : displaySeconds(session.remainingMs);
  const time = formatTime(seconds);
  if (session.status === STATUS.ALARM && !blinkOn) return `${time}\n....`;
  return `${time}\n${LABELS[session.status] || LABELS.idle}`;
}

function deltaSeconds(ticks, stepSec, fast) {
  const t = Math.trunc(Number(ticks) || 0);
  if (!t) return 0;
  const mag = Math.abs(t);
  const sign = t > 0 ? 1 : -1;
  const mult = fast && mag === 1 ? 4 : 1;
  return sign * mag * normalizeStep(stepSec) * mult;
}

function soundFileFrom(value) {
  return typeof value === 'string' ? value : '';
}

function createSession(settings = {}) {
  const durationSec = clampDuration(settings.durationSec ?? 300);
  return {
    durationSec,
    stepSec: normalizeStep(settings.stepSec),
    soundEnabled: soundEnabledFrom(settings.soundEnabled),
    soundFile: soundFileFrom(settings.soundFile),
    theme: normalizeTheme(settings.theme),
    accent: normalizeColor(settings.accent, THEMES.neon.running),
    digitColor: normalizeColor(settings.digitColor, THEMES.neon.digits),
    background: normalizeColor(settings.background, THEMES.neon.background),
    showStatus: showStatusFrom(settings.showStatus),
    status: STATUS.IDLE,
    remainingMs: durationSec * 1000,
    endsAt: 0,
    lastRotateAt: 0
  };
}

function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    durationSec: s.durationSec == null ? 300 : clampDuration(s.durationSec),
    stepSec: normalizeStep(s.stepSec),
    soundEnabled: soundEnabledFrom(s.soundEnabled),
    soundFile: soundFileFrom(s.soundFile),
    theme: normalizeTheme(s.theme),
    accent: normalizeColor(s.accent, THEMES.neon.running),
    digitColor: normalizeColor(s.digitColor, THEMES.neon.digits),
    background: normalizeColor(s.background, THEMES.neon.background),
    showStatus: showStatusFrom(s.showStatus),
    status: s.status || STATUS.IDLE,
    remainingSec: Math.max(0, Math.round(Number(s.remainingSec) || 0)),
    endsAt: Number(s.endsAt) || 0
  };
}

function restoreSession(settings, now) {
  const session = createSession(settings);
  if (settings.status === STATUS.PAUSED) {
    const remainingMs = clampDuration(settings.remainingSec) * 1000;
    return { ...session, status: STATUS.PAUSED, remainingMs };
  }
  if (settings.status === STATUS.RUNNING && settings.endsAt > now) {
    return {
      ...session,
      status: STATUS.RUNNING,
      endsAt: settings.endsAt,
      remainingMs: settings.endsAt - now
    };
  }
  if (
    (settings.status === STATUS.RUNNING && settings.endsAt > 0 && settings.endsAt <= now) ||
    settings.status === STATUS.ALARM
  ) {
    return { ...session, status: STATUS.ALARM, remainingMs: 0, endsAt: 0 };
  }
  return session;
}

function toSettings(session) {
  return {
    durationSec: session.durationSec,
    stepSec: session.stepSec,
    soundEnabled: session.soundEnabled,
    soundFile: session.soundFile || '',
    theme: session.theme || 'neon',
    accent: session.accent,
    digitColor: session.digitColor,
    background: session.background,
    showStatus: session.showStatus !== false,
    status: session.status,
    remainingSec: Math.max(0, Math.round(session.remainingMs / 1000)),
    endsAt: session.status === STATUS.RUNNING ? session.endsAt : 0
  };
}

function samePreset(session) {
  return {
    ...session,
    status: STATUS.IDLE,
    remainingMs: session.durationSec * 1000,
    endsAt: 0
  };
}

function onRotate(session, ticks, now) {
  if (session.status === STATUS.RUNNING) return { session, effects: [] };
  const fast = session.lastRotateAt > 0 && now - session.lastRotateAt < FAST_ROTATE_MS;
  const delta = deltaSeconds(ticks, session.stepSec, fast);
  if (!delta) return { session: { ...session, lastRotateAt: now }, effects: [] };

  const stopAlarm = session.status === STATUS.ALARM;
  const durationSec = clampDuration(session.durationSec + delta);
  const status = session.status === STATUS.PAUSED ? STATUS.PAUSED : STATUS.IDLE;
  return {
    session: {
      ...session,
      durationSec,
      remainingMs: durationSec * 1000,
      status,
      endsAt: 0,
      lastRotateAt: now
    },
    effects: [...(stopAlarm ? ['alarm-stop', 'unwatch'] : []), 'persist-soon', 'render']
  };
}

function onShortPress(session, now) {
  if (session.status === STATUS.ALARM) {
    return { session: samePreset(session), effects: ['alarm-stop', 'unwatch', 'persist', 'render'] };
  }
  if (session.status === STATUS.RUNNING) {
    const remainingMs = Math.max(0, session.endsAt - now);
    return {
      session: { ...session, status: STATUS.PAUSED, remainingMs, endsAt: 0 },
      effects: ['unwatch', 'persist', 'render']
    };
  }
  if (session.status === STATUS.PAUSED) {
    const remainingMs = session.remainingMs > 0 ? session.remainingMs : session.durationSec * 1000;
    if (remainingMs <= 0) return { session, effects: [] };
    return {
      session: { ...session, status: STATUS.RUNNING, remainingMs, endsAt: now + remainingMs },
      effects: ['watch', 'persist', 'render']
    };
  }
  if (session.durationSec <= 0) return { session, effects: [] };
  const remainingMs = session.durationSec * 1000;
  return {
    session: { ...session, status: STATUS.RUNNING, remainingMs, endsAt: now + remainingMs },
    effects: ['watch', 'persist', 'render']
  };
}

function onHold(session) {
  const stopAlarm = session.status === STATUS.ALARM;
  return {
    session: samePreset(session),
    effects: [...(stopAlarm ? ['alarm-stop'] : []), 'unwatch', 'persist', 'render']
  };
}

function onTick(session, now) {
  if (session.status !== STATUS.RUNNING) return { session, effects: [] };
  const remainingMs = session.endsAt - now;
  if (remainingMs <= 0) {
    return {
      session: { ...session, status: STATUS.ALARM, remainingMs: 0, endsAt: 0 },
      effects: ['alarm-start', 'persist', 'render']
    };
  }
  const changed = displaySeconds(remainingMs) !== displaySeconds(session.remainingMs);
  return {
    session: { ...session, remainingMs },
    effects: changed ? ['render'] : []
  };
}

function reduce(session, event, now) {
  switch (event.type) {
    case 'rotate':
      return onRotate(session, event.ticks, now);
    case 'short':
      return onShortPress(session, now);
    case 'hold':
      return onHold(session);
    case 'tick':
      return onTick(session, now);
    default:
      return { session, effects: [] };
  }
}

module.exports = {
  MAX_SEC,
  HOLD_MS,
  STATUS,
  STEPS,
  clampDuration,
  normalizeStep,
  displaySeconds,
  formatTime,
  formatTitle,
  ringPercent,
  faceStyle,
  createSession,
  normalizeSettings,
  restoreSession,
  toSettings,
  reduce
};
