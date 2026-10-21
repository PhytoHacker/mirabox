const test = require('node:test');
const assert = require('node:assert/strict');
const { COMMANDS } = require('./commands');

test('кнопки покрывают команды Happ без параметров', () => {
  assert.deepEqual(COMMANDS, {
    connect: 'happ://connect',
    disconnect: 'happ://disconnect',
    toggle: 'happ://toggle',
    open: 'happ://open',
    close: 'happ://close',
    routing: 'happ://routing/off'
  });
});
