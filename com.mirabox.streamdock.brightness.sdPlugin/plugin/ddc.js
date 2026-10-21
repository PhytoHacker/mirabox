const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');

function createDdc(exe = path.join(__dirname, 'ddc.exe')) {
  let child = null;
  const queue = [];
  let current = null;
  let timer = null;

  function rejectAll(error) {
    if (current) {
      clearTimeout(timer);
      const pending = current;
      current = null;
      pending.reject(error);
    }
    while (queue.length) queue.shift().reject(error);
  }

  function drop() {
    const running = child;
    child = null;
    if (running) running.kill();
  }

  function start() {
    if (child) return;
    child = spawn(exe, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const running = child;
    const lines = readline.createInterface({ input: running.stdout });
    lines.on('line', (line) => {
      if (!current || running !== child) return;
      clearTimeout(timer);
      const pending = current;
      current = null;
      try {
        pending.resolve(JSON.parse(line));
      } catch (error) {
        pending.reject(error);
      }
      pump();
    });
    running.on('error', (error) => {
      if (running !== child) return;
      child = null;
      rejectAll(error);
    });
    running.on('exit', () => {
      if (running !== child && child !== null) return;
      child = null;
      rejectAll(new Error('Служба яркости остановилась'));
    });
  }

  function pump() {
    if (current || !queue.length) return;
    start();
    if (!child || !child.stdin || !child.stdin.writable) {
      queue.shift().reject(new Error('Не удалось запустить службу яркости'));
      return;
    }
    current = queue.shift();
    const pending = current;
    timer = setTimeout(() => {
      if (current !== pending) return;
      current = null;
      pending.reject(new Error('Монитор не ответил'));
      drop();
    }, 4000);
    try {
      child.stdin.write(`${JSON.stringify(pending.obj)}\n`);
    } catch (error) {
      clearTimeout(timer);
      current = null;
      pending.reject(error);
      drop();
    }
  }

  function request(obj) {
    return new Promise((resolve, reject) => {
      queue.push({ obj, resolve, reject });
      pump();
    }).then((body) => {
      if (!body || body.ok === false) throw new Error((body && body.error) || 'Монитор не ответил');
      return body;
    });
  }

  return {
    list() {
      return request({ cmd: 'list' }).then((body) => body.monitors || []);
    },
    set(id, value) {
      return request({ cmd: 'set', id, value }).then((body) => body.brightness);
    },
    close() {
      drop();
      rejectAll(new Error('Служба яркости остановлена'));
    }
  };
}

module.exports = { createDdc };
