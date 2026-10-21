function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  }[char]));
}

function faceImage(session) {
  const ready = session.status === 'ready' && session.brightness != null;
  const min = Number(session.min) || 0;
  const max = Number.isFinite(Number(session.max)) ? Number(session.max) : 100;
  const span = Math.max(1, max - min);
  const portion = ready ? Math.max(0, Math.min(1, (Number(session.brightness) - min) / span)) : 0;
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const length = circumference.toFixed(3);
  const offset = (circumference * (1 - portion)).toFixed(3);
  const number = ready ? String(session.brightness) : '—';
  const label = session.status === 'missing'
    ? 'НЕТ ЭКРАНА'
    : session.status === 'error'
      ? 'НЕТ СВЯЗИ'
      : (session.name || '');
  const arc = ready ? '#ffb347' : '#8d97a5';
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">',
    '<circle cx="100" cy="100" r="100" fill="#070b10"/>',
    `<circle cx="100" cy="100" r="${radius}" fill="none" stroke="#1c2836" stroke-width="12"/>`,
    `<circle cx="100" cy="100" r="${radius}" fill="none" stroke="${arc}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${length} ${length}" stroke-dashoffset="${offset}" transform="rotate(-90 100 100)"/>`,
    `<text x="100" y="108" text-anchor="middle" fill="#f4f7fb" font-family="Segoe UI, Arial, sans-serif" font-size="58" font-weight="700">${escapeXml(number)}</text>`,
    `<text x="100" y="150" text-anchor="middle" fill="#c5d0dc" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700">${escapeXml(label)}</text>`,
    '</svg>'
  ].join('');
  return `data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}`;
}

module.exports = { faceImage };
