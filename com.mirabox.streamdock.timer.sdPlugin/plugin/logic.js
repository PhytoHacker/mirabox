const MAX_SEC = 6 * 60 * 60;
const MAX_SW_MS = (99 * 3600 + 59 * 60 + 59) * 1000;
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
    alarm: '#ff5a6a',
    stopwatch: '#59b7ff'
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
    alarm: '#ff6a3d',
    stopwatch: '#ff5ea8'
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
    alarm: '#ff6b8a',
    stopwatch: '#b388ff'
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
    alarm: '#ff2a2a',
    stopwatch: '#ffc14d'
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

const SW_LABELS = Object.freeze({
  idle: 'СЕКУНД',
  running: 'ИДЕТ',
  paused: 'СТОП'
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
    alarm: accent,
    stopwatch: normalizeColor(settings.stopwatchColor, THEMES.neon.stopwatch)
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
  if (session?.mode === 'stopwatch') {
    const ms = Math.max(0, Number(session.swShowMs) || 0);
    return (ms % 60000) / 60000;
  }
  if (!session || session.status === STATUS.ALARM || session.durationSec <= 0) return 0;
  return Math.max(0, Math.min(1, displaySeconds(session.remainingMs) / session.durationSec));
}

function formatTitle(session, blinkOn = true) {
  if (session.mode === 'stopwatch') {
    const seconds = Math.floor(Math.max(0, Number(session.swShowMs) || 0) / 1000);
    const label = SW_LABELS[session.swStatus] || SW_LABELS.idle;
    return `${formatTime(seconds)}\n${label}`;
  }
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

function normalizeMode(value) {
  return value === 'stopwatch' ? 'stopwatch' : 'timer';
}

function normalizeSwStatus(value) {
  if (value === STATUS.RUNNING || value === STATUS.PAUSED || value === STATUS.IDLE) return value;
  return STATUS.IDLE;
}

function clampSw(ms) {
  const n = Math.round(Number(ms) || 0);
  if (n < 0) return 0;
  if (n > MAX_SW_MS) return MAX_SW_MS;
  return n;
}

function stopwatchMs(session, now) {
  const base = Math.max(0, Number(session.swBaseMs) || 0);
  const ms = session.swStatus === STATUS.RUNNING && session.swStartedAt > 0
    ? base + Math.max(0, now - session.swStartedAt)
    : base;
  if (ms < 0) return 0;
  if (ms > MAX_SW_MS) return MAX_SW_MS;
  return ms;
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
    stopwatchColor: normalizeColor(settings.stopwatchColor, THEMES.neon.stopwatch),
    showStatus: showStatusFrom(settings.showStatus),
    mode: normalizeMode(settings.mode),
    status: STATUS.IDLE,
    remainingMs: durationSec * 1000,
    endsAt: 0,
    lastRotateAt: 0,
    swStatus: STATUS.IDLE,
    swBaseMs: 0,
    swStartedAt: 0,
    swShowMs: 0
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
    stopwatchColor: normalizeColor(s.stopwatchColor, THEMES.neon.stopwatch),
    showStatus: showStatusFrom(s.showStatus),
    mode: normalizeMode(s.mode),
    swStatus: normalizeSwStatus(s.swStatus),
    swBaseMs: clampSw(s.swBaseMs),
    swStartedAt: Number(s.swStartedAt) || 0,
    status: s.status || STATUS.IDLE,
    remainingSec: Math.max(0, Math.round(Number(s.remainingSec) || 0)),
    endsAt: Number(s.endsAt) || 0
  };
}

function restoreStopwatch(settings, now) {
  const swStatus = normalizeSwStatus(settings.swStatus);
  const swBaseMs = clampSw(settings.swBaseMs);
  const swStartedAt = Number(settings.swStartedAt) || 0;
  if (swStatus === STATUS.RUNNING && swStartedAt > 0 && swStartedAt <= now) {
    const swShowMs = Math.min(MAX_SW_MS, swBaseMs + (now - swStartedAt));
    if (swShowMs >= MAX_SW_MS) {
      return { swStatus: STATUS.PAUSED, swBaseMs: MAX_SW_MS, swStartedAt: 0, swShowMs: MAX_SW_MS };
    }
    return { swStatus: STATUS.RUNNING, swBaseMs, swStartedAt, swShowMs };
  }
  if (swStatus === STATUS.PAUSED || (swStatus === STATUS.RUNNING && swBaseMs > 0)) {
    return { swStatus: STATUS.PAUSED, swBaseMs, swStartedAt: 0, swShowMs: swBaseMs };
  }
  return { swStatus: STATUS.IDLE, swBaseMs: 0, swStartedAt: 0, swShowMs: 0 };
}

function restoreSession(settings, now) {
  const base = createSession(settings);
  let session = base;
  if (settings.status === STATUS.PAUSED) {
    session = { ...base, status: STATUS.PAUSED, remainingMs: clampDuration(settings.remainingSec) * 1000 };
  } else if (settings.status === STATUS.RUNNING && settings.endsAt > now) {
    session = {
      ...base,
      status: STATUS.RUNNING,
      endsAt: settings.endsAt,
      remainingMs: settings.endsAt - now
    };
  } else if (
    (settings.status === STATUS.RUNNING && settings.endsAt > 0 && settings.endsAt <= now) ||
    settings.status === STATUS.ALARM
  ) {
    session = { ...base, status: STATUS.ALARM, remainingMs: 0, endsAt: 0 };
  }
  session = { ...session, ...restoreStopwatch(settings, now) };
  if (session.mode === 'stopwatch' && session.status === STATUS.ALARM) {
    session = samePreset(session);
  } else if (session.mode === 'stopwatch' && session.status === STATUS.RUNNING) {
    const remainingMs = session.endsAt > now ? session.endsAt - now : Math.max(0, session.remainingMs);
    session = { ...session, status: STATUS.PAUSED, remainingMs, endsAt: 0 };
  }
  if (session.mode !== 'stopwatch' && session.swStatus === STATUS.RUNNING) {
    const ms = stopwatchMs(session, now);
    session = { ...session, swStatus: STATUS.PAUSED, swBaseMs: ms, swStartedAt: 0, swShowMs: ms };
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
    stopwatchColor: session.stopwatchColor,
    showStatus: session.showStatus !== false,
    mode: session.mode === 'stopwatch' ? 'stopwatch' : 'timer',
    swStatus: session.swStatus || STATUS.IDLE,
    swBaseMs: Math.max(0, Math.round(session.swBaseMs || 0)),
    swStartedAt: session.swStatus === STATUS.RUNNING ? session.swStartedAt : 0,
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

function onStopwatchShort(session, now) {
  if (session.swStatus === STATUS.RUNNING) {
    const ms = stopwatchMs(session, now);
    return {
      session: { ...session, swStatus: STATUS.PAUSED, swBaseMs: ms, swStartedAt: 0, swShowMs: ms },
      effects: ['unwatch', 'persist', 'render']
    };
  }
  const base = session.swStatus === STATUS.PAUSED ? session.swBaseMs : 0;
  return {
    session: {
      ...session,
      swStatus: STATUS.RUNNING,
      swBaseMs: base,
      swStartedAt: now,
      swShowMs: base
    },
    effects: ['watch', 'persist', 'render']
  };
}

function onStopwatchReset(session) {
  return {
    session: { ...session, swStatus: STATUS.IDLE, swBaseMs: 0, swStartedAt: 0, swShowMs: 0 },
    effects: ['unwatch', 'persist', 'render']
  };
}

function onStopwatchTick(session, now) {
  if (session.swStatus !== STATUS.RUNNING) return { session, effects: [] };
  const ms = stopwatchMs(session, now);
  if (ms >= MAX_SW_MS) {
    return {
      session: { ...session, swStatus: STATUS.PAUSED, swBaseMs: MAX_SW_MS, swStartedAt: 0, swShowMs: MAX_SW_MS },
      effects: ['unwatch', 'persist', 'render']
    };
  }
  if (ms === session.swShowMs) return { session, effects: [] };
  return { session: { ...session, swShowMs: ms }, effects: ['render'] };
}

function reduceStopwatch(session, event, now) {
  switch (event.type) {
    case 'rotate':
      return { session, effects: [] };
    case 'short':
      return onStopwatchShort(session, now);
    case 'hold':
      return onStopwatchReset(session);
    case 'tick':
      return onStopwatchTick(session, now);
    default:
      return { session, effects: [] };
  }
}

function onModeSwitch(session, now) {
  if (session.mode !== 'stopwatch') {
    let next = session;
    const effects = [];
    if (session.status === STATUS.ALARM) {
      next = samePreset(session);
      effects.push('alarm-stop');
    } else if (session.status === STATUS.RUNNING) {
      next = {
        ...session,
        status: STATUS.PAUSED,
        remainingMs: Math.max(0, session.endsAt - now),
        endsAt: 0
      };
    }
    next = { ...next, mode: 'stopwatch' };
    if (next.swStatus === STATUS.RUNNING) {
      next = { ...next, swShowMs: stopwatchMs(next, now) };
      effects.push('watch');
    } else {
      effects.push('unwatch');
    }
    effects.push('persist', 'render');
    return { session: next, effects };
  }

  let next = session;
  if (session.swStatus === STATUS.RUNNING) {
    const ms = stopwatchMs(session, now);
    next = { ...session, swStatus: STATUS.PAUSED, swBaseMs: ms, swStartedAt: 0, swShowMs: ms };
  }
  return {
    session: { ...next, mode: 'timer' },
    effects: ['unwatch', 'persist', 'render']
  };
}

function reduce(session, event, now) {
  if (event.type === 'mode') return onModeSwitch(session, now);
  if (session.mode === 'stopwatch') return reduceStopwatch(session, event, now);
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
  MAX_SW_MS,
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
