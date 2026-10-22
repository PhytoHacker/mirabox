const http = require('http');

function startLoginServer(expectedState, { timeoutMs = 180000 } = {}) {
  let settled = false;
  let timer = null;
  let finish;
  let fail;
  const done = new Promise((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  done.catch(() => {});

  let server;
  const settle = (fn, value) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    server.close();
    fn(value);
  };

  server = http.createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://127.0.0.1');
    } catch (unused) {
      res.writeHead(400);
      res.end();
      return;
    }
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    if (!code && !error) {
      res.writeHead(url.pathname === '/' ? 204 : 404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' });
    res.end('<!doctype html><meta charset="utf-8"><title>Задачи</title><p>Можно закрыть эту вкладку и вернуться к MiraBox.</p>');
    if (error) settle(fail, Object.assign(new Error(error), { code: error }));
    else if (state !== expectedState || !code) settle(fail, Object.assign(new Error('state'), { code: 'state' }));
    else settle(finish, code);
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      timer = setTimeout(() => {
        settle(fail, Object.assign(new Error('timeout'), { code: 'timeout' }));
      }, timeoutMs);
      resolve({
        port: server.address().port,
        done,
        close() {
          settle(fail, Object.assign(new Error('closed'), { code: 'closed' }));
        }
      });
    });
  });
}

module.exports = { startLoginServer };
