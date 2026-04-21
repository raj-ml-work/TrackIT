import Fastify from 'fastify';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
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
import { createAuthorize } from './middleware/authorize.js';

const EMPLOYEE_ASSIGNMENT_TYPES = new Set(['Client Billable', 'Bench', 'Support']);
const EMPLOYEE_FEEDBACK_CATEGORIES = new Set(['General', 'Client Engagement', 'Bench Performance']);
const MAX_EMPLOYEE_PHOTO_BYTES = 2 * 1024 * 1024;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMPLOYEE_PHOTO_LOCAL_PATH_PATTERN = /^\/uploads\/employee_photos\/[A-Za-z0-9/_\-.]+$/;
const EMPLOYEE_PHOTO_DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i;
const PHOTO_EXTENSION_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg'
};
const PHOTO_CONTENT_TYPE_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml'
};

const isBlank = (value) => typeof value !== 'string' || value.trim() === '';

const decodeBase64ByteLength = (encoded) => {
  const compact = encoded.replace(/\s+/g, '');
  if (!compact || compact.length % 4 !== 0) {
    return -1;
  }

  const padding = compact.endsWith('==') ? 2 : compact.endsWith('=') ? 1 : 0;
  return Math.floor((compact.length * 3) / 4) - padding;
};

const isPathInside = (parentPath, childPath) => {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const sanitizePathSegment = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'employee';
};

const getEmployeePhotoDataUrlMatch = (photoUrl) => {
  if (typeof photoUrl !== 'string') return null;
  return photoUrl.trim().match(EMPLOYEE_PHOTO_DATA_URL_PATTERN);
};

const isLocalEmployeePhotoPath = (photoUrl) => {
  if (typeof photoUrl !== 'string') return false;
  const trimmedPhotoUrl = photoUrl.trim();
  if (!trimmedPhotoUrl || trimmedPhotoUrl.includes('..')) return false;
  return EMPLOYEE_PHOTO_LOCAL_PATH_PATTERN.test(trimmedPhotoUrl);
};

const resolveLocalEmployeePhotoAbsolutePath = (photoUrl) => {
  if (!isLocalEmployeePhotoPath(photoUrl)) return null;
  const trimmedPhotoUrl = photoUrl.trim();
  const relativeFromUploadsRoot = trimmedPhotoUrl.slice('/uploads/'.length);
  const absolutePath = path.resolve(config.uploadsRoot, relativeFromUploadsRoot);
  if (!isPathInside(config.uploadsRoot, absolutePath)) {
    return null;
  }
  return absolutePath;
};

const getPhotoExtensionFromMimeType = (mimeType) => {
  const normalized = String(mimeType || '').toLowerCase();
  if (PHOTO_EXTENSION_BY_MIME[normalized]) {
    return PHOTO_EXTENSION_BY_MIME[normalized];
  }

  const slashIndex = normalized.indexOf('/');
  if (slashIndex < 0) return 'png';
  const subtype = normalized.slice(slashIndex + 1).replace(/[^a-z0-9.+-]+/g, '');
  return subtype || 'png';
};

const saveEmployeePhotoBufferToLocalStorage = async (photoBuffer, mimeType, employeeId) => {
  if (!Buffer.isBuffer(photoBuffer) || photoBuffer.length === 0) {
    throw new Error('Employee photograph data is invalid.');
  }
  if (photoBuffer.length > MAX_EMPLOYEE_PHOTO_BYTES) {
    throw new Error('Employee photograph must be 2MB or smaller.');
  }

  const employeeFolder = sanitizePathSegment(employeeId);
  const targetDir = path.resolve(config.employeePhotoUploadDir, employeeFolder);
  if (!isPathInside(config.employeePhotoUploadDir, targetDir)) {
    throw new Error('Invalid employee photo storage path.');
  }

  await fsp.mkdir(targetDir, { recursive: true });

  const fileExtension = getPhotoExtensionFromMimeType(mimeType);
  const fileName = `${Date.now()}-${randomUUID()}.${fileExtension}`;
  const absolutePath = path.resolve(targetDir, fileName);
  if (!isPathInside(config.employeePhotoUploadDir, absolutePath)) {
    throw new Error('Invalid employee photo file path.');
  }

  await fsp.writeFile(absolutePath, photoBuffer);

  return {
    photoUrl: `/uploads/employee_photos/${employeeFolder}/${fileName}`,
    absolutePath
  };
};

