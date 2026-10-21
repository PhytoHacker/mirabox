const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_SEC,
  MAX_SW_MS,
  STATUS,
  formatTime,
  formatTitle,
  ringPercent,
  faceStyle,
  createSession,
  restoreSession,
  reduce
} = require('./logic');

function idle(seconds = 300) {
  return createSession({ durationSec: seconds, stepSec: 60, soundEnabled: true });
}

test('themes keep a full ring at the start and sixty percent after forty seconds', () => {
  assert.equal(ringPercent(idle(100)), 1);
  const started = reduce(idle(100), { type: 'short' }, 1000).session;
  const later = reduce(started, { type: 'tick' }, 1000 + 40_000).session;
  assert.equal(ringPercent(later), 0.6);
  assert.equal(faceStyle({ theme: 'neon' }).running, '#3ddc97');
  assert.equal(faceStyle({ theme: 'custom', accent: '#112233' }).running, '#112233');
  assert.equal(faceStyle({ theme: 'nope' }).theme, 'neon');
  const { faceImage } = require('./ring');
  const image = decodeURIComponent(faceImage({
    percent: 0.6,
    time: '01:00',
    label: 'ИДЕТ',
    status: 'running',
    pulse: 1,
    style: faceStyle({ theme: 'neon' })
  }));
  assert.equal(image.includes('01:00'), true);
  assert.equal(image.includes('ИДЕТ'), true);
});

test('finished timer draws a full red ring that breathes', () => {
  const { faceImage } = require('./ring');
  const style = faceStyle({ theme: 'neon' });
  const dim = decodeURIComponent(faceImage({
    percent: 0,
    time: '00:00',
    label: 'КОНЕЦ',
    status: 'alarm',
    pulse: 0,
    style
  }));
  const bright = decodeURIComponent(faceImage({
    percent: 0,
    time: '00:00',
    label: 'КОНЕЦ',
    status: 'alarm',
    pulse: 1,
    style
  }));
  assert.equal(dim.includes('#ff3148'), true);
  assert.equal(dim.includes('stroke-dashoffset="0.000"'), true);
  assert.equal(dim.includes('stroke-opacity="0.340"'), true);
  assert.equal(bright.includes('stroke-opacity="1.000"'), true);
});

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

test('four-click mode switch pauses a running timer and comes back to it', () => {
  const started = reduce(idle(60), { type: 'short' }, 1000).session;
  const switched = reduce(started, { type: 'mode' }, 5000);
  assert.equal(switched.session.mode, 'stopwatch');
  assert.equal(switched.session.status, STATUS.PAUSED);
  assert.equal(switched.session.remainingMs, 56000);
  assert.equal(formatTitle(switched.session), '00:00\nСЕКУНД');
  assert.ok(switched.effects.includes('unwatch'));

  const back = reduce(switched.session, { type: 'mode' }, 8000);
  assert.equal(back.session.mode, 'timer');
  assert.equal(back.session.status, STATUS.PAUSED);
  assert.equal(back.session.remainingMs, 56000);
});

test('switching away from an alarm silences it and returns the dialed time', () => {
  const started = reduce(idle(5), { type: 'short' }, 1000).session;
  const done = reduce(started, { type: 'tick' }, started.endsAt + 5).session;
  const switched = reduce(done, { type: 'mode' }, started.endsAt + 20);
  assert.equal(switched.session.mode, 'stopwatch');
  assert.equal(switched.session.status, STATUS.IDLE);
  assert.equal(switched.session.remainingMs, 5000);
  assert.ok(switched.effects.includes('alarm-stop'));
});

