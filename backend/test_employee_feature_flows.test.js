import fs from 'fs';
import path from 'path';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'crypto';
import { promises as fsp } from 'fs';

const runId = `${Date.now()}-${randomUUID()}`;
const testRootDir = path.resolve('data', `employee_feature_test_${runId}`);
const testDbPath = path.resolve(testRootDir, 'employee_feature_test.db');
const uploadsRoot = path.resolve(testRootDir, 'uploads');

process.env.NODE_ENV = 'test';
process.env.DB_PROVIDER = 'sqlite';
process.env.SQLITE_PATH = testDbPath;
process.env.UPLOADS_ROOT = uploadsRoot;
process.env.EMPLOYEE_PHOTO_UPLOAD_DIR = path.resolve(uploadsRoot, 'employee_photos');
process.env.CORS_ORIGIN = 'http://localhost:5173';

const { buildServer } = await import('./src/index.js');

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
const TINY_PNG_DATA_URL = `data:image/png;base64,${TINY_PNG_BASE64}`;
const SECOND_TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAQAAAD8fJRsAAAADUlEQVR4nGP8z/D/PwAHgwJ/lXvSxwAAAABJRU5ErkJggg==';
const SECOND_TINY_PNG_DATA_URL = `data:image/png;base64,${SECOND_TINY_PNG_BASE64}`;

const buildEmployeePayload = (employeeId, photoUrl) => ({
  employeeId,
  status: 'Active',
  locationId: undefined,
  personalInfo: {
    firstName: 'Test',
    lastName: 'Employee',
    gender: 'Other',
    mobileNumber: '+10000000000',
    emergencyContactName: 'Emergency Contact',
    emergencyContactNumber: '+10000000001',
    personalEmail: `${employeeId.toLowerCase()}@example.com`,
    photoUrl
  },
  officialInfo: {
    division: 'Engineering',
    officialEmail: `${employeeId.toLowerCase()}@company.com`,
    assignmentType: 'Bench'
  }
});

const resolveUploadAbsolutePath = (photoUrl) => {
  if (!photoUrl || !photoUrl.startsWith('/uploads/')) return null;
  return path.resolve(uploadsRoot, photoUrl.slice('/uploads/'.length));
};

