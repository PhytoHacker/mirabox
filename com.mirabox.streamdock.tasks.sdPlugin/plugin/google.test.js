const test = require('node:test');
const assert = require('node:assert/strict');
const { exchangeCode, refreshAccessToken, countOpenTasks } = require('./google');

function responder(handler) {
  return async (url, options = {}) => {
    const result = await handler(String(url), options);
    return {
      ok: result.status < 400,
      status: result.status,
      async json() {
        return result.body;
      }
    };
  };
}

test('pages of lists and tasks add up without completed items', async () => {
  const calls = [];
  const fetchImpl = responder(async (url) => {
    calls.push(url);
    if (url.includes('/users/@me/lists') && !url.includes('pageToken=')) {
      return { status: 200, body: { items: [{ id: 'home', title: 'Дом' }], nextPageToken: 'L2' } };
    }
    if (url.includes('/users/@me/lists')) {
      return { status: 200, body: { items: [{ id: 'work', title: '' }] } };
    }
    if (url.includes('/lists/home/tasks') && !url.includes('pageToken=')) {
      return {
        status: 200,
        body: {
          items: [
            { status: 'needsAction' },
            { status: 'completed' },
            { status: 'needsAction' }
          ],
          nextPageToken: 'T2'
        }
      };
    }
    if (url.includes('/lists/home/tasks')) {
      return { status: 200, body: { items: [{ status: 'needsAction' }] } };
    }
    if (url.includes('/lists/work/tasks')) {
      return { status: 200, body: { items: [] } };
    }
    return { status: 404, body: { error: { message: 'missing' } } };
  });

  const snapshot = await countOpenTasks(fetchImpl, 'token');
  assert.equal(snapshot.total, 3);
  assert.deepEqual(snapshot.counts, { home: 3, work: 0 });
  assert.deepEqual(snapshot.lists, [
    { id: 'home', title: 'Дом' },
    { id: 'work', title: 'Список' }
  ]);
  assert.equal(calls.some((url) => url.includes('showCompleted=false')), true);
});

test('a failed tasks response keeps the status code', async () => {
  const fetchImpl = responder(async () => ({
    status: 403,
    body: { error: { message: 'Tasks API has not been used' } }
  }));
  await assert.rejects(
    () => countOpenTasks(fetchImpl, 'token'),
    (error) => error.status === 403 && /Tasks API/.test(error.message)
  );
});

test('login exchange and refresh return the access token', async () => {
  const fetchImpl = responder(async (url, options) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    const body = String(options.body);
    if (body.includes('authorization_code')) {
      assert.match(body, /code_verifier=verifier/);
      return {
        status: 200,
        body: { access_token: 'access', refresh_token: 'refresh', expires_in: 10 }
      };
    }
    assert.match(body, /grant_type=refresh_token/);
    return { status: 200, body: { access_token: 'next', expires_in: 10 } };
  });

  const created = await exchangeCode(fetchImpl, {
    code: 'code',
    clientId: 'id',
    clientSecret: 'secret',
    redirectUri: 'http://127.0.0.1:1/',
    verifier: 'verifier'
  });
  assert.equal(created.accessToken, 'access');
  assert.equal(created.refreshToken, 'refresh');

  const refreshed = await refreshAccessToken(fetchImpl, {
    clientId: 'id',
    clientSecret: 'secret',
    refreshToken: 'refresh'
  });
  assert.equal(refreshed.accessToken, 'next');
  assert.equal(refreshed.refreshToken, '');
});
