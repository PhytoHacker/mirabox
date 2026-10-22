---
name: mirabox-n4
description: >-
  Собирает и дорабатывает плагины MiraBox Stream Dock N4 Pro в этом репозитории:
  папка com.mirabox.streamdock.*.sdPlugin, Node 20, клавиша и крутилка, панель
  настроек, русские подписи. Use when the user asks to create, add, or change a
  MiraBox, Stream Dock, N4 Pro, or .sdPlugin plugin, action, key, knob, dial,
  крутилка, клавиша, or property inspector.
---

# Плагины MiraBox N4 Pro

Плагин — папка `com.mirabox.streamdock.<slug>.sdPlugin` в корне репозитория. Хост запускает `plugin/index.js` на Node 20 и говорит с ним по WebSocket. Каркас файлов и контракт событий — в [reference.md](reference.md). Читать его, когда создаётся плагин или новое действие.

Образец клавиши — `com.mirabox.streamdock.happ.sdPlugin`. Образец крутилки с рисунком — `com.mirabox.streamdock.brightness.sdPlugin`. Несколько щелчков — `com.mirabox.streamdock.timer.sdPlugin/plugin/gesture.js`. Плагин задач показывает OAuth и растровый кадр; для нового плагина он слишком тяжёлый.

## Порядок

Пока неясно, что делают нажатие, поворот и панель, спросить. Затем:

1. Выбрать `slug` и `action` латиницей, в одно слово, без дефиса.
2. Решить контроллер: только крутилка или клавиша вместе с крутилкой.
3. Собрать дерево файлов из reference.md.
4. Поведение без сокета вынести в модуль и покрыть `node:test`.
5. Подключить события в `plugin/index.js`.
6. Панель добавить, только если есть настройки.
7. Заполнить `ru.json`, `en.json`, `zh_CN.json` и положить PNG 200×200 в `static/icon.png`.
8. В каталоге `plugin/` выполнить `npm install`, затем `npm test`.

Исходник остаётся в репозитории. Копию в каталог Stream Dock класть только по просьбе.

## Идентификаторы

Каталог: `com.mirabox.streamdock.<slug>.sdPlugin`.

UUID действия: `com.mirabox.streamdock.<slug>.<action>`.

Хост маршрутизирует событие так: `data.action.split('.').pop()`. Ключ на объекте плагина — этот последний сегмент и только он.

```js
plugin.monitor = new Actions({ /* ... */ });
```

Для UUID `com.mirabox.streamdock.brightness.monitor` ключ — `monitor`. Иначе событие уходит в пустоту.

## Манифест

Общие поля, как у текущих плагинов:

- `SDKVersion`: `1`
- `Author`: `Custom`
- `Category` и `CategoryIcon`: категория `МОИ`, иконка `static/icon.png`
- `CodePath` и `CodePathWin`: `plugin/index.js`
- `Nodejs.Version`: `"20"`
- `OS`: Windows 10
- `Software.MinimumVersion`: `3.10.188.226`
- `Version`: semver, новый плагин начинает с `1.0.0`

Имя, описание, подсказка и заголовок состояния в манифесте — по-русски. Значения по умолчанию лежат и в `Settings` манифеста, и в `default` у `Actions`.

`SupportedInMultiActions`: `true` для разового нажатия. `false`, если у действия своё состояние на экране.

`DisableAutomaticStates`: `true`, когда плагин сам вызывает `setState`. Индекс состояния совпадает с порядком в `States`.

`UserTitleEnabled`: `false`, когда текст уже нарисован на кадре.

## Ввод N4 Pro

Контроллеры только `Keypad` и `Knob`.

- Только крутилка: `"Controllers": ["Knob"]`, как яркость и таймер.
- Клавиша, которую можно поставить и на крутилку: `"Controllers": ["Keypad", "Knob"]`.

Входящие события:

