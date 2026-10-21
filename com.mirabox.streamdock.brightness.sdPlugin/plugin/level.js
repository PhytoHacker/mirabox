const STEPS = [1, 5, 10];

function clampBrightness(value, min = 0, max = 100) {
  const low = Math.min(Number(min) || 0, Number(max) || 0);
  const high = Math.max(Number(min) || 0, Number(max) || 0);
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return low;
  return Math.max(low, Math.min(high, number));
}

function normalizeStep(value) {
  const step = Number(value);
  return STEPS.includes(step) ? step : 5;
}

function applyTicks(brightness, ticks, step, min = 0, max = 100) {
  if (brightness == null || !Number.isFinite(Number(brightness))) return null;
  const delta = (Number(ticks) || 0) * normalizeStep(step);
  return clampBrightness(Number(brightness) + delta, min, max);
}

const ALL_MONITORS = 'all';

function monitorList(monitors) {
  return (Array.isArray(monitors) ? monitors : []).filter((monitor) => monitor && monitor.id);
}

function chooseMonitor(monitors, savedId) {
  const list = monitorList(monitors);
  if (!list.length) return null;
  if (savedId && savedId !== ALL_MONITORS) {
    const saved = list.find((monitor) => monitor.id === savedId);
    if (saved) return saved;
  }
  return list.find((monitor) => monitor.primary) || list[0];
}

function nextMonitorId(monitors, currentId) {
  const ids = monitorList(monitors).map((monitor) => monitor.id);
  if (!ids.length) return null;
  ids.push(ALL_MONITORS);
  const index = ids.indexOf(currentId);
  return ids[(index + 1) % ids.length];
}

function averageBrightness(monitors) {
  const values = monitorList(monitors)
    .map((monitor) => Number(monitor.brightness))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

module.exports = {
  ALL_MONITORS,
  clampBrightness,
  normalizeStep,
  applyTicks,
  chooseMonitor,
  nextMonitorId,
  averageBrightness
};
