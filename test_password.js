/**
 * Script to test password hashing
 */

import crypto from 'crypto';

function hashPassword(password) {
  const hash = crypto.createHash('sha256');
  hash.update(password);
  return hash.digest('hex');
}

const storedHash = 'f61eb2944b53ed2b9461c6f04d2a98f2bbb44527fe444ac3445c0a470df01091';

function isSha256Hash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

console.log('Testing password hashing...');
console.log('Stored hash:', storedHash);
console.log('Is SHA-256 hash:', isSha256Hash(storedHash));
console.log('Length:', storedHash.length);

const passwordsToTest = ['admin123', 'Admin123', 'Admin@123', 'admin', 'password', '123456', 'admin123!', 'Admin123!', 'administrator', 'default', 'test123', 'welcome123'];

console.log('\nTesting hashed passwords:');
for (const password of passwordsToTest) {
  const hash = hashPassword(password);
  const matches = hash === storedHash;
  console.log(`Password: "${password}" -> ${matches ? 'MATCH!' : 'no match'}`);
  if (matches) {
    console.log('✅ Found matching password!');
    break;
  }
}

console.log('\nTesting plain text comparison (fallback logic):');
for (const password of passwordsToTest) {
  const matches = password === storedHash;
  console.log(`Password: "${password}" -> ${matches ? 'MATCH!' : 'no match'}`);
  if (matches) {
    console.log('✅ Found matching password (plain text)!');
    break;
  }
}