- клавиша: `keyDown`, `keyUp`, `touchTap`
- крутилка: `dialDown`, `dialUp`, `dialRotate`
- жизнь действия: `willAppear`, `willDisappear`, `didReceiveSettings`
- панель: `sendToPlugin`, `propertyInspectorDidAppear`

У `dialRotate` в `payload` приходят `ticks` (целое, знак — направление) и `pressed` (крутилка зажата во время поворота). Если нажатие — отдельная команда, поворот с `pressed` не меняет значение.

Длительности удержания нет: приходит только `dialDown`. Жест «подержать» не закладывать. Серию щелчков считать таймером, как в `gesture.js` таймера.

`keyDown`, `dialDown` и `touchTap` на одном действии часто приходят вместе. Повтор короче 200–400 мс отбрасывать. Одно и то же нажатие обрабатывать во всех трёх, если действие стоит и на клавише, и на крутилке.

Один `context` — одна сессия. Создавать её в `willAppear`, удалять в `willDisappear`.

## Кадр

Статическая картинка — PNG 200×200 в `static/`. Живой кадр — SVG data URI 200×200, как `face.js` яркости: экранировать текст и пропускать разметку через `encodeURIComponent`. Одинаковый кадр повторно не слать.

Если текст внутри рисунка, `setTitle` отправляет пустую строку. Заголовок хоста иначе спорит с рисунком.

`@napi-rs/canvas` подключать только для анимации или шрифта, который SVG не тянет.

Разовой команде после успеха слать `showOk`. Ошибке — `showAlert`. Действию, которое само меняет кадр, достаточно нового кадра.

## Код

`plugin/connection.js` — сокет, очередь до `open`, регистрация `{ uuid, event }`, методы исходящих событий и класс `Actions`. Префикс логов — `[<slug>]`.

`plugin/index.js` вешает действия на `plugin.<action>` и держит сессии. Туда же очистка в `onClose`, `uncaughtException` и `unhandledRejection`.

Ветвления, разбор настроек и расчёт кадра — в отдельном модуле без `ws`. Рядом файл `*.test.js` на `node:test` и `node:assert/strict`. В `package.json` плагина: `"private": true`, зависимость `ws`, скрипт `"test": "node --test *.test.js"`.

`node_modules/` и `*.log` уже в `.gitignore`. Их не коммитить.

Комментарии в коде — по-русски и только там, где устройство или хост ведут себя неочевидно.

## Панель настроек

Своя тёмная страница `propertyInspector/<slug>/index.html` и `index.js`. Вход, который зовёт хост, — глобальная `connectElgatoStreamDeckSocket(port, uuid, event)`, как у яркости.

При открытии сокета: регистрация `{ event, uuid }`, затем `getSettings`. Если плагин должен прислать живые данные, следом `sendToPlugin` с полным UUID действия. `didReceiveSettings` заполняет форму. Пока идёт это заполнение, обратный `setSettings` не слать: нужен флаг гидрации. `setSettings` уносит весь объект настроек.

Общий helper таймера `propertyInspector/utils/action.js` для новых панелей не использовать.

Ответы плагина приходят событием `sendToPropertyInspector`. Свежие данные имеет смысл слать и из `propertyInspectorDidAppear`.

Фон панели `#2d2d2d`, текст `#d8d8d8`, шрифт `Segoe UI`. Подписи на панели — по-русски.

## Локализация

Рядом с манифестом три файла: `ru.json`, `en.json`, `zh_CN.json`. В каждом — `Name`, `Description`, `Category`, пустой `Localization` и по действию полный UUID с `Name` и `Tooltip`. `Category` во всех трёх остаётся `МОИ`.

## Данные вне клавиши

Секреты и токены в репозиторий не класть. В `Settings` манифеста для них пустые строки. То, что должно пережить перезапуск отдельно от настроек клавиши, писать в `%APPDATA%/HotSpot/StreamDock/data/`.
