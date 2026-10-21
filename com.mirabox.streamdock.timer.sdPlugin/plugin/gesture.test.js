const test = require('node:test');
const assert = require('node:assert/strict');
const { createGesture } = require('./gesture');

function harness() {
  const calls = [];
  const timers = new Map();
  let nextId = 1;
  const gesture = createGesture({
    confirmMs: 400,
    windowMs: 900,
    onToggle: (id) => calls.push(['toggle', id]),
    onReset: (id) => calls.push(['reset', id]),
    setTimer: (fn) => {
      const id = nextId++;
      timers.set(id, fn);
      return id;
    },
    clearTimer: (id) => timers.delete(id)
  });
  return {
    calls,
    gesture,
    fire(id) {
      const fn = timers.get(id);
      timers.delete(id);
      fn?.();
    },
    fireAll() {
      for (const fn of [...timers.values()]) fn();
      timers.clear();
    }
  };
}

test('one click toggles once after the confirm delay', () => {
  const h = harness();
  h.gesture.press('k', 1000);
  assert.deepEqual(h.calls, []);
  h.fireAll();
  assert.deepEqual(h.calls, [['toggle', 'k']]);
});

test('a repeat 200ms later still toggles only once', () => {
  const h = harness();
  h.gesture.press('k', 1000);
  h.gesture.press('k', 1200);
  h.fireAll();
  assert.deepEqual(h.calls, [['toggle', 'k']]);
});

test('three events in the window reset and do not toggle', () => {
  const h = harness();
  h.gesture.press('k', 1000);
  h.gesture.press('k', 1200);
  h.gesture.press('k', 1400);
  h.fireAll();
  assert.deepEqual(h.calls, [['reset', 'k']]);
});

test('events after the reset in the same window do nothing', () => {
  const h = harness();
  h.gesture.press('k', 1000);
  h.gesture.press('k', 1200);
  h.gesture.press('k', 1400);
  h.gesture.press('k', 1600);
  h.fireAll();
  assert.deepEqual(h.calls, [['reset', 'k']]);
});

test('a click after the window toggles on its own', () => {
  const h = harness();
  h.gesture.press('k', 1000);
  h.fireAll();
  h.gesture.press('k', 2000);
  h.fireAll();
  assert.deepEqual(h.calls, [
    ['toggle', 'k'],
    ['toggle', 'k']
  ]);
});
