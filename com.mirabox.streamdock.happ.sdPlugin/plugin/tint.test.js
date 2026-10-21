const test = require('node:test');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');
const { tintPng } = require('./tint');

test('перекраска сохраняет прозрачность и меняет цвет знака', () => {
  const png = new PNG({ width: 1, height: 2 });
  png.data[0] = 255;
  png.data[1] = 255;
  png.data[2] = 255;
  png.data[3] = 200;
  png.data[4] = 0;
  png.data[5] = 0;
  png.data[6] = 0;
  png.data[7] = 0;
  const tinted = PNG.sync.read(Buffer.from(tintPng(PNG.sync.write(png), '#112233').split(',')[1], 'base64'));
  assert.deepEqual([...tinted.data], [0x11, 0x22, 0x33, 200, 0, 0, 0, 0]);
});
