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

const LABELS = Object.freeze({
  idle: 'ПУСК',
  running: 'ИДЕТ',
  paused: 'СТОП',
  alarm: 'КОНЕЦ'
});

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

function createSession(settings = {}) {
  const durationSec = clampDuration(settings.durationSec ?? 300);
  return {
    durationSec,
    stepSec: normalizeStep(settings.stepSec),
    soundEnabled: soundEnabledFrom(settings.soundEnabled),
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
  createSession,
  normalizeSettings,
  restoreSession,
  toSettings,
  reduce
};