const readStreamToBufferWithLimit = async (stream, maxBytes) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };

    stream.on('data', (chunk) => {
      const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += bufferChunk.length;
      if (totalBytes > maxBytes) {
        stream.destroy(new Error('Employee photograph must be 2MB or smaller.'));
        return;
      }
      chunks.push(bufferChunk);
    });

    stream.once('end', () => {
      finish(null, Buffer.concat(chunks));
    });
    stream.once('error', (error) => {
      finish(error);
    });
  });
};

const saveEmployeePhotoDataUrlToLocalStorage = async (photoUrl, employeeId) => {
  const dataUrlMatch = getEmployeePhotoDataUrlMatch(photoUrl);
  if (!dataUrlMatch) {
    throw new Error('Employee photograph data URL is invalid.');
  }

  const mimeType = dataUrlMatch[1].toLowerCase();
  const encodedBody = dataUrlMatch[2].replace(/\s+/g, '');
  const byteLength = decodeBase64ByteLength(encodedBody);
  if (byteLength <= 0) {
    throw new Error('Employee photograph data is invalid.');
  }
  if (byteLength > MAX_EMPLOYEE_PHOTO_BYTES) {
    throw new Error('Employee photograph must be 2MB or smaller.');
  }

  const photoBuffer = Buffer.from(encodedBody, 'base64');
  return saveEmployeePhotoBufferToLocalStorage(photoBuffer, mimeType, employeeId);
};

