const test = require('node:test');
const assert = require('node:assert/strict');
const { countOpen, selectedCount } = require('./count');

test('open tasks skip completed, deleted and hidden', () => {
  const tasks = [
    { status: 'needsAction', title: 'купить' },
    { status: 'completed', title: 'готово' },
    { status: 'needsAction', deleted: true, title: 'удалено' },
    { status: 'needsAction', hidden: true, title: 'скрыто' },
    { status: 'needsAction', title: 'подзадача' },
    null
  ];
  assert.equal(countOpen(tasks), 2);
  assert.equal(countOpen(null), 0);
});

test('selected list falls back only for the whole account', () => {
  const snapshot = { total: 5, counts: { home: 2, work: 3 } };
  assert.equal(selectedCount(snapshot, ''), 5);
  assert.equal(selectedCount(snapshot, 'work'), 3);
  assert.equal(selectedCount(snapshot, 'missing'), null);
  assert.equal(selectedCount({ total: null, counts: {} }, ''), null);
});
