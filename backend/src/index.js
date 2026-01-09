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
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
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

  const getRequestUser = async (request) => {
    const authHeader = request.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return null;

    try {
      const payload = verifyAccessToken(token);
      const user = await provider.getUserById(payload.sub);
      return user || null;
    } catch {
      return null;
    }
  };

  app.get('/locations', async () => {
    return provider.getLocations();
  });

  app.get('/locations/:id', async (request, reply) => {
    const location = await provider.getLocationById(request.params.id);
    if (!location) {
      return reply.code(404).send({ error: 'Location not found.' });
    }
    return location;
  });

  app.post('/locations', async (request, reply) => {
    const { name, city } = request.body || {};
    if (!name || !city) {
      return reply.code(400).send({ error: 'Name and city are required.' });
    }

    try {
      const created = await provider.createLocation({ name, city }, null);
      return reply.code(201).send(created);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.put('/locations/:id', async (request, reply) => {
    const { name, city } = request.body || {};
    if (!name || !city) {
      return reply.code(400).send({ error: 'Name and city are required.' });
    }

    try {
      const updated = await provider.updateLocation(
        { id: request.params.id, name, city },
        null
      );
      return updated;
    } catch (error) {
      const status = error.message === 'Location not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  app.delete('/locations/:id', async (request, reply) => {
    try {
      await provider.deleteLocation(request.params.id, null);
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get('/departments', async () => {
    return provider.getDepartments();
  });

  app.get('/departments/:id', async (request, reply) => {
    const department = await provider.getDepartmentById(request.params.id);
    if (!department) {
      return reply.code(404).send({ error: 'Department not found.' });
    }
    return department;
  });

  app.post('/departments', async (request, reply) => {
    const { name, description } = request.body || {};
    if (!name) {
      return reply.code(400).send({ error: 'Name is required.' });
    }

    try {
      const created = await provider.createDepartment({ name, description }, null);
      return reply.code(201).send(created);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.put('/departments/:id', async (request, reply) => {
    const { name, description } = request.body || {};
    if (!name) {
      return reply.code(400).send({ error: 'Name is required.' });
    }

    try {
      const updated = await provider.updateDepartment(
        { id: request.params.id, name, description },
        null
      );
      return updated;
    } catch (error) {
      const status = error.message === 'Department not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  app.delete('/departments/:id', async (request, reply) => {
    try {
      await provider.deleteDepartment(request.params.id, null);
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get('/assets', async () => {
    return provider.getAssets();
  });

  app.get('/assets/page', async (request) => {
    const { page, pageSize, search, type, status } = request.query || {};
    return provider.getAssetsPage({
      page: Number(page || 1),
      pageSize: Number(pageSize || 20),
      search,
      type,
      status
    });
  });

  app.get('/assets/check-serial', async (request) => {
    const { serial, excludeId } = request.query || {};
    return {
      exists: await provider.checkSerialNumberExists(serial, excludeId)
    };
  });

  app.get('/assets/:id', async (request, reply) => {
    const asset = await provider.getAssetById(request.params.id);
    if (!asset) {
      return reply.code(404).send({ error: 'Asset not found.' });
    }
    return asset;
  });

  app.post('/assets', async (request, reply) => {
    const { name, type, serialNumber } = request.body || {};
    if (!name || !type || !serialNumber) {
      return reply.code(400).send({ error: 'Name, type, and serial number are required.' });
    }

    try {
      const created = await provider.createAsset(request.body, null);
      return reply.code(201).send(created);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.put('/assets/:id', async (request, reply) => {
    const { name, type, serialNumber } = request.body || {};
    if (!name || !type || !serialNumber) {
      return reply.code(400).send({ error: 'Name, type, and serial number are required.' });
    }

    try {
      const updated = await provider.updateAsset(
        { ...request.body, id: request.params.id },
        null
      );
      return updated;
    } catch (error) {
      const status = error.message === 'Asset not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  app.delete('/assets/:id', async (request, reply) => {
    try {
      await provider.deleteAsset(request.params.id, null);
      return { ok: true };
    } catch (error) {
      const status = error.message === 'Asset not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  app.get('/assets/:id/comments', async (request) => {
    return provider.getAssetComments(request.params.id);
  });

  app.post('/assets/:id/comments', async (request, reply) => {
    const { authorName, message, type, authorId, createdAt } = request.body || {};
    if (!authorName || !message) {
      return reply.code(400).send({ error: 'Author name and message are required.' });
    }

    try {
      const created = await provider.addAssetComment({
        assetId: request.params.id,
        authorName,
        authorId,
        message,
        type,
        createdAt
      });
      return reply.code(201).send(created);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get('/employees', async (request) => {
    const { employeeId } = request.query || {};
    if (employeeId) {
      return provider.getEmployeeByEmployeeId(employeeId);
    }
    return provider.getEmployees();
  });

  app.get('/employees/page', async (request) => {
    const { page, pageSize, search, status, department } = request.query || {};
    return provider.getEmployeesPage({
      page: Number(page || 1),
      pageSize: Number(pageSize || 20),
      search,
      status,
      department
    });
  });

  app.get('/employees/:id', async (request, reply) => {
    const employee = await provider.getEmployeeById(request.params.id);
    if (!employee) {
      return reply.code(404).send({ error: 'Employee not found.' });
    }
    return employee;
  });

  app.post('/employees', async (request, reply) => {
    const { employeeId, personalInfo } = request.body || {};
    if (!employeeId) {
      return reply.code(400).send({ error: 'Employee ID is required.' });
    }
    if (!personalInfo?.firstName) {
      return reply.code(400).send({ error: 'Employee first name is required.' });
    }

    try {
      const created = await provider.createEmployee(request.body, null);
      return reply.code(201).send(created);
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.put('/employees/:id', async (request, reply) => {
    const { employeeId, personalInfo } = request.body || {};
    if (!employeeId) {
      return reply.code(400).send({ error: 'Employee ID is required.' });
    }
    if (!personalInfo?.firstName) {
      return reply.code(400).send({ error: 'Employee first name is required.' });
    }

    try {
      const updated = await provider.updateEmployee(
        { ...request.body, id: request.params.id },
        null
      );
      return updated;
    } catch (error) {
      const status = error.message === 'Employee not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  app.delete('/employees/:id', async (request, reply) => {
    try {
      await provider.deleteEmployee(request.params.id, null);
      return { ok: true };
    } catch (error) {
      const status = error.message === 'Employee not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  app.get('/users', async (request) => {
    const { email } = request.query || {};
    if (email) {
      const user = await provider.getUserByEmail(email);
      return user ? sanitizeUser(user) : null;
    }

    const users = await provider.getUsers();
    return users.map(sanitizeUser);
  });

  app.get('/users/:id', async (request, reply) => {
    const user = await provider.getUserById(request.params.id);
    if (!user) {
      return reply.code(404).send({ error: 'User not found.' });
    }
    return sanitizeUser(user);
  });

  app.post('/users', async (request, reply) => {
    const { name, email, role, status, password } = request.body || {};
    if (!name || !email || !role || !status || !password) {
      return reply.code(400).send({ error: 'Name, email, role, status, and password are required.' });
    }

    const currentUser = await getRequestUser(request);
    if (!currentUser) {
      return reply.code(401).send({ error: 'Authorization token missing or invalid.' });
    }

    try {
      const created = await provider.createUser(
        { name, email, role, status },
        password,
        currentUser
      );
      return reply.code(201).send(sanitizeUser(created));
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.put('/users/:id', async (request, reply) => {
    const { name, email, role, status } = request.body || {};
    if (!name || !email || !role || !status) {
      return reply.code(400).send({ error: 'Name, email, role, and status are required.' });
    }

    const currentUser = await getRequestUser(request);
    if (!currentUser) {
      return reply.code(401).send({ error: 'Authorization token missing or invalid.' });
    }

    try {
      const updated = await provider.updateUser(
        { id: request.params.id, name, email, role, status },
        currentUser
      );
      return sanitizeUser(updated);
    } catch (error) {
      const statusCode = error.message === 'User not found' ? 404 : 400;
      return reply.code(statusCode).send({ error: error.message });
    }
  });

  app.put('/users/:id/password', async (request, reply) => {
    const { password } = request.body || {};
    if (!password) {
      return reply.code(400).send({ error: 'Password is required.' });
    }

    const currentUser = await getRequestUser(request);
    if (!currentUser) {
      return reply.code(401).send({ error: 'Authorization token missing or invalid.' });
    }

    if (currentUser.id !== request.params.id && currentUser.role !== 'Admin') {
      return reply.code(403).send({ error: 'Permission denied: admin access required.' });
    }

    try {
      await provider.updateUserPassword(request.params.id, password);
      return { ok: true };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.post('/users/:id/reset-password', async (request, reply) => {
    const { passwordOption } = request.body || {};

    const currentUser = await getRequestUser(request);
    if (!currentUser) {
      return reply.code(401).send({ error: 'Authorization token missing or invalid.' });
    }

    try {
      const temporaryPassword = await provider.resetUserPassword(
        request.params.id,
        currentUser,
        passwordOption
      );
      return { temporaryPassword };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.delete('/users/:id', async (request, reply) => {
    const currentUser = await getRequestUser(request);
    if (!currentUser) {
      return reply.code(401).send({ error: 'Authorization token missing or invalid.' });
    }

    try {
      await provider.deleteUser(request.params.id, currentUser);
      return { ok: true };
    } catch (error) {
      const statusCode = error.message === 'User not found' ? 404 : 400;
      return reply.code(statusCode).send({ error: error.message });
    }
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
