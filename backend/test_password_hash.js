/**
 * Test script to verify password hash
 */

// The hash from the database
const storedHash = "459ec8dde061aa0a170834b75987383655ab48f8df4a35cb50c5a99965a1aced";

// Common test passwords to check
const testPasswords = [
  "admin123",
  "user123", 
  "password",
  "123456",
  "babu123",
  "trackit123",
  "admin",
  "user"
];

// Simple SHA-256 hash function for testing
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

console.log('Testing password hash:', storedHash);
console.log('Testing common passwords...\n');

async function testPasswordHashes() {
  for (const password of testPasswords) {
    const hash = await hashPassword(password);
    if (hash === storedHash) {
      console.log(`✅ Found match! Password: "${password}"`);
      return;
    } else {
      console.log(`❌ ${password}: ${hash}`);
    }
  }
  console.log('\nNo common password matches found.');
}

testPasswordHashes();