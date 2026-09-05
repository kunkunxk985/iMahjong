import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AccountStore } from './accountStore.ts';
import type { GameMode, MatchRecord } from '@pizhou/shared';

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Content-Type, Authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}

function getBearerToken(req: IncomingMessage, url: URL): string | null {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return url.searchParams.get('token');
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, any> | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_SIZE) {
        chunks.length = 0;
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        if (!raw) return resolve({});
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          resolve(parsed as Record<string, any>);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    });

    req.on('error', () => resolve(null));
  });
}

export async function handleHttpApi(
  req: IncomingMessage,
  res: ServerResponse,
  store: AccountStore,
): Promise<boolean> {
  const host = req.headers.host || '127.0.0.1';
  const url = new URL(req.url ?? '/', `http://${host}`);
  const path = url.pathname;
  const method = req.method?.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'Content-Type, Authorization',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return true;
  }

  // Health probe route
  if (path === '/' && method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'access-control-allow-origin': '*',
    });
    res.end('pizhou-mahjong-server\n');
    return true;
  }

  if (!path.startsWith('/api/')) {
    return false;
  }

  // 1. Guest login
  if (path === '/api/auth/guest' && method === 'POST') {
    const body = (await readJsonBody(req)) ?? {};
    const result = await store.createGuest(body.nickname);
    sendJson(res, 200, result);
    return true;
  }

  // 2. Register
  if (path === '/api/auth/register' && method === 'POST') {
    const body = await readJsonBody(req);
    if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
      sendJson(res, 400, { error: '请填写账号和密码' });
      return true;
    }
    const result = await store.register(body.username, body.password, body.nickname);
    if (typeof result === 'string') {
      sendJson(res, 400, { error: result });
    } else {
      sendJson(res, 200, result);
    }
    return true;
  }

  // 3. Login
  if (path === '/api/auth/login' && method === 'POST') {
    const body = await readJsonBody(req);
    if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
      sendJson(res, 400, { error: '请填写账号和密码' });
      return true;
    }
    const result = await store.login(body.username, body.password);
    if (typeof result === 'string') {
      sendJson(res, 400, { error: result });
    } else {
      sendJson(res, 200, result);
    }
    return true;
  }

  // 4. Upgrade guest
  if (path === '/api/auth/upgrade' && method === 'POST') {
    const token = getBearerToken(req, url);
    if (!token) {
      sendJson(res, 401, { error: '未登录' });
      return true;
    }
    const userRow = await store.getUserByToken(token);
    if (!userRow) {
      sendJson(res, 401, { error: '登录已失效' });
      return true;
    }
    const body = await readJsonBody(req);
    if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
      sendJson(res, 400, { error: '请填写新账号和密码' });
      return true;
    }
    const result = await store.upgradeGuest(userRow.id, body.username, body.password, body.nickname);
    if (typeof result === 'string') {
      sendJson(res, 400, { error: result });
    } else {
      sendJson(res, 200, result);
    }
    return true;
  }

  // 5. Silent Token renewal
  if (path === '/api/auth/renew' && method === 'POST') {
    const token = getBearerToken(req, url);
    if (!token) {
      sendJson(res, 401, { error: '未登录' });
      return true;
    }
    const renewed = await store.renewSession(token);
    if (!renewed) {
      sendJson(res, 401, { error: '登录已失效' });
      return true;
    }
    sendJson(res, 200, renewed);
    return true;
  }

  // 6. Logout
  if (path === '/api/auth/logout' && method === 'POST') {
    const token = getBearerToken(req, url);
    if (token) {
      await store.revokeToken(token);
    }
    sendJson(res, 200, { success: true });
    return true;
  }

  // 7. Change password
  if (path === '/api/auth/password' && method === 'POST') {
    const token = getBearerToken(req, url);
    if (!token) {
      sendJson(res, 401, { error: '未登录' });
      return true;
    }
    const userRow = await store.getUserByToken(token);
    if (!userRow) {
      sendJson(res, 401, { error: '登录已失效' });
      return true;
    }
    const body = await readJsonBody(req);
    if (!body || typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
      sendJson(res, 400, { error: '请填写当前密码和新密码' });
      return true;
    }
    const result = await store.changePassword(userRow.id, body.currentPassword, body.newPassword);
    if (typeof result === 'string') {
      sendJson(res, 400, { error: result });
    } else {
      sendJson(res, 200, result);
    }
    return true;
  }

  // 8. Profile API (GET & POST)
  if (path === '/api/profile') {
    const token = getBearerToken(req, url);
    if (!token) {
      sendJson(res, 401, { error: '未登录' });
      return true;
    }
    const userRow = await store.getUserByToken(token);
    if (!userRow) {
      sendJson(res, 401, { error: '登录已失效' });
      return true;
    }

    if (method === 'GET') {
      const profile = await store.getProfile(userRow.id);
      sendJson(res, 200, { user: profile });
      return true;
    }

    if (method === 'POST') {
      const body = await readJsonBody(req);
      if (!body) {
        sendJson(res, 400, { error: '资料格式不正确' });
        return true;
      }
      const updated = await store.updateProfile(userRow.id, body);
      sendJson(res, 200, { user: updated });
      return true;
    }
  }

  // 9. Matches API (GET & POST)
  if (path === '/api/matches') {
    const token = getBearerToken(req, url);
    if (!token) {
      sendJson(res, 401, { error: '未登录' });
      return true;
    }
    const userRow = await store.getUserByToken(token);
    if (!userRow) {
      sendJson(res, 401, { error: '登录已失效' });
      return true;
    }

    if (method === 'GET') {
      const mode = (url.searchParams.get('mode') as GameMode) || undefined;
      const limit = Number(url.searchParams.get('limit')) || 50;
      const data = await store.getMatches(userRow.id, mode, limit);
      sendJson(res, 200, data);
      return true;
    }

    if (method === 'POST') {
      const body = (await readJsonBody(req)) as MatchRecord | null;
      if (!body || !body.id) {
        sendJson(res, 400, { error: '战绩格式不正确' });
        return true;
      }
      await store.saveMatch(userRow.id, body);
      sendJson(res, 200, { success: true, id: body.id });
      return true;
    }
  }

  // 10. Leaderboard / Hall of Fame
  if (path === '/api/leaderboard' && method === 'GET') {
    const leaderboard = await store.getLeaderboard();
    sendJson(res, 200, { leaderboard });
    return true;
  }

  // Fallback for friends APIs in standalone / local server
  if (path.startsWith('/api/friends/')) {
    if (path === '/api/friends/search') {
      sendJson(res, 200, { results: [] });
      return true;
    }
    if (path === '/api/friends/list') {
      sendJson(res, 200, { friends: [] });
      return true;
    }
    if (path === '/api/friends/requests') {
      sendJson(res, 200, { requests: [] });
      return true;
    }
    if (path === '/api/friends/request' || path === '/api/friends/respond' || path === '/api/friends/delete') {
      sendJson(res, 200, { success: true });
      return true;
    }
    if (path === '/api/friends/stats') {
      sendJson(res, 200, { user: null, stats: null, recentMatches: [], status: 'offline' });
      return true;
    }
  }

  sendJson(res, 404, { error: 'API route not found' });
  return true;
}
