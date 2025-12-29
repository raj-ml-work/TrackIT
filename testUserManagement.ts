import { UserRole, UserStatus, UserAccount } from './types';
import { canView, canCreateOrUpdate, canDelete, canManageUsers } from './services/permissionUtil';

// Test cases for user management permissions
const testCases = [
  {
    name: "Normal User - View Only",
    user: { id: '1', name: 'Normal User', email: 'normal@example.com', role: UserRole.NORMAL_USER, status: UserStatus.ACTIVE, lastLogin: '' },
    expected: {
      canView: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canManageUsers: false
    }
  },
  {
    name: "Power User - Create and Update",
    user: { id: '2', name: 'Power User', email: 'power@example.com', role: UserRole.POWER_USER, status: UserStatus.ACTIVE, lastLogin: '' },
    expected: {
      canView: true,
      canCreate: true,
      canUpdate: true,
      canDelete: false,
      canManageUsers: false
    }
  },
  {
    name: "Admin - Full Access",
    user: { id: '3', name: 'Admin', email: 'admin@example.com', role: UserRole.ADMIN, status: UserStatus.ACTIVE, lastLogin: '' },
    expected: {
      canView: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canManageUsers: true
    }
  },
  {
    name: "Inactive User - No Access",
    user: { id: '4', name: 'Inactive Admin', email: 'inactive@example.com', role: UserRole.ADMIN, status: UserStatus.INACTIVE, lastLogin: '' },
    expected: {
      canView: true, // Inactive users can still view (they're just not active)
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canManageUsers: false
    }
  },
  {
    name: "Null User - No Access",
    user: null,
    expected: {
      canView: false,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canManageUsers: false
    }
  }
];

// Run tests
console.log('Running User Management Permission Tests...\n');

testCases.forEach(testCase => {
  console.log(`Test: ${testCase.name}`);
  console.log(`User: ${testCase.user ? `${testCase.user.role} (${testCase.user.status})` : 'null'}`);
  
  const canViewResult = canView(testCase.user);
  const canCreateResult = canCreateOrUpdate(testCase.user);
  const canUpdateResult = canCreateOrUpdate(testCase.user);
  const canDeleteResult = canDelete(testCase.user);
  const canManageUsersResult = canManageUsers(testCase.user);
  
  const results = {
    canView: canViewResult,
    canCreate: canCreateResult,
    canUpdate: canUpdateResult,
    canDelete: canDeleteResult,
    canManageUsers: canManageUsersResult
  };
  
  // Check if results match expected
  const passed = Object.keys(testCase.expected).every(key =>
    results[key as keyof typeof results] === testCase.expected[key as keyof typeof testCase.expected]
  );
  
  console.log(`Results: ${JSON.stringify(results, null, 2)}`);
  console.log(`Expected: ${JSON.stringify(testCase.expected, null, 2)}`);
  console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}\n`);
});

console.log('User Management Permission Tests Complete.');