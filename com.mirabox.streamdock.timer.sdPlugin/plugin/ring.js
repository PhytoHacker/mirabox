function ticks(style) {
  const marks = [];
  for (let index = 0; index < 60; index += 1) {
    const major = index % 5 === 0;
    const angle = (index / 60) * Math.PI * 2 - Math.PI / 2;
    const inner = major ? 72 : 77;
    const outer = 84;
    const x1 = 100 + Math.cos(angle) * inner;
    const y1 = 100 + Math.sin(angle) * inner;
    const x2 = 100 + Math.cos(angle) * outer;
    const y2 = 100 + Math.sin(angle) * outer;
    marks.push(
      `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${major ? style.tickMajor : style.tick}" stroke-width="${major ? 2.2 : 1}" stroke-linecap="round"/>`
    );
  }
  return marks.join('');
}

function faceImage({ percent, time, label, status, pulse, style }) {
  const alarming = status === 'alarm';
  const glow = alarming ? Math.max(0, Math.min(1, Number(pulse) || 0)) : 1;
  const portion = alarming ? 1 : Math.max(0, Math.min(1, Number(percent) || 0));
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const length = circumference.toFixed(3);
  const offset = (circumference * (1 - portion)).toFixed(3);
  const arc = alarming ? '#ff3148' : (style[status] || style.running);
  const digits = style.digits;
  const digitOpacity = '1';
  const halo = alarming ? (0.08 + glow * 0.5).toFixed(3) : '0.28';
  const ring = alarming ? (0.34 + glow * 0.66).toFixed(3) : '1';
  const timeSize = String(time).length > 5 ? 34 : 46;
  const timeY = style.showStatus ? 98 : 112;
  const tracking = String(label || '').length > 5 ? 0.3 : 1.2;
  const statusMark = style.showStatus
    ? `<circle cx="72" cy="138" r="4" fill="${arc}"/><text x="106" y="144" text-anchor="middle" fill="${style.digits}" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="${tracking}">${label}</text>`
    : '';
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">',
    '<defs>',
    `<radialGradient id="core" cx="50%" cy="42%" r="62%">`,
    `<stop offset="0%" stop-color="${style.tickMajor}" stop-opacity="0.22"/>`,
    `<stop offset="100%" stop-color="${style.background}" stop-opacity="0"/>`,
    '</radialGradient>',
    '</defs>',
    `<circle cx="100" cy="100" r="100" fill="${style.background}"/>`,
    '<circle cx="100" cy="100" r="74" fill="url(#core)"/>',
    ticks(style),
    `<circle cx="100" cy="100" r="${radius}" fill="none" stroke="${style.track}" stroke-width="12"/>`,
    `<circle cx="100" cy="100" r="${radius}" fill="none" stroke="${arc}" stroke-opacity="${halo}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${length} ${length}" stroke-dashoffset="${offset}" transform="rotate(-90 100 100)"/>`,
    `<circle cx="100" cy="100" r="${radius}" fill="none" stroke="${arc}" stroke-opacity="${ring}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${length} ${length}" stroke-dashoffset="${offset}" transform="rotate(-90 100 100)"/>`,
    `<text x="100" y="${timeY}" text-anchor="middle" fill="${digits}" fill-opacity="${digitOpacity}" font-family="Segoe UI, Arial, sans-serif" font-size="${timeSize}" font-weight="700">${time}</text>`,
    statusMark,
    '</svg>'
  ].join('');
  return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}

module.exports = { faceImage };
