const test = require('node:test');
const assert = require('node:assert/strict');
const { FRAME_COUNT, pose, png } = require('./face');

test('numbers are drawn as different pngs', () => {
  const one = png({ text: '4' });
  const two = png({ text: '12' });
  assert.equal(one.readUInt32BE(0), 0x89504e47);
  assert.notEqual(one.equals(two), true);
  assert.notEqual(png({ bare: true }).equals(one), true);
  assert.notEqual(png({ text: '4', caption: 'Дом' }).equals(one), true);
});

test('the celebration ends on the check and starts with a star', () => {
  const start = pose(0);
  const middle = pose(Math.round(FRAME_COUNT * 0.55));
  const end = pose(FRAME_COUNT - 1);
  assert.equal(start.burst, 0);
  assert.ok(start.starScale > 0 || pose(2).starScale > 0.4);
  assert.ok(middle.burst > 0);
  assert.ok(middle.check > 0);
  assert.equal(end.starAlpha, 0);
  assert.ok(end.check > 0.99);
  assert.notEqual(png({ burst: 4 }).equals(png({ done: true })), true);
  assert.notEqual(png({ burst: 4 }).equals(png({ burst: 28 })), true);
});