test('stopwatch counts up, the ring tracks the second hand, and a reset clears it', () => {
  const sw = reduce(idle(0), { type: 'mode' }, 1000).session;
  const started = reduce(sw, { type: 'short' }, 2000);
  assert.equal(started.session.swStatus, STATUS.RUNNING);
  assert.ok(started.effects.includes('watch'));

  const later = reduce(started.session, { type: 'tick' }, 2000 + 30500);
  assert.equal(formatTitle(later.session), '00:30\nИДЕТ');
  assert.equal(ringPercent(later.session), 30500 / 60000);

  const minute = reduce(started.session, { type: 'tick' }, 2000 + 60000);
  assert.equal(formatTitle(minute.session), '01:00\nИДЕТ');
  assert.equal(ringPercent(minute.session), 0);

  const paused = reduce(later.session, { type: 'short' }, 2000 + 30500);
  assert.equal(paused.session.swStatus, STATUS.PAUSED);
  assert.equal(formatTitle(paused.session), '00:30\nСТОП');
  const frozen = reduce(paused.session, { type: 'tick' }, 90000);
  assert.equal(frozen.session, paused.session);

  const resumed = reduce(paused.session, { type: 'short' }, 40000);
  const more = reduce(resumed.session, { type: 'tick' }, 45000);
  assert.equal(formatTitle(more.session), '00:35\nИДЕТ');
  assert.equal(ringPercent(more.session), 35500 / 60000);

  const spun = reduce(started.session, { type: 'rotate', ticks: 3 }, 3000);
  assert.equal(spun.session, started.session);

  const reset = reduce(more.session, { type: 'hold' }, 46000);
  assert.equal(reset.session.swStatus, STATUS.IDLE);
  assert.equal(formatTitle(reset.session), '00:00\nСЕКУНД');
  assert.equal(ringPercent(reset.session), 0);
});

test('stopwatch color is its own theme color and fills the face', () => {
  assert.equal(faceStyle({ theme: 'neon' }).stopwatch, '#59b7ff');
  assert.notEqual(faceStyle({ theme: 'neon' }).stopwatch, faceStyle({ theme: 'neon' }).running);
  const style = faceStyle({ theme: 'custom', accent: '#112233', stopwatchColor: '#123456' });
  assert.equal(style.running, '#112233');
  assert.equal(style.stopwatch, '#123456');
  assert.equal(faceStyle({ theme: 'custom', stopwatchColor: 'blue' }).stopwatch, '#59b7ff');

  const { faceImage } = require('./ring');
  const image = decodeURIComponent(faceImage({
    percent: 0,
    time: '00:00',
    label: 'СЕКУНД',
    status: 'stopwatch',
    pulse: 1,
    style
  }));
  assert.equal(image.includes('#123456'), true);
  assert.equal(image.includes('СЕКУНД'), true);
});

test('a running stopwatch is restored from its start timestamp', () => {
  const now = 20_000;
  const session = restoreSession({
    durationSec: 60,
    status: STATUS.PAUSED,
    remainingSec: 40,
    mode: 'stopwatch',
    swStatus: STATUS.RUNNING,
    swBaseMs: 10_000,
    swStartedAt: 5_000,
    stopwatchColor: '#123456'
  }, now);
  assert.equal(session.mode, 'stopwatch');
  assert.equal(session.swStatus, STATUS.RUNNING);
  assert.equal(session.swShowMs, 25_000);
  assert.equal(session.status, STATUS.PAUSED);
  assert.equal(session.remainingMs, 40_000);
  assert.equal(session.stopwatchColor, '#123456');
  assert.equal(formatTitle(session), '00:25\nИДЕТ');
  assert.equal(ringPercent(session), 25000 / 60000);
});

test('the stopwatch stops at ninety-nine hours', () => {
  const sw = reduce(idle(), { type: 'mode' }, 0).session;
  const capped = reduce({
    ...sw,
    swStatus: STATUS.RUNNING,
    swBaseMs: MAX_SW_MS - 50,
    swStartedAt: 1000,
    swShowMs: MAX_SW_MS - 50
  }, { type: 'tick' }, 1100);
  assert.equal(capped.session.swStatus, STATUS.PAUSED);
  assert.equal(capped.session.swShowMs, MAX_SW_MS);
  assert.ok(capped.effects.includes('unwatch'));
});
