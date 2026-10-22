const fs = require('fs');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const SCALE = 3;
const SIZE = 120 * SCALE;
const FRAME_COUNT = 42;
const FRAME_MS = 40;

let fontReady = false;
const cache = new Map();

function useFont() {
  if (fontReady) return;
  const bold = ['C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/seguisb.ttf', 'C:/Windows/Fonts/segoeui.ttf'].find((item) => fs.existsSync(item));
  const text = ['C:/Windows/Fonts/seguisb.ttf', 'C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/segoeui.ttf'].find((item) => fs.existsSync(item));
  if (bold) GlobalFonts.registerFromPath(bold, 'TasksBold');
  if (text) GlobalFonts.registerFromPath(text, 'TasksNum');
  fontReady = true;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smooth(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function easeOutBack(value) {
  const t = clamp01(value);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function mulberry32(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20261022);
const DUST = Array.from({ length: 78 }, () => ({
  angle: random() * Math.PI * 2,
    speed: 26 + random() * 48,
  size: 0.7 + random() * 2.5,
  color: ['#FFFBE8', '#FFE7A3', '#FFD15C', '#F0A202', '#FFFFFF'][Math.floor(random() * 5)],
  delay: random() * 0.14,
  fall: 3 + random() * 16
}));
const CHUNKS = Array.from({ length: 7 }, (_, index) => ({
  angle: -Math.PI / 2 + (index / 7) * Math.PI * 2 + 0.2,
  speed: 11 + (index % 3) * 5,
  spin: (index % 2 === 0 ? 1 : -1) * (1.2 + index * 0.15),
  size: 3.4 + (index % 2)
}));

function pill(ctx, x, y, width, height) {
  const radius = height / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawBadge(ctx) {
  ctx.save();
  ctx.scale(SCALE, SCALE);
  pill(ctx, 12.5, 27.5, 95, 78);
  ctx.fillStyle = '#BBE2FE';
  ctx.fill();
  const gradient = ctx.createLinearGradient(60, 12.5, 60, 100);
  gradient.addColorStop(0, '#3186FF');
  gradient.addColorStop(0.446176, '#3186FF');
  gradient.addColorStop(1, '#949DFF');
  pill(ctx, 10, 12.5, 100, 87.5);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

function drawCheck(ctx, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.scale(SCALE, SCALE);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(40, 57.5);
  ctx.lineTo(51.0488, 69.5533);
  ctx.bezierCurveTo(52.5119, 71.1494, 55.0189, 71.1783, 56.5184, 69.6163);
  ctx.lineTo(83.75, 41.25);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function starPath(ctx, cx, cy, outer, inner) {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + point * Math.PI / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (point === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawStar(ctx, scale, alpha) {
  if (scale <= 0.02 || alpha <= 0) return;
  ctx.save();
  ctx.translate(60 * SCALE, 55 * SCALE);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  starPath(ctx, 0, 0, 20 * SCALE, 8.2 * SCALE);
  ctx.fillStyle = '#FFD45A';
  ctx.strokeStyle = '#FFF8DC';
  ctx.lineWidth = 2.2 * SCALE;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
  starPath(ctx, 0, 0, 8 * SCALE, 3.2 * SCALE);
  ctx.fillStyle = '#FFF8E4';
  ctx.fill();
  ctx.restore();
}

function drawDust(ctx, progress) {
  if (progress <= 0) return;
  const originX = 60;
  const originY = 55;
  ctx.save();
  ctx.scale(SCALE, SCALE);
  for (const speck of DUST) {
    const life = clamp01((progress - speck.delay) / (1 - speck.delay));
    if (life <= 0) continue;
    const distance = speck.speed * life ** 0.78;
    const x = originX + Math.cos(speck.angle) * distance;
    const y = originY + Math.sin(speck.angle) * distance + life * life * speck.fall;
    const alpha = Math.max(0, 1 - life * 1.12);
    const radius = speck.size * (1 - life * 0.55);
    ctx.globalAlpha = alpha * 0.38;
    ctx.fillStyle = speck.color;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const chunk of CHUNKS) {
    const life = clamp01(progress / 0.92);
    const distance = chunk.speed * life ** 0.7;
    const x = originX + Math.cos(chunk.angle) * distance;
    const y = originY + Math.sin(chunk.angle) * distance + life * life * 8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(chunk.angle + life * chunk.spin);
    ctx.globalAlpha = Math.max(0, 1 - life * 1.2);
    starPath(ctx, 0, 0, chunk.size, chunk.size * 0.42);
    ctx.fillStyle = '#FFE08A';
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawNumber(ctx, text) {
  useFont();
  const size = text.length <= 1 ? 52 : text.length === 2 ? 44 : text.length === 3 ? 34 : 26;
  ctx.save();
  ctx.scale(SCALE, SCALE);
  ctx.font = `${size}px TasksBold`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 60, 54);
  ctx.restore();
}

function drawCaption(ctx, caption) {
  useFont();
  ctx.save();
  ctx.scale(SCALE, SCALE);
  ctx.font = '13px TasksNum';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  let text = caption;
  const max = 88;
  if (ctx.measureText(text).width > max) {
    while (text.length > 1 && ctx.measureText(`${text.trimEnd()}…`).width > max) text = text.slice(0, -1);
    text = `${text.trimEnd()}…`;
  }
  ctx.fillText(text, 60, 83);
  ctx.restore();
}

function pose(frame) {
  const t = frame / (FRAME_COUNT - 1);
  let starScale = easeOutBack(t / 0.18);
  let starAlpha = 1;
  if (t > 0.34) {
    const out = smooth((t - 0.34) / 0.1);
    starScale *= 1 - out;
    starAlpha = 1 - out;
  }
  return {
    starScale: Math.max(0, starScale),
    starAlpha: Math.max(0, starAlpha),
    burst: t < 0.32 ? 0 : smooth((t - 0.32) / 0.5),
    check: t < 0.42 ? 0 : smooth((t - 0.42) / 0.28)
  };
}

function drawSpec(ctx, spec) {
  drawBadge(ctx);
  const caption = typeof spec.caption === 'string' ? spec.caption : '';
  if (spec.done) drawCheck(ctx, 1);
  else if (spec.burst != null) {
    const frame = pose(spec.burst);
    drawCheck(ctx, frame.check);
    drawStar(ctx, frame.starScale, frame.starAlpha);
    drawDust(ctx, frame.burst);
  } else if (spec.text) drawNumber(ctx, spec.text);
  if (caption) drawCaption(ctx, caption);
}

function png(spec) {
  const key = JSON.stringify(spec);
  if (!cache.has(key)) {
    const canvas = createCanvas(SIZE, SIZE);
    drawSpec(canvas.getContext('2d'), spec);
    cache.set(key, canvas.toBuffer('image/png'));
  }
  return cache.get(key);
}

function image(spec) {
  return `data:image/png;base64,${png(spec).toString('base64')}`;
}

module.exports = {
  FRAME_COUNT,
  FRAME_MS,
  SIZE,
  pose,
  png,
  image
};
