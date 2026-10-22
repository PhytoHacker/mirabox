const WebSocket = require('ws');

function readLaunchArgs(argv) {
  const flag = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    port: flag('-port') || argv[3],
    uuid: flag('-pluginUUID') || argv[5],
    event: flag('-registerEvent') || argv[7]
  };
}

function createPlugin() {
  const { port, uuid, event } = readLaunchArgs(process.argv);
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const pending = [];
  const plugin = {
    ws,
    send(payload) {
      const raw = JSON.stringify(payload);
      if (ws.readyState === WebSocket.OPEN) ws.send(raw);
      else pending.push(raw);
    },
    setTitle(context, title) {
      plugin.send({
        event: 'setTitle',
        context,
        payload: { title: String(title), target: 0 }
      });
    },
    setImage(context, image) {
      plugin.send({
        event: 'setImage',
        context,
        payload: { image, target: 0 }
      });
    },
    sendToPropertyInspector(context, payload) {
      plugin.send({ event: 'sendToPropertyInspector', context, payload });
    },
    showOk(context) {
      plugin.send({ event: 'showOk', context });
    },
    showAlert(context) {
      plugin.send({ event: 'showAlert', context });
    },
    log(message) {
      plugin.send({ event: 'logMessage', payload: { message: String(message) } });
    }
  };

  ws.on('open', () => {
    ws.send(JSON.stringify({ uuid, event }));
    for (const raw of pending) ws.send(raw);
    pending.length = 0;
  });
  ws.on('error', (error) => {
    console.error('[tasks]', error);
  });
  ws.on('close', () => {
    process.exit(0);
  });
  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch (error) {
      console.error('[tasks]', error);
      return;
    }
    const action = data.action?.split('.').pop();
    plugin[action]?.[data.event]?.(data);
  });
  return plugin;
}

class Actions {
  constructor(data) {
    Object.assign(this, data);
  }
}

module.exports = { createPlugin, Actions, readLaunchArgs };
