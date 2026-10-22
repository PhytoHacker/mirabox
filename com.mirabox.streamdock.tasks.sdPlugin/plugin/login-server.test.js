const test = require('node:test');
const assert = require('node:assert/strict');
const { startLoginServer } = require('./login-server');

test('login server returns the code and ignores the favicon', async () => {
  const server = await startLoginServer('abc', { timeoutMs: 5000 });
  const favicon = await fetch(`http://127.0.0.1:${server.port}/favicon.ico`);
  assert.equal(favicon.status, 404);
  const page = await fetch(`http://127.0.0.1:${server.port}/?code=xyz&state=abc`);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /MiraBox/);
  assert.doesNotMatch(html, /xyz/);
  assert.equal(await server.done, 'xyz');
});

test('login server rejects a mismatched state', async () => {
  const server = await startLoginServer('abc', { timeoutMs: 5000 });
  await fetch(`http://127.0.0.1:${server.port}/?code=xyz&state=nope`);
  await assert.rejects(() => server.done, (error) => error.code === 'state');
});

test('login server times out when the browser never returns', async () => {
  const server = await startLoginServer('abc', { timeoutMs: 50 });
  await assert.rejects(() => server.done, (error) => error.code === 'timeout');
});