const buildMultipartPayload = (fieldName, filename, mimeType, fileBuffer) => {
  const boundary = `----TrackITBoundary${Date.now()}${Math.random().toString(16).slice(2)}`;
  const prefix = Buffer.from(
    `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n`
      + `Content-Type: ${mimeType}\r\n\r\n`,
    'utf8'
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return {
    boundary,
    payload: Buffer.concat([prefix, fileBuffer, suffix])
  };
};

let app;

before(async () => {
  await fsp.mkdir(testRootDir, { recursive: true });
  app = await buildServer();
  await app.ready();
});

after(async () => {
  if (app) {
    await app.close();
  }
  await fsp.rm(testRootDir, { recursive: true, force: true });
});

test('employee create/update converts photo data URL to local path and cleans old files', async () => {
  const createResponse = await app.inject({
    method: 'POST',
    url: '/employees',
    payload: buildEmployeePayload('EMP-PHOTO-001', TINY_PNG_DATA_URL)
  });

  assert.equal(createResponse.statusCode, 201, createResponse.body);
  const created = createResponse.json();
  assert.equal(created.employeeId, 'EMP-PHOTO-001');
  assert.ok(created.personalInfo?.photoUrl?.startsWith('/uploads/employee_photos/'));

  const createdPhotoPath = resolveUploadAbsolutePath(created.personalInfo.photoUrl);
  assert.ok(createdPhotoPath, 'Created photo path should resolve');
  assert.equal(fs.existsSync(createdPhotoPath), true, 'Created photo file should exist');

  const uploadedPhotoResponse = await app.inject({
    method: 'GET',
    url: created.personalInfo.photoUrl
  });
  assert.equal(uploadedPhotoResponse.statusCode, 200);
  assert.match(String(uploadedPhotoResponse.headers['content-type'] || ''), /^image\//);

  const updatePayload = {
    ...created,
    personalInfo: {
      ...created.personalInfo,
      firstName: created.personalInfo.firstName,
      photoUrl: SECOND_TINY_PNG_DATA_URL
    }
  };
  const updateResponse = await app.inject({
    method: 'PUT',
    url: `/employees/${created.id}`,
    payload: updatePayload
  });

  assert.equal(updateResponse.statusCode, 200, updateResponse.body);
  const updated = updateResponse.json();
  assert.ok(updated.personalInfo?.photoUrl?.startsWith('/uploads/employee_photos/'));
  assert.notEqual(updated.personalInfo.photoUrl, created.personalInfo.photoUrl);

  const updatedPhotoPath = resolveUploadAbsolutePath(updated.personalInfo.photoUrl);
  assert.ok(updatedPhotoPath, 'Updated photo path should resolve');
  assert.equal(fs.existsSync(updatedPhotoPath), true, 'Updated photo file should exist');
  assert.equal(
    fs.existsSync(createdPhotoPath),
    false,
    'Old photo file should be deleted after replacement'
  );

  const removePhotoPayload = {
    ...updated,
    personalInfo: {
      ...updated.personalInfo,
      firstName: updated.personalInfo.firstName,
      photoUrl: ''
    }
  };
  const removePhotoResponse = await app.inject({
    method: 'PUT',
    url: `/employees/${updated.id}`,
    payload: removePhotoPayload
  });
  assert.equal(removePhotoResponse.statusCode, 200, removePhotoResponse.body);
  const removed = removePhotoResponse.json();
  assert.ok(!removed.personalInfo?.photoUrl, 'Photo URL should be cleared');
  assert.equal(
    fs.existsSync(updatedPhotoPath),
    false,
    'Previous local photo should be deleted after photo removal'
  );
});

test('multipart photo upload endpoint stores local file path', async () => {
  const createResponse = await app.inject({
    method: 'POST',
    url: '/employees',
    payload: buildEmployeePayload('EMP-PHOTO-002', '')
  });
  assert.equal(createResponse.statusCode, 201, createResponse.body);
  const created = createResponse.json();

  const multipart = buildMultipartPayload(
    'photo',
    'employee-photo.png',
    'image/png',
    Buffer.from(TINY_PNG_BASE64, 'base64')
  );
  const uploadResponse = await app.inject({
    method: 'POST',
    url: `/employees/${created.id}/photo`,
    headers: {
      'content-type': `multipart/form-data; boundary=${multipart.boundary}`
    },
    payload: multipart.payload
  });

  assert.equal(uploadResponse.statusCode, 201, uploadResponse.body);
  const uploadResult = uploadResponse.json();
  assert.ok(uploadResult.photoUrl?.startsWith('/uploads/employee_photos/'));

  const uploadedPath = resolveUploadAbsolutePath(uploadResult.photoUrl);
  assert.ok(uploadedPath);
  assert.equal(fs.existsSync(uploadedPath), true);
});

test('employee validation rejects invalid assignment type and unsafe upload path', async () => {
  const invalidAssignmentResponse = await app.inject({
    method: 'POST',
    url: '/employees',
    payload: {
      ...buildEmployeePayload('EMP-PHOTO-003', ''),
      officialInfo: {
        division: 'Engineering',
        officialEmail: 'emp-photo-003@company.com',
        assignmentType: 'Invalid Assignment'
      }
    }
  });

  assert.equal(invalidAssignmentResponse.statusCode, 400);
  assert.match(
    invalidAssignmentResponse.body,
    /Assignment type must be one of: Client Billable, Bench, Support/
  );

  const unsafePathResponse = await app.inject({
    method: 'POST',
    url: '/employees',
    payload: {
      ...buildEmployeePayload('EMP-PHOTO-004', '/uploads/../../etc/passwd')
    }
  });
  assert.equal(unsafePathResponse.statusCode, 400);
  assert.match(unsafePathResponse.body, /Employee photograph must be/i);
});

test('support assignment allows missing client fields while client billable requires them', async () => {
  const supportAssignmentResponse = await app.inject({
    method: 'POST',
    url: '/employees',
    payload: {
      ...buildEmployeePayload('EMP-PHOTO-005', ''),
      officialInfo: {
        division: 'Engineering',
        officialEmail: 'emp-photo-005@company.com',
        assignmentType: 'Support'
      }
    }
  });

  assert.equal(supportAssignmentResponse.statusCode, 201, supportAssignmentResponse.body);

  const clientBillableMissingClientResponse = await app.inject({
    method: 'POST',
    url: '/employees',
    payload: {
      ...buildEmployeePayload('EMP-PHOTO-006', ''),
      officialInfo: {
        division: 'Engineering',
        officialEmail: 'emp-photo-006@company.com',
        assignmentType: 'Client Billable'
      }
    }
  });

  assert.equal(clientBillableMissingClientResponse.statusCode, 400);
  assert.match(
    clientBillableMissingClientResponse.body,
    /Client name is required for Client Billable assignment/
  );
});
