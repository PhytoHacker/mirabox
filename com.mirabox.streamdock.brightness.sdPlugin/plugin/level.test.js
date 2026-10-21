const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyTicks,
  averageBrightness,
  chooseMonitor,
  clampBrightness,
  nextMonitorId,
  normalizeStep
} = require('./level');
const { faceImage } = require('./face');

test('step falls back to 5', () => {
  assert.equal(normalizeStep(undefined), 5);
  assert.equal(normalizeStep('10'), 10);
  assert.equal(normalizeStep(3), 5);
});

test('ticks move brightness and stop at the edges', () => {
  assert.equal(applyTicks(40, 2, 5, 0, 100), 50);
  assert.equal(applyTicks(40, -1, 10, 0, 100), 30);
  assert.equal(applyTicks(98, 1, 5, 0, 100), 100);
  assert.equal(applyTicks(2, -1, 5, 0, 100), 0);
  assert.equal(applyTicks(null, 1, 5), null);
});

test('saved monitor wins, otherwise the primary external one', () => {
  const monitors = [
    { id: 'side', name: 'Q27G2G4', primary: false },
    { id: 'main', name: 'CQ27G4', primary: true }
  ];
  assert.equal(chooseMonitor(monitors, '').id, 'main');
  assert.equal(chooseMonitor(monitors, 'missing').id, 'main');
  assert.equal(chooseMonitor(monitors, 'side').id, 'side');
  assert.equal(chooseMonitor([], 'main'), null);
});

test('press walks every screen and then all of them', () => {
  const monitors = [
    { id: 'side', brightness: 40 },
    { id: 'main', brightness: 26 },
    { id: 'laptop', brightness: 100 }
  ];
  assert.equal(nextMonitorId(monitors, 'side'), 'main');
  assert.equal(nextMonitorId(monitors, 'main'), 'laptop');
  assert.equal(nextMonitorId(monitors, 'laptop'), 'all');
  assert.equal(nextMonitorId(monitors, 'all'), 'side');
  assert.equal(nextMonitorId(monitors, ''), 'side');
  assert.equal(nextMonitorId([], 'side'), null);
});

test('all mode shows the average brightness', () => {
  assert.equal(averageBrightness([
    { id: 'a', brightness: 40 },
    { id: 'b', brightness: 26 },
    { id: 'c', brightness: 100 }
  ]), 55);
  assert.equal(averageBrightness([]), null);
});

test('brightness stays inside the monitor range', () => {
  assert.equal(clampBrightness(140, 0, 100), 100);
  assert.equal(clampBrightness(-4, 0, 100), 0);
});

test('face shows the percent and keeps the monitor name as text', () => {
  const image = faceImage({
    status: 'ready',
    brightness: 45,
    min: 0,
    max: 100,
    name: 'CQ27G4'
  });
  assert.match(image, /45/);
  assert.match(image, /CQ27G4/);
  const escaped = decodeURIComponent(faceImage({
    status: 'ready',
    brightness: 10,
    min: 0,
    max: 100,
    name: 'A&B'
  }).split(',').slice(1).join(','));
  assert.match(escaped, /A&amp;B/);
  assert.doesNotMatch(escaped, />A&B</);
});
