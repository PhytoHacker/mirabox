const WebSocket = require('ws');
const { recordEvent } = require('./events-log');

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

function createPlugin({ onClose } = {}) {
  const { port, uuid, event } = readLaunchArgs(process.argv);
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const pending = [];
  const plugin = {
    ws,
    knob: null,
    send(payload) {
      const raw = JSON.stringify(payload);
      if (ws.readyState === WebSocket.OPEN) ws.send(raw);
      else pending.push(raw);
    },
    setImage(context, image) {
      plugin.send({
        event: 'setImage',
        context,
        payload: { image, target: 0 }
      });
    },
    setTitle(context, title) {
      plugin.send({
        event: 'setTitle',
        context,
        payload: { title: String(title), target: 0 }
      });
    },
    setState(context, state) {
      plugin.send({
        event: 'setState',
        context,
        payload: { state }
      });
    },
    setSettings(context, payload) {
      plugin.send({ event: 'setSettings', context, payload });
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
    console.error('[timer]', error);
  });
  ws.on('close', () => {
    try {
      onClose?.();
    } catch (error) {
      console.error('[timer]', error);
    }
    process.exit(0);
  });
  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch (error) {
      console.error('[timer]', error);
      return;
    }
    recordEvent(data);
    const action = data.action?.split('.').pop();
    plugin[action]?.[data.event]?.(data);
  });
  return plugin;
}

class Actions {
  constructor(data) {
    this.data = {};
    this.default = {};
    Object.assign(this, data);
  }

  willAppear(data) {
    const settings = data.payload?.settings || {};
    this.data[data.context] = Object.assign({}, this.default, settings);
    this._willAppear?.(data);
  }

  willDisappear(data) {
    this._willDisappear?.(data);
  }

  didReceiveSettings(data) {
    if (this.data[data.context]) {
      this.data[data.context] = Object.assign({}, this.default, this.data[data.context], data.payload?.settings);
    }
    this._didReceiveSettings?.(data);
  }
}

module.exports = { createPlugin, Actions, readLaunchArgs };
