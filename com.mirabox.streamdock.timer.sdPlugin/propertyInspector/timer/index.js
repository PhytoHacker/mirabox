const $local = false;
const $back = false;
const $dom = {
  main: $('.sdpi-wrapper')
};

const stepInput = document.getElementById('stepSec');
const soundInput = document.getElementById('soundEnabled');
const soundName = document.getElementById('soundFileName');
const themeInput = document.getElementById('theme');
const accentInput = document.getElementById('accent');
const digitInput = document.getElementById('digitColor');
const backgroundInput = document.getElementById('background');
const statusInput = document.getElementById('showStatus');
const customColors = document.getElementById('customColors');
const allowedSteps = ['5', '15', '30', '60', '300'];
const themes = ['neon', 'amber', 'ice', 'blood', 'custom'];

function fileFromPicker(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== 'string') return '';
  let file = raw;
  if (file.startsWith('file://')) {
    file = decodeURIComponent(file.replace(/^file:\/\//, ''));
    if (/^\/[A-Za-z]:/.test(file)) file = file.slice(1);
  }
  return file;
}

function fileLabel(file) {
  if (!file) return 'Колокол';
  const parts = file.split(/[\\/]/);
  return parts[parts.length - 1] || 'Колокол';
}

function applyForm(settings) {
  const step = String(settings?.stepSec ?? 60);
  stepInput.value = allowedSteps.includes(step) ? step : '60';
  soundInput.checked = settings?.soundEnabled !== false;
  soundName.textContent = fileLabel(settings?.soundFile);
  themeInput.value = themes.includes(settings?.theme) ? settings.theme : 'neon';
  accentInput.value = settings?.accent || '#3ddc97';
  digitInput.value = settings?.digitColor || '#f4f7fb';
  backgroundInput.value = settings?.background || '#070b10';
  statusInput.checked = settings?.showStatus !== false;
  customColors.style.display = themeInput.value === 'custom' ? '' : 'none';
}

const $propEvent = {
  didReceiveSettings(payload) {
    applyForm(payload?.settings);
  },
  sendToPropertyInspector() {}
};

$emit.on('File-soundFile', (value) => {
  const file = fileFromPicker(value);
  if (!$settings || !file) return;
  $settings.soundFile = file;
  soundName.textContent = fileLabel(file);
});

stepInput.addEventListener('change', () => {
  if (!$settings) return;
  $settings.stepSec = Number(stepInput.value);
});

soundInput.addEventListener('change', () => {
  if (!$settings) return;
  $settings.soundEnabled = soundInput.checked;
});

themeInput.addEventListener('change', () => {
  if (!$settings) return;
  $settings.theme = themeInput.value;
  customColors.style.display = themeInput.value === 'custom' ? '' : 'none';
});

accentInput.addEventListener('input', () => {
  if (!$settings) return;
  $settings.accent = accentInput.value;
});

digitInput.addEventListener('input', () => {
  if (!$settings) return;
  $settings.digitColor = digitInput.value;
});

backgroundInput.addEventListener('input', () => {
  if (!$settings) return;
  $settings.background = backgroundInput.value;
});

statusInput.addEventListener('change', () => {
  if (!$settings) return;
  $settings.showStatus = statusInput.checked;
});

document.getElementById('soundDefault').addEventListener('click', () => {
  if (!$settings) return;
  $settings.soundFile = '';
  soundName.textContent = 'Колокол';
});

document.getElementById('soundPreview').addEventListener('click', () => {
  if (!$websocket) return;
  $websocket.sendToPlugin({ command: 'previewSound' });
});