const deleteLocalEmployeePhoto = async (photoUrl) => {
  const absolutePath = resolveLocalEmployeePhotoAbsolutePath(photoUrl);
  if (!absolutePath) return;
  try {
    await fsp.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

const prepareEmployeePhotoForPersistence = async (payload, employeeId) => {
  const normalizedPayload = {
    ...payload,
    personalInfo: {
      ...(payload?.personalInfo || {})
    }
  };

  const rawPhotoUrl = normalizedPayload.personalInfo?.photoUrl;
  if (typeof rawPhotoUrl !== 'string') {
    return {
      payload: normalizedPayload,
      createdPhotoUrl: null
    };
  }

  const trimmedPhotoUrl = rawPhotoUrl.trim();
  normalizedPayload.personalInfo.photoUrl = trimmedPhotoUrl;

  if (!trimmedPhotoUrl) {
    return {
      payload: normalizedPayload,
      createdPhotoUrl: null
    };
  }

  if (!getEmployeePhotoDataUrlMatch(trimmedPhotoUrl)) {
    return {
      payload: normalizedPayload,
      createdPhotoUrl: null
    };
  }

  const storedPhoto = await saveEmployeePhotoDataUrlToLocalStorage(trimmedPhotoUrl, employeeId);
  normalizedPayload.personalInfo.photoUrl = storedPhoto.photoUrl;
  return {
    payload: normalizedPayload,
    createdPhotoUrl: storedPhoto.photoUrl
  };
};

const getPhotoContentType = (filePath) => {
  const extension = path.extname(filePath || '').toLowerCase();
  return PHOTO_CONTENT_TYPE_BY_EXTENSION[extension] || 'application/octet-stream';
};

const validateEmployeePhoto = (photoUrl) => {
  if (photoUrl == null || photoUrl === '') {
    return null;
  }

  if (typeof photoUrl !== 'string') {
    return 'Please upload a valid image file.';
  }

  const trimmedPhotoUrl = photoUrl.trim();
  if (!trimmedPhotoUrl) {
    return null;
  }

  if (isLocalEmployeePhotoPath(trimmedPhotoUrl)) {
    return null;
  }

  if (/^https?:\/\/.+/i.test(trimmedPhotoUrl)) {
    return null;
  }

  const dataUrlMatch = getEmployeePhotoDataUrlMatch(trimmedPhotoUrl);
  if (!dataUrlMatch) {
    return 'The provided photograph URL or image data is not supported.';
  }

  const byteLength = decodeBase64ByteLength(dataUrlMatch[2]);
  if (byteLength <= 0) {
    return 'The photograph you uploaded appears to be corrupted or invalid.';
  }

  if (byteLength > MAX_EMPLOYEE_PHOTO_BYTES) {
    return 'Please upload a photograph smaller than 2MB.';
  }

  return null;
};

const validateEmployeeOfficialInfo = (officialInfo) => {
  if (!officialInfo || typeof officialInfo !== 'object') {
    return null;
  }

  const assignmentType = typeof officialInfo.assignmentType === 'string'
    ? officialInfo.assignmentType.trim()
    : '';

  if (assignmentType && !EMPLOYEE_ASSIGNMENT_TYPES.has(assignmentType)) {
    return 'Please select a valid assignment type.';
  }

  const requiresClientDetails = assignmentType === 'Client Billable';

  if (requiresClientDetails) {
    if (isBlank(officialInfo.clientName)) {
      return "Please specify the client's name.";
    }
    if (isBlank(officialInfo.clientLocation)) {
      return "Please specify the client's location.";
    }
    if (isBlank(officialInfo.managerName)) {
      return "Please provide the name of the manager.";
    }
    if (isBlank(officialInfo.projectDescription)) {
      return "Please include a project description.";
    }
    if (isBlank(officialInfo.assignmentDate)) {
      return "Please provide the assignment start date.";
    }
  }

  if (!isBlank(officialInfo.assignmentDate) && !ISO_DATE_PATTERN.test(String(officialInfo.assignmentDate).trim())) {
    return 'Please ensure the assignment date is valid.';
  }

  return null;
};

const validateEmployeePayload = (payload) => {
  const personalInfo = payload?.personalInfo || {};
  const officialInfo = payload?.officialInfo || {};

  const photoValidationError = validateEmployeePhoto(personalInfo?.photoUrl);
  if (photoValidationError) {
    return photoValidationError;
  }

  return validateEmployeeOfficialInfo(officialInfo);
};

const validateEmployeeFeedbackPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return 'Please provide the feedback details.';
  }

  const feedbackText = typeof payload.feedbackText === 'string'
    ? payload.feedbackText.trim()
    : '';
  if (!feedbackText) {
    return 'Please add some notes for this feedback entry.';
  }

  const feedbackCategory = typeof payload.feedbackCategory === 'string'
    ? payload.feedbackCategory.trim()
    : '';
  if (feedbackCategory && !EMPLOYEE_FEEDBACK_CATEGORIES.has(feedbackCategory)) {
    return 'Please select a valid feedback category.';
  }

  const sentiment = typeof payload.sentiment === 'string' ? payload.sentiment.trim() : '';
  if (sentiment && !['Positive', 'Neutral', 'Needs Attention'].includes(sentiment)) {
    return 'Please select a valid sentiment (Positive, Neutral, or Needs Attention).';
  }

  if (!isBlank(payload.feedbackDate) && !ISO_DATE_PATTERN.test(String(payload.feedbackDate).trim())) {
    return 'Please provide a valid date for the feedback.';
  }

  return null;
};

