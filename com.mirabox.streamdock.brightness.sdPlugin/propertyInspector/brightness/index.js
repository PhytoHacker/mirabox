const monitorInput = document.getElementById('monitor');
const stepInput = document.getElementById('step');
const brightnessNode = document.getElementById('brightness');
const steps = ['1', '5', '10'];
let socket = null;
let context = '';
let hydrating = false;
let knownIds = null;
let settings = { monitorId: '', step: 5 };

function monitorLabel(monitor) {
  const notes = [];
  if (monitor.primary) notes.push('основной');
  if (monitor.hdr) notes.push('HDR');
  return notes.length ? `${monitor.name} · ${notes.join(', ')}` : monitor.name;
}

function fillMonitors(monitors, selected) {
  if (Array.isArray(monitors)) {
    const ids = monitors.map((monitor) => monitor.id).join('|');
    if (ids !== knownIds) {
      knownIds = ids;
      monitorInput.innerHTML = '';
      if (!monitors.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Экраны не найдены';
      monitorInput.appendChild(option);
      monitorInput.disabled = true;
    } else {
      monitorInput.disabled = false;
      for (const monitor of monitors) {
        const option = document.createElement('option');
        option.value = monitor.id;
        option.textContent = monitorLabel(monitor);
        monitorInput.appendChild(option);
      }
      const all = document.createElement('option');
      all.value = 'all';
      all.textContent = 'Все';
      monitorInput.appendChild(all);
    }
    }
  }
  const choice = selected || settings.monitorId;
  if (choice && [...monitorInput.options].some((option) => option.value === choice)) {
    monitorInput.value = choice;
  }
}

function showBrightness(value) {
  brightnessNode.textContent = value == null || value === '' ? '—' : `${value}%`;
}

function save() {
  if (hydrating || !socket || monitorInput.disabled) return;
  settings = {
    monitorId: monitorInput.value,
    step: Number(stepInput.value)
  };
  socket.send(JSON.stringify({
    event: 'setSettings',
    context,
    payload: settings
  }));
}

function connectElgatoStreamDeckSocket(port, uuid, event) {
  context = uuid;
  socket = new WebSocket(`ws://127.0.0.1:${port}`);
  socket.onopen = () => {
    socket.send(JSON.stringify({ event, uuid }));
    socket.send(JSON.stringify({ event: 'getSettings', context: uuid }));
    socket.send(JSON.stringify({
      event: 'sendToPlugin',
      action: 'com.mirabox.streamdock.brightness.monitor',
      context: uuid,
      payload: { command: 'monitors' }
    }));
  };
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    hydrating = true;
    if (data.event === 'didReceiveSettings') {
      const incoming = data.payload?.settings || {};
      settings.monitorId = typeof incoming.monitorId === 'string' ? incoming.monitorId : settings.monitorId;
      settings.step = steps.includes(String(incoming.step)) ? Number(incoming.step) : settings.step;
      stepInput.value = String(settings.step);
      fillMonitors(null, settings.monitorId);
    }
    if (data.event === 'sendToPropertyInspector') {
      const payload = data.payload || {};
      if (payload.monitorId) settings.monitorId = payload.monitorId;
      if (steps.includes(String(payload.step))) {
        settings.step = Number(payload.step);
        stepInput.value = String(settings.step);
      }
      fillMonitors(payload.monitors || [], payload.monitorId || settings.monitorId);
      if (Object.prototype.hasOwnProperty.call(payload, 'brightness')) showBrightness(payload.brightness);
    }
    hydrating = false;
  };
}

monitorInput.addEventListener('change', save);
stepInput.addEventListener('change', save);
