const clientIdInput = document.getElementById('clientId');
const clientSecretInput = document.getElementById('clientSecret');
const listInput = document.getElementById('list');
const intervalInput = document.getElementById('interval');
const showNameInput = document.getElementById('showName');
const statusNode = document.getElementById('status');
const intervals = ['30', '60', '300'];

let socket = null;
let context = '';
let hydrating = false;
let knownLists = '';
let lastPayload = null;
let settings = { clientId: '', clientSecret: '', listId: '', interval: 60, showName: false };

function save() {
  if (hydrating || !socket) return;
  settings = {
    clientId: clientIdInput.value.trim(),
    clientSecret: clientSecretInput.value.trim(),
    listId: listInput.value,
    interval: Number(intervalInput.value),
    showName: showNameInput.checked
  };
  socket.send(JSON.stringify({
    event: 'setSettings',
    context,
    payload: settings
  }));
}

function send(payload) {
  if (!socket) return;
  socket.send(JSON.stringify({
    event: 'sendToPlugin',
    action: 'com.mirabox.streamdock.tasks.count',
    context,
    payload
  }));
}

function fillLists(lists, selected) {
  if (!Array.isArray(lists)) {
    if (selected != null && [...listInput.options].some((option) => option.value === selected)) {
      listInput.value = selected;
    }
    return;
  }
  const signature = lists.map((list) => `${list.id}:${list.title}`).join('|');
  if (signature !== knownLists) {
    knownLists = signature;
    const current = selected || listInput.value;
    listInput.innerHTML = '';
    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'Все списки';
    listInput.appendChild(all);
    for (const list of lists) {
      const option = document.createElement('option');
      option.value = list.id;
      option.textContent = list.title || 'Список';
      listInput.appendChild(option);
    }
    listInput.value = [...listInput.options].some((option) => option.value === current) ? current : '';
  } else if (selected != null && [...listInput.options].some((option) => option.value === selected)) {
    listInput.value = selected;
  }
}

function showStatus(payload) {
  statusNode.classList.toggle('warn', !!payload.error);
  if (payload.error) {
    statusNode.textContent = payload.error;
    return;
  }
  if (!settings.clientId) {
    statusNode.textContent = 'Вставьте ID и секрет, затем войдите.';
    return;
  }
  if (!payload.signedIn) {
    statusNode.textContent = 'Нужно войти в Google.';
    return;
  }
  if (payload.count == null) {
    statusNode.textContent = payload.email ? `Считаю задачи для ${payload.email}…` : 'Считаю задачи…';
    return;
  }
  const who = payload.email ? ` · ${payload.email}` : '';
  statusNode.textContent = `${payload.count} открытых${who}`;
}

function connectElgatoStreamDeckSocket(port, uuid, event) {
  context = uuid;
  socket = new WebSocket(`ws://127.0.0.1:${port}`);
  socket.onopen = () => {
    socket.send(JSON.stringify({ event, uuid }));
    socket.send(JSON.stringify({ event: 'getSettings', context: uuid }));
    send({ command: 'refresh' });
  };
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    hydrating = true;
    if (data.event === 'didReceiveSettings') {
      const incoming = data.payload?.settings || {};
      settings.clientId = typeof incoming.clientId === 'string' ? incoming.clientId : '';
      settings.clientSecret = typeof incoming.clientSecret === 'string' ? incoming.clientSecret : '';
      settings.listId = typeof incoming.listId === 'string' ? incoming.listId : '';
      settings.interval = intervals.includes(String(incoming.interval)) ? Number(incoming.interval) : 60;
      settings.showName = incoming.showName === true || incoming.showName === 'true';
      clientIdInput.value = settings.clientId;
      clientSecretInput.value = settings.clientSecret;
      intervalInput.value = String(settings.interval);
      showNameInput.checked = settings.showName;
      fillLists(null, settings.listId);
      if (lastPayload) showStatus(lastPayload);
    }
    if (data.event === 'sendToPropertyInspector') {
      const payload = data.payload || {};
      lastPayload = payload;
      if (intervals.includes(String(payload.interval))) intervalInput.value = String(payload.interval);
      fillLists(payload.lists || [], payload.listId ?? settings.listId);
      showStatus(payload);
    }
    hydrating = false;
  };
}

for (const node of [clientIdInput, clientSecretInput, listInput, intervalInput, showNameInput]) {
  node.addEventListener('change', save);
}
document.getElementById('login').addEventListener('click', () => {
  save();
  send({ command: 'login' });
});
document.getElementById('logout').addEventListener('click', () => send({ command: 'logout' }));
for (const node of document.querySelectorAll('[data-link]')) {
  node.addEventListener('click', () => send({ command: 'open', link: node.dataset.link }));
}
