# Каркас плагина N4 Pro

Заменить `<slug>` и `<action>`. Последний сегмент UUID и ключ `plugin.<action>` совпадают. `<action>` — одно слово латиницей.

```
com.mirabox.streamdock.<slug>.sdPlugin/
  manifest.json
  ru.json
  en.json
  zh_CN.json
  static/icon.png
  plugin/package.json
  plugin/connection.js
  plugin/index.js
  plugin/<logic>.js
  plugin/<logic>.test.js
  propertyInspector/<slug>/index.html
  propertyInspector/<slug>/index.js
```

`static/icon.png` — PNG 200×200. Панель не создавать, если настроек нет.

## manifest.json

```json
{
  "Actions": [
    {
      "Icon": "static/icon.png",
      "Name": "Имя действия",
      "States": [
        {
          "Image": "static/icon.png",
          "TitleAlignment": "middle",
          "FontSize": "16",
          "FontStyle": "Bold",
          "Title": ""
        }
      ],
      "Settings": {},
      "Controllers": ["Knob"],
      "UserTitleEnabled": false,
      "SupportedInMultiActions": false,
      "Tooltip": "Что делают нажатие и поворот",
      "UUID": "com.mirabox.streamdock.<slug>.<action>",
      "PropertyInspectorPath": "propertyInspector/<slug>/index.html"
    }
  ],
  "SDKVersion": 1,
  "Author": "Custom",
  "Name": "Имя плагина",
  "Icon": "static/icon.png",
  "CodePath": "plugin/index.js",
  "CodePathWin": "plugin/index.js",
  "Description": "Одно предложение, что делает плагин",
  "Category": "МОИ",
  "CategoryIcon": "static/icon.png",
  "Version": "1.0.0",
  "OS": [
    { "Platform": "windows", "MinimumVersion": "10" }
  ],
  "Software": { "MinimumVersion": "3.10.188.226" },
  "Nodejs": { "Version": "20" }
}
```

Клавиша вместе с крутилкой: `"Controllers": ["Keypad", "Knob"]`. Свой `setState`: `"DisableAutomaticStates": true` и по одному объекту в `States` на каждое состояние. Без панели поле `PropertyInspectorPath` убрать.

## Локализация

`ru.json`, `en.json` и `zh_CN.json` одной формы. `Category` везде `МОИ`.

```json
{
  "Name": "Имя плагина",
  "Description": "Одно предложение, что делает плагин",
  "Category": "МОИ",
  "com.mirabox.streamdock.<slug>.<action>": {
    "Name": "Имя действия",
    "Tooltip": "Что делают нажатие и поворот"
  },
  "Localization": {}
}
```

## plugin/package.json

```json
{
  "name": "streamdock-<slug>",
  "version": "1.0.0",
  "private": true,
  "main": "index.js",
  "scripts": {
    "test": "node --test *.test.js"
  },
  "dependencies": {
    "ws": "^8.18.3"
  }
}
```

После создания файла выполнить `npm install` в `plugin/`.

## plugin/connection.js

Аргументы запуска: `-port`, `-pluginUUID`, `-registerEvent`. Если флагов нет, хост кладёт их в `argv[3]`, `argv[5]`, `argv[7]`.

```js
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

function createPlugin({ onClose } = {}) {
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
    setImage(context, image) {
      plugin.send({ event: 'setImage', context, payload: { image, target: 0 } });
    },
    setTitle(context, title) {
      plugin.send({
        event: 'setTitle',
        context,
        payload: { title: String(title), target: 0 }
      });
    },
    setState(context, state) {
      plugin.send({ event: 'setState', context, payload: { state } });
    },
    setSettings(context, payload) {
      plugin.send({ event: 'setSettings', context, payload });
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
    console.error('[<slug>]', error);
  });
  ws.on('close', () => {
    try {
      onClose?.();
    } catch (error) {
      console.error('[<slug>]', error);
    }
    process.exit(0);
  });
  ws.on('message', (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch (error) {
      console.error('[<slug>]', error);
      return;
    }
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
    delete this.data[data.context];
    this._willDisappear?.(data);
  }

  didReceiveSettings(data) {
    if (this.data[data.context]) {
      this.data[data.context] = Object.assign(
        {},
        this.default,
        this.data[data.context],
        data.payload?.settings
      );
    }
    this._didReceiveSettings?.(data);
  }
}

module.exports = { createPlugin, Actions, readLaunchArgs };
```

