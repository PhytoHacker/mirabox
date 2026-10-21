const $local = false;
const $back = false;
const $dom = {
  main: $('.sdpi-wrapper')
};

const stepInput = document.getElementById('stepSec');
const soundInput = document.getElementById('soundEnabled');
const allowedSteps = ['5', '15', '30', '60', '300'];

function applyForm(settings) {
  const step = String(settings?.stepSec ?? 60);
  stepInput.value = allowedSteps.includes(step) ? step : '60';
  soundInput.checked = settings?.soundEnabled !== false;
}

const $propEvent = {
  didReceiveSettings(payload) {
    applyForm(payload?.settings);
  },
  sendToPropertyInspector() {}
};

stepInput.addEventListener('change', () => {
  if (!$settings) return;
  $settings.stepSec = Number(stepInput.value);
});

soundInput.addEventListener('change', () => {
  if (!$settings) return;
  $settings.soundEnabled = soundInput.checked;
});
