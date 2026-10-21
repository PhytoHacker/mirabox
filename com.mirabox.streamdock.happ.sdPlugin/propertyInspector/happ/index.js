const HELP = {
  'com.mirabox.streamdock.happ.connect': {
    title: 'Включить',
    text: 'Нажатие подключает сервер, который сейчас выбран в Happ.',
    command: 'happ://connect'
  },
  'com.mirabox.streamdock.happ.disconnect': {
    title: 'Выключить',
    text: 'Нажатие отключает Happ.',
    command: 'happ://disconnect'
  },
  'com.mirabox.streamdock.happ.toggle': {
    title: 'Переключить',
    text: 'Нажатие включает выбранный сервер или выключает его. Ниже можно показать подпись и выбрать цвета знака.',
    command: 'happ://toggle'
  },
  'com.mirabox.streamdock.happ.open': {
    title: 'Открыть окно',
    text: 'Нажатие открывает окно Happ.',
    command: 'happ://open'
  },
  'com.mirabox.streamdock.happ.close': {
    title: 'Закрыть окно',
    text: 'Нажатие прячет окно Happ. Подключение при этом не рвётся.',
    command: 'happ://close'
  },
  'com.mirabox.streamdock.happ.routing': {
    title: 'Маршруты выкл',
    text: 'Нажатие выключает правила маршрутизации. Само подключение к серверу не меняется.',
    command: 'happ://routing/off'
  }
};

function fillSettings(raw) {
  const colorOn = document.getElementById('colorOn');
  const colorOff = document.getElementById('colorOff');
  document.getElementById('showCaption').checked = raw?.showCaption !== false && raw?.showCaption !== 'false';
  if (/^#[0-9a-fA-F]{6}$/.test(raw?.colorOn || '')) colorOn.value = raw.colorOn;
  if (/^#[0-9a-fA-F]{6}$/.test(raw?.colorOff || '')) colorOff.value = raw.colorOff;
}

function saveSettings(socket, uuid) {
  socket.send(JSON.stringify({
    event: 'setSettings',
    context: uuid,
    payload: {
      showCaption: document.getElementById('showCaption').checked,
      colorOn: document.getElementById('colorOn').value,
      colorOff: document.getElementById('colorOff').value
    }
  }));
}

function connectElgatoStreamDeckSocket(port, uuid, event, app, info) {
  const action = JSON.parse(info).action;
  const help = HELP[action] || HELP['com.mirabox.streamdock.happ.connect'];
  const tune = action === 'com.mirabox.streamdock.happ.toggle';
  document.getElementById('title').textContent = help.title;
  document.getElementById('text').textContent = help.text;
  document.getElementById('command').textContent = help.command;
  document.getElementById('tune').hidden = !tune;
  document.getElementById('note').hidden = tune;
  if (!tune) return;

  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  socket.onopen = () => {
    socket.send(JSON.stringify({ event, uuid }));
    socket.send(JSON.stringify({ event: 'getSettings', context: uuid }));
  };
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.event === 'didReceiveSettings') fillSettings(data.payload?.settings);
  };
  for (const id of ['showCaption', 'colorOn', 'colorOff']) {
    document.getElementById(id).addEventListener('input', () => saveSettings(socket, uuid));
  }
}