const buildServer = async () => {
  const app = Fastify({ logger: true });
  const provider = await getProvider(config);

  // Create authorization middleware bound to this provider instance
  const authorize = createAuthorize(() => provider);

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

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: MAX_EMPLOYEE_PHOTO_BYTES
    }
  });

  await fsp.mkdir(config.employeePhotoUploadDir, { recursive: true });

  app.get('/uploads/*', async (request, reply) => {
    const wildcardPath = typeof request.params?.['*'] === 'string'
      ? request.params['*']
      : '';

    if (!wildcardPath) {
      return reply.code(404).send({ error: 'File not found.' });
    }

    let decodedPath = '';
    try {
      decodedPath = decodeURIComponent(wildcardPath);
    } catch {
      return reply.code(400).send({ error: 'Invalid file path.' });
    }
    if (!decodedPath || decodedPath.includes('\0') || decodedPath.includes('..')) {
      return reply.code(400).send({ error: 'Invalid file path.' });
    }

    const absolutePath = path.resolve(config.uploadsRoot, decodedPath);
    if (!isPathInside(config.uploadsRoot, absolutePath)) {
      return reply.code(403).send({ error: 'Access denied.' });
    }

    try {
      const fileStat = await fsp.stat(absolutePath);
      if (!fileStat.isFile()) {
        return reply.code(404).send({ error: 'File not found.' });
      }
      reply.type(getPhotoContentType(absolutePath));
      return reply.send(fs.createReadStream(absolutePath));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return reply.code(404).send({ error: 'File not found.' });
      }
      request.log.error(error, 'Failed to serve uploaded file');
      return reply.code(500).send({ error: 'Failed to load file.' });
    }
  });

  app.get('/health', async () => ({ ok: true }));

  app.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required.' });
    }

    const user = await provider.getUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
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

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
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

    const payload = verifyAccessToken(token);
    if (!payload) {
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

    const payload = await verifyAccessToken(token);
    if (!payload) return null;
    const user = await provider.getUserById(payload.sub);
    return user || null;
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

  app.post('/locations', { preHandler: authorize('locations', 'create') }, async (request, reply) => {
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

  app.put('/locations/:id', { preHandler: authorize('locations', 'edit') }, async (request, reply) => {
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

  app.delete('/locations/:id', { preHandler: authorize('locations', 'delete') }, async (request, reply) => {
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

  app.post('/departments', { preHandler: authorize('departments', 'create') }, async (request, reply) => {
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

  app.put('/departments/:id', { preHandler: authorize('departments', 'edit') }, async (request, reply) => {
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

  app.delete('/departments/:id', { preHandler: authorize('departments', 'delete') }, async (request, reply) => {
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
    const { page, pageSize, search, type, status, locationId } = request.query || {};
    return provider.getAssetsPage({
      page: Number(page || 1),
      pageSize: Number(pageSize || 20),
      search,
      type,
      status,
      locationId
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

  app.post('/assets', { preHandler: authorize('assets', 'create') }, async (request, reply) => {
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

  app.put('/assets/:id', { preHandler: authorize('assets', 'edit') }, async (request, reply) => {
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

  app.delete('/assets/:id', { preHandler: authorize('assets', 'delete') }, async (request, reply) => {
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

  app.post('/assets/:id/comments', { preHandler: authorize('assets', 'edit') }, async (request, reply) => {
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

  app.post('/employees/:id/photo', { preHandler: authorize('employees.info', 'edit') }, async (request, reply) => {
    const employee = await provider.getEmployeeById(request.params.id);
    if (!employee) {
      return reply.code(404).send({ error: 'Employee not found.' });
    }

    let createdPhotoUrl = null;
    let previousPhotoToDelete = null;
    try {
      const photoPart = await request.file();
      if (!photoPart) {
        return reply.code(400).send({ error: 'Photo file is required.' });
      }

      const mimeType = String(photoPart.mimetype || '').toLowerCase();
      if (!mimeType.startsWith('image/')) {
        return reply.code(400).send({ error: 'Only image files are allowed.' });
      }

      const photoBuffer = await readStreamToBufferWithLimit(photoPart.file, MAX_EMPLOYEE_PHOTO_BYTES);
      if (!photoBuffer.length) {
        return reply.code(400).send({ error: 'Photo file is empty.' });
      }

      const storedPhoto = await saveEmployeePhotoBufferToLocalStorage(
        photoBuffer,
        mimeType,
        employee.employeeId || employee.id
      );
      createdPhotoUrl = storedPhoto.photoUrl;

      const previousPhotoUrl = employee.personalInfo?.photoUrl;
      if (isLocalEmployeePhotoPath(previousPhotoUrl) && previousPhotoUrl !== createdPhotoUrl) {
        previousPhotoToDelete = previousPhotoUrl;
      }

      const currentUser = await getRequestUser(request);
      const updatedEmployee = await provider.updateEmployee(
        {
          id: employee.id,
          employeeId: employee.employeeId,
          clientId: employee.clientId,
          locationId: employee.locationId,
          status: employee.status,
          personalInfo: {
            ...(employee.personalInfo || {}),
            firstName: employee.personalInfo?.firstName || employee.name || employee.employeeId || 'Employee',
            photoUrl: createdPhotoUrl
          },
          officialInfo: employee.officialInfo
        },
        currentUser
      );

      if (previousPhotoToDelete) {
        await deleteLocalEmployeePhoto(previousPhotoToDelete);
      }

      return reply.code(201).send({
        photoUrl: updatedEmployee?.personalInfo?.photoUrl || createdPhotoUrl,
        employee: updatedEmployee
      });
    } catch (error) {
      if (createdPhotoUrl) {
        await deleteLocalEmployeePhoto(createdPhotoUrl);
      }

      request.log.error(error, 'Employee photo upload failed');
      return reply.code(400).send({ error: error.message || 'Failed to upload employee photo.' });
    }
  });

  app.get('/employees/:id/feedback', async (request, reply) => {
    const currentUser = await getRequestUser(request);
    if (!currentUser) {
      return reply.code(401).send({ error: 'Authorization token missing or invalid.' });
    }

    try {
      const history = await provider.getEmployeeFeedbackHistory(request.params.id);
      return history;
    } catch (error) {
      const status = error.message === 'Employee not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  app.post('/employees/:id/feedback', { preHandler: authorize('employees.feedback', 'edit') }, async (request, reply) => {
    const currentUser = await getRequestUser(request);
    if (!currentUser) {
      return reply.code(401).send({ error: 'Authorization token missing or invalid.' });
    }

    const validationError = validateEmployeeFeedbackPayload(request.body);
    if (validationError) {
      return reply.code(400).send({ error: validationError });
    }

    try {
      const created = await provider.addEmployeeFeedback(request.params.id, request.body, currentUser);
      return reply.code(201).send(created);
    } catch (error) {
      const status = error.message === 'Employee not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  app.get('/employees/:id', async (request, reply) => {
    const employee = await provider.getEmployeeById(request.params.id);
    if (!employee) {
      return reply.code(404).send({ error: 'Employee not found.' });
    }
    return employee;
  });

  app.post('/employees', { preHandler: authorize('employees', 'create') }, async (request, reply) => {
    const { employeeId, personalInfo } = request.body || {};
    if (!employeeId) {
      return reply.code(400).send({ error: 'Employee ID is required.' });
    }
    if (!personalInfo?.firstName) {
      return reply.code(400).send({ error: 'Employee first name is required.' });
    }
    const validationError = validateEmployeePayload(request.body);
    if (validationError) {
      return reply.code(400).send({ error: validationError });
    }

    let createdPhotoUrl = null;
    try {
      const prepared = await prepareEmployeePhotoForPersistence(request.body, employeeId);
      createdPhotoUrl = prepared.createdPhotoUrl;
      const currentUser = await getRequestUser(request);
      const created = await provider.createEmployee(prepared.payload, currentUser);
      return reply.code(201).send(created);
    } catch (error) {
      if (createdPhotoUrl) {
        await deleteLocalEmployeePhoto(createdPhotoUrl);
      }
      return reply.code(400).send({ error: error.message });
    }
  });

  app.put('/employees/:id', { preHandler: authorize('employees.info', 'edit') }, async (request, reply) => {
    const { employeeId, personalInfo } = request.body || {};
    if (!employeeId) {
      return reply.code(400).send({ error: 'Employee ID is required.' });
    }
    if (!personalInfo?.firstName) {
      return reply.code(400).send({ error: 'Employee first name is required.' });
    }
    const validationError = validateEmployeePayload(request.body);
    if (validationError) {
      return reply.code(400).send({ error: validationError });
    }

    const existing = await provider.getEmployeeById(request.params.id);
    if (!existing) {
      return reply.code(404).send({ error: 'Employee not found' });
    }

    let createdPhotoUrl = null;
    let previousPhotoToDelete = null;
    try {
      const prepared = await prepareEmployeePhotoForPersistence(request.body, employeeId);
      createdPhotoUrl = prepared.createdPhotoUrl;

      const hasPhotoField = Object.prototype.hasOwnProperty.call(
        prepared.payload?.personalInfo || {},
        'photoUrl'
      );
      const previousPhotoUrl = existing.personalInfo?.photoUrl;
      const nextPhotoUrl = prepared.payload?.personalInfo?.photoUrl;
      if (hasPhotoField && isLocalEmployeePhotoPath(previousPhotoUrl) && previousPhotoUrl !== nextPhotoUrl) {
        previousPhotoToDelete = previousPhotoUrl;
      }

      const currentUser = await getRequestUser(request);
      const updated = await provider.updateEmployee(
        { ...prepared.payload, id: request.params.id },
        currentUser
      );
      if (previousPhotoToDelete) {
        await deleteLocalEmployeePhoto(previousPhotoToDelete);
      }
      return updated;
    } catch (error) {
      if (createdPhotoUrl) {
        await deleteLocalEmployeePhoto(createdPhotoUrl);
      }
      const status = error.message === 'Employee not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  app.delete('/employees/:id', { preHandler: authorize('employees', 'delete') }, async (request, reply) => {
    try {
      const existing = await provider.getEmployeeById(request.params.id);
      const localPhotoToDelete = isLocalEmployeePhotoPath(existing?.personalInfo?.photoUrl)
        ? existing.personalInfo.photoUrl
        : null;
      const currentUser = await getRequestUser(request);
      await provider.deleteEmployee(request.params.id, currentUser);
      if (localPhotoToDelete) {
        await deleteLocalEmployeePhoto(localPhotoToDelete);
      }
      return { ok: true };
    } catch (error) {
      const status = error.message === 'Employee not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  // ── Employee Salary Routes (RBAC: Admin + Management) ──

  app.get('/salaries/latest', { preHandler: authorize('employees.salary', 'view') }, async (request, reply) => {
    try {
      const records = await provider.getLatestSalaries();
      return records;
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get('/employees/:id/salary', { preHandler: authorize('employees.salary', 'view') }, async (request, reply) => {
    try {
      const records = await provider.getEmployeeSalary(request.params.id);
      return records;
    } catch (error) {
      const status = error.message === 'Employee not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  app.post('/employees/:id/salary', { preHandler: authorize('employees.salary', 'edit') }, async (request, reply) => {
    try {
      const created = await provider.addEmployeeSalary(
        request.params.id,
        request.body,
        request.currentUser
      );
      return reply.code(201).send(created);
    } catch (error) {
      const status = error.message === 'Employee not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  app.put('/salary/:id', { preHandler: authorize('employees.salary', 'edit') }, async (request, reply) => {
    try {
      const updated = await provider.updateEmployeeSalary(request.params.id, request.body);
      return updated;
    } catch (error) {
      const status = error.message === 'Salary record not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  app.delete('/salary/:id', { preHandler: authorize('employees.salary', 'delete') }, async (request, reply) => {
    try {
      await provider.deleteEmployeeSalary(request.params.id);
      return { ok: true };
    } catch (error) {
      const status = error.message === 'Salary record not found' ? 404 : 400;
      return reply.code(status).send({ error: error.message });
    }
  });

  app.get('/users', { preHandler: authorize('users', 'view') }, async (request) => {
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

  app.post('/users', { preHandler: authorize('users', 'create') }, async (request, reply) => {
    const { name, email, role, status, password } = request.body || {};
    if (!name || !email || !role || !status || !password) {
      return reply.code(400).send({ error: 'Name, email, role, status, and password are required.' });
    }

    try {
      const created = await provider.createUser(
        { name, email, role, status },
        password,
        request.currentUser
      );
      return reply.code(201).send(sanitizeUser(created));
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.put('/users/:id', { preHandler: authorize('users', 'edit') }, async (request, reply) => {
    const { name, email, role, status } = request.body || {};
    if (!name || !email || !role || !status) {
      return reply.code(400).send({ error: 'Name, email, role, and status are required.' });
    }

    try {
      const updated = await provider.updateUser(
        { id: request.params.id, name, email, role, status },
        request.currentUser
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

  app.post('/users/:id/reset-password', { preHandler: authorize('users', 'edit') }, async (request, reply) => {
    const { passwordOption } = request.body || {};

    try {
      const temporaryPassword = await provider.resetUserPassword(
        request.params.id,
        request.currentUser,
        passwordOption
      );
      return { temporaryPassword };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.delete('/users/:id', { preHandler: authorize('users', 'delete') }, async (request, reply) => {
    try {
      await provider.deleteUser(request.params.id, request.currentUser);
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

export { buildServer, start };

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
