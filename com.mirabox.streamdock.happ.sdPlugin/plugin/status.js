const net = require('net');

const STATS_PORT = 11111;
const SOCKS_PORT = 10808;
const DEFAULTS = {
  showCaption: true,
  colorOn: '#ffffff',
  colorOff: '#4e4e4e'
};

function normalizeHex(value, fallback) {
  const text = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : fallback;
}

function readToggleSettings(raw) {
  return {
    showCaption: raw?.showCaption !== false && raw?.showCaption !== 'false',
    colorOn: normalizeHex(raw?.colorOn, DEFAULTS.colorOn),
    colorOff: normalizeHex(raw?.colorOff, DEFAULTS.colorOff)
  };
}

function appearance(connected, settings = DEFAULTS) {
  const status = connected ? 'ВКЛ' : 'ВЫКЛ';
  return {
    state: connected ? 1 : 0,
    title: settings.showCaption === false ? '' : status,
    color: connected ? settings.colorOn : settings.colorOff,
    plain: settings.showCaption === false
  };
}

function probePort(port, timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    let settled = false;
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function readConnected(probe = probePort) {
  const [stats, socks] = await Promise.all([probe(STATS_PORT), probe(SOCKS_PORT)]);
  return Boolean(stats || socks);
}

module.exports = {
  appearance,
  probePort,
  readConnected,
  readToggleSettings,
  DEFAULTS,
  STATS_PORT,
  SOCKS_PORT
};
