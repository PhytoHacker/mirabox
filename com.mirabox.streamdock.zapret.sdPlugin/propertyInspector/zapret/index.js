const DEFAULTS = {
  root: 'C:\\Users\\User\\Desktop\\zapr',
  strategy: 'general (ALT11).bat'
};

let socket = null;
let context = '';
let hydrating = false;
let settings = Object.assign({}, DEFAULTS);

function fill(raw) {
  settings = {
    root: String(raw?.root || '').trim() || DEFAULTS.root,
    strategy: String(raw?.strategy || '').trim() || DEFAULTS.strategy
  };
  document.getElementById('root').value = settings.root;
  document.getElementById('strategy').value = settings.strategy;
}

function save() {
  if (hydrating || !socket) return;
  settings = {
    root: document.getElementById('root').value.trim() || DEFAULTS.root,
    strategy: document.getElementById('strategy').value.trim() || DEFAULTS.strategy
  };
  document.getElementById('root').value = settings.root;
  document.getElementById('strategy').value = settings.strategy;
  socket.send(JSON.stringify({ event: 'setSettings', context, payload: settings }));
}

function connectElgatoStreamDeckSocket(port, uuid, event) {
  context = uuid;
  socket = new WebSocket(`ws://127.0.0.1:${port}`);
  socket.onopen = () => {
    socket.send(JSON.stringify({ event, uuid }));
    socket.send(JSON.stringify({ event: 'getSettings', context: uuid }));
    socket.send(JSON.stringify({
      event: 'sendToPlugin',
      action: 'com.mirabox.streamdock.zapret.toggle',
      context: uuid,
      payload: { command: 'refresh' }
    }));
  };
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    hydrating = true;
    if (data.event === 'didReceiveSettings') fill(data.payload?.settings);
    if (data.event === 'sendToPropertyInspector') {
      const status = document.getElementById('status');
      if (data.payload?.running === true) status.textContent = 'включён';
      else if (data.payload?.running === false) status.textContent = 'выключен';
    }
    hydrating = false;
  };
}

document.getElementById('root').addEventListener('change', save);
document.getElementById('strategy').addEventListener('change', save);
