const crypto = require('crypto');

const INTERVALS = [30, 60, 300];
const SCOPE = [
  'https://www.googleapis.com/auth/tasks.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

const LINKS = {
  console: 'https://console.cloud.google.com/',
  api: 'https://console.cloud.google.com/apis/library/tasks.googleapis.com',
  auth: 'https://console.cloud.google.com/auth/overview',
  audience: 'https://console.cloud.google.com/auth/audience',
  scopes: 'https://console.cloud.google.com/auth/scopes',
  clients: 'https://console.cloud.google.com/auth/clients'
};

const TASKS_PAGE = 'https://calendar.google.com/calendar/u/0/r/tasks';

function readSettings(raw) {
  const interval = INTERVALS.includes(Number(raw?.interval)) ? Number(raw.interval) : 60;
  return {
    clientId: typeof raw?.clientId === 'string' ? raw.clientId.trim() : '',
    clientSecret: typeof raw?.clientSecret === 'string' ? raw.clientSecret.trim() : '',
    listId: typeof raw?.listId === 'string' ? raw.listId.trim() : '',
    interval,
    showName: raw?.showName === true || raw?.showName === 'true'
  };
}

function redirectUri(port) {
  return `http://127.0.0.1:${port}`;
}

function createPkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('base64url');
  return { verifier, challenge, state };
}

function authUrl({ clientId, redirectUri: redirect, challenge, state }) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  return url.toString();
}

function allowedLink(name) {
  return LINKS[name] || '';
}

function titleText({ configured, signedIn, failed, count }) {
  if (!configured || !signedIn) return '—';
  if (count != null) return String(count);
  if (failed) return '!';
  return '…';
}

function explainError(error) {
  const code = error?.code || error?.message;
  if (code === 'signed-out' || code === 'closed') return '';
  if (code === 'timeout') return 'Вход не завершён. Нажмите «Войти» ещё раз.';
  if (code === 'no-refresh') return 'Google не выдал долгий вход. Нажмите «Войти» ещё раз и разрешите доступ.';
  if (code === 'access_denied') return 'Вход отменён.';
  if (code === 'state') return 'Ответ Google не сошёлся. Нажмите «Войти» ещё раз.';
  if (error?.phase === 'exchange') return 'Google не принял ID или секрет. Нужен клиент «Компьютерное приложение».';
  if (error?.phase === 'refresh' && (error.status === 400 || error.status === 401)) {
    return 'Сессия истекла. Войдите снова.';
  }
  if (error?.status === 401) return 'Сессия истекла. Войдите снова.';
  if (error?.status === 403) return 'Нет доступа. Включите Google Tasks API и добавьте свой Gmail в тестировщики.';
  if (typeof error?.status === 'number' && error.status >= 400) return 'Google не отдал список задач.';
  return 'Не удалось получить задачи. Проверьте интернет.';
}

module.exports = {
  INTERVALS,
  SCOPE,
  LINKS,
  TASKS_PAGE,
  readSettings,
  redirectUri,
  createPkce,
  authUrl,
  allowedLink,
  titleText,
  explainError
};
