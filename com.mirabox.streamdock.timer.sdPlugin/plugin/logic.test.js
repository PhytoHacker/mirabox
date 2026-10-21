const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_SEC,
  STATUS,
  formatTime,
  formatTitle,
  createSession,
  restoreSession,
  reduce
} = require('./logic');

function idle(seconds = 300) {
  return createSession({ durationSec: seconds, stepSec: 60, soundEnabled: true });
}

test('formatTime uses minutes under an hour and hours after', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(65), '01:05');
  assert.equal(formatTime(3600), '1:00:00');
  assert.equal(formatTime(3661), '1:01:01');
});

test('clockwise rotation adds the step, counterclockwise subtracts', () => {
  const up = reduce(idle(60), { type: 'rotate', ticks: 1 }, 1000);
  assert.equal(up.session.durationSec, 120);
  assert.equal(up.session.remainingMs, 120000);
  assert.equal(up.session.status, STATUS.IDLE);

  const down = reduce(up.session, { type: 'rotate', ticks: -2 }, 2000);
  assert.equal(down.session.durationSec, 0);
});

test('fast rotation uses a larger step and the value stays within six hours', () => {
  const session = { ...idle(0), lastRotateAt: 1000 };
  const next = reduce(session, { type: 'rotate', ticks: 1 }, 1040);
  assert.equal(next.session.durationSec, 240);

  const capped = reduce(idle(MAX_SEC - 30), { type: 'rotate', ticks: 5 }, 5000);
  assert.equal(capped.session.durationSec, MAX_SEC);
});

test('rotation is ignored while the countdown is running', () => {
  const running = reduce(idle(60), { type: 'short' }, 1000).session;
  const spun = reduce(running, { type: 'rotate', ticks: 3 }, 1100);
  assert.equal(spun.session, running);
  assert.deepEqual(spun.effects, []);
});

test('press starts, the next press pauses, the next press continues', () => {
  const started = reduce(idle(60), { type: 'short' }, 1000);
  assert.equal(started.session.status, STATUS.RUNNING);
  assert.equal(started.session.endsAt, 61000);
  assert.ok(started.effects.includes('watch'));

  const paused = reduce(started.session, { type: 'short' }, 5000);
  assert.equal(paused.session.status, STATUS.PAUSED);
  assert.equal(paused.session.remainingMs, 56000);

  const resumed = reduce(paused.session, { type: 'short' }, 9000);
  assert.equal(resumed.session.status, STATUS.RUNNING);
  assert.equal(resumed.session.endsAt, 9000 + 56000);
});

test('press does nothing when the dialed time is zero', () => {
  const result = reduce(idle(0), { type: 'short' }, 1000);
  assert.equal(result.session.status, STATUS.IDLE);
  assert.deepEqual(result.effects, []);
});

test('hold returns the countdown to the dialed time and stops an alarm', () => {
  const started = reduce(idle(180), { type: 'short' }, 1000).session;
  const paused = reduce(started, { type: 'short' }, 20000).session;
  const reset = reduce(paused, { type: 'hold' }, 21000);
  assert.equal(reset.session.status, STATUS.IDLE);
  assert.equal(reset.session.durationSec, 180);
  assert.equal(reset.session.remainingMs, 180000);

  const alarm = reduce(started, { type: 'tick' }, started.endsAt + 1).session;
  const silenced = reduce(alarm, { type: 'hold' }, started.endsAt + 50);
  assert.equal(silenced.session.status, STATUS.IDLE);
  assert.ok(silenced.effects.includes('alarm-stop'));
  assert.equal(silenced.session.remainingMs, 180000);
});

test('expiry starts the alarm and a press returns to the dialed time', () => {
  const started = reduce(idle(5), { type: 'short' }, 1000).session;
  const mid = reduce(started, { type: 'tick' }, 3000);
  assert.equal(mid.session.status, STATUS.RUNNING);
  assert.equal(formatTitle(mid.session), '00:03\nИДЕТ');

  const done = reduce(mid.session, { type: 'tick' }, started.endsAt + 5);
  assert.equal(done.session.status, STATUS.ALARM);
  assert.ok(done.effects.includes('alarm-start'));
  assert.equal(formatTitle(done.session, true), '00:00\nКОНЕЦ');
  assert.equal(formatTitle(done.session, false), '00:00\n....');

  const after = reduce(done.session, { type: 'short' }, started.endsAt + 20);
  assert.equal(after.session.status, STATUS.IDLE);
  assert.equal(after.session.durationSec, 5);
});

test('paused rotation saves the new dialed time', () => {
  const started = reduce(idle(120), { type: 'short' }, 1000).session;
  const paused = reduce(started, { type: 'short' }, 10000).session;
  const adjusted = reduce(paused, { type: 'rotate', ticks: -1 }, 11000);
  assert.equal(adjusted.session.status, STATUS.PAUSED);
  assert.equal(adjusted.session.durationSec, 60);
  assert.equal(adjusted.session.remainingMs, 60000);
  assert.ok(adjusted.effects.includes('persist-soon'));
});

test('a running timer is restored from its end timestamp', () => {
  const now = 10_000;
  const session = restoreSession(
    {
      durationSec: 60,
      stepSec: 30,
      soundEnabled: true,
      status: STATUS.RUNNING,
      endsAt: now + 25000
    },
    now
  );
  assert.equal(session.status, STATUS.RUNNING);
  assert.equal(session.remainingMs, 25000);
  assert.equal(session.stepSec, 30);

  const expired = restoreSession(
    { durationSec: 60, status: STATUS.RUNNING, endsAt: now - 1 },
    now
  );
  assert.equal(expired.status, STATUS.ALARM);
});
