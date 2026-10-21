const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'events.log');
const MAX_LINES = 150;
let lastAt = 0;
let lineCount = 0;

function recordEvent(data) {
  const now = Date.now();
  const gap = lastAt ? now - lastAt : 0;
  lastAt = now;
  const payload = data && data.payload ? data.payload : {};
  const line = [
    new Date(now).toISOString(),
    data.event || 'unknown',
    `gap=${gap}`,
    `ticks=${payload.ticks ?? ''}`,
    `pressed=${payload.pressed ?? ''}`,
    `controller=${payload.controller ?? ''}`
  ].join(' ');

  try {
    fs.appendFileSync(logPath, `${line}\n`);
    lineCount += 1;
    if (lineCount > MAX_LINES) trim();
  } catch (error) {
    console.error('[timer]', error);
  }
}

function trim() {
  const text = fs.readFileSync(logPath, 'utf8');
  const lines = text.trim().split(/\n/).slice(-MAX_LINES);
  fs.writeFileSync(logPath, `${lines.join('\n')}\n`);
  lineCount = lines.length;
}

module.exports = { recordEvent, logPath };
