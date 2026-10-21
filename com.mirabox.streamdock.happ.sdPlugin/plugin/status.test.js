const test = require('node:test');
const assert = require('node:assert/strict');
const { appearance, readConnected, readToggleSettings } = require('./status');

test('вид кнопки совпадает с состоянием туннеля', () => {
  assert.deepEqual(appearance(false), { state: 0, title: 'ВЫКЛ', color: '#4e4e4e', plain: false });
  assert.deepEqual(appearance(true), { state: 1, title: 'ВКЛ', color: '#ffffff', plain: false });
});

test('подпись под знаком можно скрыть, кривой цвет отбрасывается', () => {
  const settings = readToggleSettings({
    showCaption: false,
    colorOn: '#11Aa22',
    colorOff: 'синий'
  });
  assert.equal(settings.showCaption, false);
  assert.equal(settings.colorOn, '#11aa22');
  assert.equal(settings.colorOff, '#4e4e4e');
  assert.equal(appearance(true, settings).title, '');
  assert.equal(appearance(true, settings).plain, true);
});

test('туннель считается включённым, если открыт порт статистики или socks', async () => {
  const probe = async (port) => port === 11111;
  assert.equal(await readConnected(probe), true);
  const socksOnly = async (port) => port === 10808;
  assert.equal(await readConnected(socksOnly), true);
  assert.equal(await readConnected(async () => false), false);
});
