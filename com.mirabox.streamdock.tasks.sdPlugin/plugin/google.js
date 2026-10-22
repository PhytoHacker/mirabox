const { countOpen } = require('./count');

class TasksError extends Error {
  constructor(message, { status = 0, phase = '', code = '' } = {}) {
    super(message);
    this.name = 'TasksError';
    this.status = status;
    this.phase = phase;
    this.code = code || message;
  }
}

async function readError(response, phase) {
  let message = `Google Tasks ${response.status}`;
  try {
    const body = await response.json();
    const detail = body?.error?.message || body?.error_description;
    if (typeof detail === 'string' && detail.length < 180 && !/ya29|bearer|refresh/i.test(detail)) {
      message = detail;
    }
  } catch (unused) {
    message = `Google Tasks ${response.status}`;
  }
  return new TasksError(message, { status: response.status, phase, code: message });
}

async function googleJson(fetchImpl, url, token) {
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw await readError(response, 'api');
  return response.json();
}

async function requestToken(fetchImpl, body, phase) {
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) throw await readError(response, phase);
  const payload = await response.json();
  if (!payload || typeof payload.access_token !== 'string' || !payload.access_token) {
    throw new TasksError('token', { phase, code: 'token' });
  }
  const expiresIn = Number(payload.expires_in) || 3600;
  return {
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : '',
    expiresAt: Date.now() + expiresIn * 1000
  };
}

function exchangeCode(fetchImpl, { code, clientId, clientSecret, redirectUri, verifier }) {
  return requestToken(fetchImpl, new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier
  }), 'exchange');
}

function refreshAccessToken(fetchImpl, { clientId, clientSecret, refreshToken }) {
  return requestToken(fetchImpl, new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  }), 'refresh');
}

async function fetchEmail(fetchImpl, token) {
  try {
    const body = await googleJson(fetchImpl, 'https://www.googleapis.com/oauth2/v2/userinfo', token);
    return typeof body?.email === 'string' ? body.email : '';
  } catch (error) {
    return '';
  }
}

async function listPages(fetchImpl, token, buildUrl) {
  const items = [];
  let pageToken = '';
  for (let page = 0; page < 40; page += 1) {
    const body = await googleJson(fetchImpl, buildUrl(pageToken), token);
    if (Array.isArray(body.items)) items.push(...body.items);
    pageToken = typeof body.nextPageToken === 'string' ? body.nextPageToken : '';
    if (!pageToken) break;
  }
  return items;
}

async function countOpenTasks(fetchImpl, token) {
  const rawLists = await listPages(fetchImpl, token, (pageToken) => {
    const url = new URL('https://tasks.googleapis.com/tasks/v1/users/@me/lists');
    url.searchParams.set('maxResults', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    return url;
  });
  const lists = rawLists.filter((list) => list && typeof list.id === 'string' && list.id);
  const counts = {};
  let total = 0;
  for (const list of lists) {
    const tasks = await listPages(fetchImpl, token, (pageToken) => {
      const url = new URL(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(list.id)}/tasks`);
      url.searchParams.set('maxResults', '100');
      url.searchParams.set('showCompleted', 'false');
      url.searchParams.set('showHidden', 'false');
      url.searchParams.set('showDeleted', 'false');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      return url;
    });
    const count = countOpen(tasks);
    counts[list.id] = count;
    total += count;
  }
  return {
    total,
    counts,
    lists: lists.map((list) => ({
      id: list.id,
      title: typeof list.title === 'string' && list.title ? list.title : 'Список'
    }))
  };
}

module.exports = {
  TasksError,
  exchangeCode,
  refreshAccessToken,
  fetchEmail,
  countOpenTasks
};
