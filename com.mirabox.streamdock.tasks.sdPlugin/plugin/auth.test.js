const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  readSettings,
  redirectUri,
  createPkce,
  authUrl,
  allowedLink,
  titleText,
  explainError
} = require('./auth');

test('settings keep only known intervals and trim the client', () => {
  assert.deepEqual(readSettings({ clientId: ' id ', clientSecret: ' sec ', listId: ' list ', interval: 30, showName: true }), {
    clientId: 'id',
    clientSecret: 'sec',
    listId: 'list',
    interval: 30,
    showName: true
  });
  assert.equal(readSettings({ interval: 15 }).interval, 60);
  assert.equal(readSettings({ showName: 'true' }).showName, true);
  assert.equal(readSettings(null).showName, false);
});

test('login url carries the pkce challenge and the tasks scope', () => {
  const pkce = createPkce();
  const digest = crypto.createHash('sha256').update(pkce.verifier).digest('base64url');
  assert.equal(pkce.challenge, digest);
  const url = new URL(authUrl({
    clientId: 'client',
    redirectUri: redirectUri(4321),
    challenge: pkce.challenge,
    state: pkce.state
  }));
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:4321');
  assert.equal(url.searchParams.get('code_challenge'), pkce.challenge);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(url.searchParams.get('scope'), /tasks\.readonly/);
  assert.equal(url.searchParams.get('access_type'), 'offline');
});

test('the key shows the last number, a dash before login, and a bang on failure', () => {
  assert.equal(titleText({ configured: false, signedIn: false, failed: false, count: null }), '—');
  assert.equal(titleText({ configured: true, signedIn: false, failed: false, count: null }), '—');
  assert.equal(titleText({ configured: true, signedIn: true, failed: false, count: null }), '…');
  assert.equal(titleText({ configured: true, signedIn: true, failed: false, count: 0 }), '0');
  assert.equal(titleText({ configured: true, signedIn: true, failed: true, count: 4 }), '4');
  assert.equal(titleText({ configured: true, signedIn: true, failed: true, count: null }), '!');
});

test('errors stay short and do not echo tokens', () => {
  assert.equal(explainError({ code: 'signed-out' }), '');
  assert.equal(explainError({ code: 'timeout' }), 'Вход не завершён. Нажмите «Войти» ещё раз.');
  assert.match(explainError({ status: 403 }), /Tasks API/);
  assert.match(explainError({ phase: 'exchange', status: 401 }), /секрет/);
  assert.equal(allowedLink('api').includes('tasks.googleapis.com'), true);
  assert.equal(allowedLink('scopes').includes('/auth/scopes'), true);
  assert.equal(allowedLink('https://evil.example'), '');
});
