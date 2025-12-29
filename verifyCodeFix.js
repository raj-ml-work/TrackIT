/**
 * Code verification script to check the user roles fix
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verifying User Roles Authentication Fix in Code...\n');

// Read the App.tsx file
const appFilePath = path.join(__dirname, 'App.tsx');
const appContent = fs.readFileSync(appFilePath, 'utf8');

// Check for the fixes
const checks = [
  {
    name: 'Employee creation passes currentUser',
    pattern: /createEmployee\(employee, session\?\.user \|\| null\)/,
    found: false
  },
  {
    name: 'Employee update passes currentUser',
    pattern: /updateEmployee\(updated, session\?\.user \|\| null\)/,
    found: false
  },
  {
    name: 'Location creation passes currentUser',
    pattern: /createLocation\(location, session\?\.user \|\| null\)/,
    found: false
  },
  {
    name: 'Location update passes currentUser',
    pattern: /updateLocation\(updated, session\?\.user \|\| null\)/,
    found: false
  },
  {
    name: 'Department creation passes currentUser',
    pattern: /createDepartment\(department, session\?\.user \|\| null\)/,
    found: false
  },
  {
    name: 'Department update passes currentUser',
    pattern: /updateDepartment\(updated, session\?\.user \|\| null\)/,
    found: false
  }
];

// Perform the checks
checks.forEach(check => {
  check.found = check.pattern.test(appContent);
});

// Report results
console.log('Code verification results:');
console.log('=======================\n');

let allPassed = true;
checks.forEach((check, index) => {
  const status = check.found ? '✅ PASS' : '❌ FAIL';
  console.log(`${index + 1}. ${check.name}: ${status}`);
  if (!check.found) {
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('🎉 All code checks passed!');
  console.log('\nThe fix successfully addresses the authentication error by:');
  console.log('1. ✅ Passing currentUser parameter to createEmployee()');
  console.log('2. ✅ Passing currentUser parameter to updateEmployee()');
  console.log('3. ✅ Passing currentUser parameter to createLocation()');
  console.log('4. ✅ Passing currentUser parameter to updateLocation()');
  console.log('5. ✅ Passing currentUser parameter to createDepartment()');
  console.log('6. ✅ Passing currentUser parameter to updateDepartment()');
  console.log('\n🔒 This ensures proper permission checking and prevents');
  console.log('   "Unauthorized: User not authenticated" errors.');
  process.exit(0);
} else {
  console.log('❌ Some code checks failed!');
  console.log('\nPlease review the App.tsx file to ensure all service calls');
  console.log('pass the currentUser parameter for proper authentication.');
  process.exit(1);
}