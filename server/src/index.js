import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { config } from './config.js';
import { getProvider } from './providers/index.js';
import {
  clearRefreshCookie,
  getAccessExpiry,
  setRefreshCookie,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} from './auth.js';
import { sanitizeUser } from './utils/user.js';
import { verifyPassword } from './utils/password.js';

const buildServer = async () => {
  const app = Fastify({ logger: true });
  const provider = await getProvider(config);

  await app.register(cookie);
  const normalizeOrigin = (value) => value.replace(/\/$/, '');
  const allowedOrigins = config.corsOrigins.map(normalizeOrigin);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }

      if (allowedOrigins.includes('*')) {
        cb(null, true);
        return;
      }

      const normalized = normalizeOrigin(origin);
      if (allowedOrigins.includes(normalized)) {
        cb(null, true);
        return;
      }

      cb(new Error('CORS origin not allowed'), false);
    },
    credentials: true
  });

  app.get('/health', async () => ({ ok: true }));

  app.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required.' });
    }

    const user = await provider.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ error: 'Invalid email or password.' });
    }

    if (user.status === 'Inactive') {
      return reply.code(403).send({ error: 'Account is inactive. Please contact your administrator.' });
    }

    await provider.updateLastLogin(user.id);

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    setRefreshCookie(reply, refreshToken);

    return {
      user: sanitizeUser(user),
      accessToken,
      expiresAt: getAccessExpiry()
    };
  });

  app.post('/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies?.refresh_token;
    if (!refreshToken) {
      clearRefreshCookie(reply);
      return reply.code(401).send({ error: 'Refresh token missing.' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      clearRefreshCookie(reply);
      return reply.code(401).send({ error: 'Refresh token invalid.' });
    }

    const user = await provider.getUserById(payload.sub);
    if (!user || user.status === 'Inactive') {
      clearRefreshCookie(reply);
      return reply.code(401).send({ error: 'User not found.' });
    }

    const accessToken = signAccessToken(user);
    return {
      accessToken,
      expiresAt: getAccessExpiry()
    };
  });

  app.post('/auth/logout', async (_request, reply) => {
    clearRefreshCookie(reply);
    return { ok: true };
  });

  app.get('/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return reply.code(401).send({ error: 'Authorization token missing.' });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return reply.code(401).send({ error: 'Authorization token invalid.' });
    }

    const user = await provider.getUserById(payload.sub);
    if (!user) {
      return reply.code(401).send({ error: 'User not found.' });
    }

    return { user: sanitizeUser(user) };
  });

  return app;
};

const start = async () => {
  try {
    const app = await buildServer();
    await app.listen({ port: config.port, host: config.host });
  } catch (error) {
    console.error('Server failed to start:', error);
    process.exit(1);
  }
};

start();