Свои `willAppear`, `willDisappear` и `didReceiveSettings` в объект действия не класть: `Object.assign` затрёт методы базового класса. Настройки и сессию принимать в `_willAppear`, `_willDisappear` и `_didReceiveSettings`.

## plugin/index.js

```js
const { createPlugin, Actions } = require('./connection');

const sessions = new Map();
const plugin = createPlugin();

plugin.<action> = new Actions({
  default: {},
  _willAppear(data) {
    sessions.set(data.context, { /* session */ });
  },
  _willDisappear(data) {
    sessions.delete(data.context);
  },
  _didReceiveSettings(data) {},
  keyDown({ context }) {},
  dialDown({ context }) {},
  touchTap({ context }) {},
  dialRotate({ context, payload }) {
    const ticks = Number(payload?.ticks) || 0;
    // pressed — крутилка зажата. Пропускать, когда нажатие само по себе команда.
    if (payload?.pressed) return;
    // ticks — на сколько шагов повернули, знак задаёт направление
  },
  sendToPlugin({ context, payload }) {},
  propertyInspectorDidAppear({ context }) {}
});

process.on('uncaughtException', (error) => {
  console.error('[<slug>]', error);
});
process.on('unhandledRejection', (error) => {
  console.error('[<slug>]', error);
});
```

## Тест

Рядом с модулем логики, без сокета:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize } = require('./logic');

test('пустая настройка получает значение по умолчанию', () => {
  assert.equal(normalize(undefined), 0);
});
```

Запуск из каталога `plugin/`: `npm test`.

## Кадр SVG

Корневой элемент 200×200. Возвращать строку:

```js
`data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`
```

Текст внутри SVG экранировать: `& < > " '`.

## Панель

`propertyInspector/<slug>/index.html` подключает `index.js` в конце `body`. Фон `#2d2d2d`, цвет `#d8d8d8`, шрифт `13px/1.45 "Segoe UI", sans-serif`, поле на всю ширину, фон поля `#3d3d3d`, рамка `#555`.

`index.js`:

```js
let socket = null;
let context = '';
let hydrating = false;
let settings = {};

function save() {
  if (hydrating || !socket) return;
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
      action: 'com.mirabox.streamdock.<slug>.<action>',
      context: uuid,
      payload: { command: 'refresh' }
    }));
  };
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    hydrating = true;
    if (data.event === 'didReceiveSettings') {
      settings = Object.assign({}, settings, data.payload?.settings);
    }
    if (data.event === 'sendToPropertyInspector') {
      // разобрать data.payload
    }
    hydrating = false;
  };
}
```

`connectElgatoStreamDeckSocket` остаётся глобальной функцией страницы. Хост вызывает её сам.

## События

Входящие, их принимает метод с тем же именем:

| Событие | Что внутри |
| --- | --- |
| `willAppear` | `context`, `action`, `payload.settings`, `payload.state` |
| `willDisappear` | `context` |
| `didReceiveSettings` | `context`, `payload.settings` |
| `keyDown`, `keyUp`, `touchTap` | `context` |
| `dialDown`, `dialUp` | `context` |
| `dialRotate` | `context`, `payload.ticks`, `payload.pressed` |
| `sendToPlugin` | `context`, `payload` с панели |
| `propertyInspectorDidAppear` | `context` |

Исходящие, их шлёт `connection.js`:

| Событие | Полезная нагрузка |
| --- | --- |
| `setImage` | `payload.image` — data URI или путь, `payload.target` — `0` |
| `setTitle` | `payload.title`, `payload.target` — `0` |
| `setState` | `payload.state` — индекс в `States` |
| `setSettings` | объект настроек целиком |
| `sendToPropertyInspector` | произвольный `payload` |
| `showOk`, `showAlert` | только `context` |
| `logMessage` | `payload.message` |

Регистрация плагина и панели — одно сообщение `{ uuid, event }` сразу после открытия сокета. До открытия исходящие сообщения держать в очереди.
