const fs = require('fs');
const { PNG } = require('pngjs');

function parseHex(color) {
  return {
    r: parseInt(color.slice(1, 3), 16),
    g: parseInt(color.slice(3, 5), 16),
    b: parseInt(color.slice(5, 7), 16)
  };
}

function tintPng(buffer, color) {
  const png = PNG.sync.read(buffer);
  const { r, g, b } = parseHex(color);
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] === 0) continue;
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`;
}

function createTintCache(file) {
  const source = fs.readFileSync(file);
  const cache = new Map();
  return (color) => {
    const key = color.toLowerCase();
    if (!cache.has(key)) cache.set(key, tintPng(source, key));
    return cache.get(key);
  };
}

module.exports = { tintPng, createTintCache, parseHex };
