/**
 * Department Service Test
 * 
 * Simple test to verify department CRUD operations work with the backend
 */

import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from './services/departmentService';

async function testDepartmentCRUD() {
  console.log('Starting Department CRUD Test...');

  try {
    // Test 1: Create a department
    console.log('\n1. Testing createDepartment...');
    const newDepartment = {
      name: 'Test Department',
      description: 'This is a test department for CRUD operations'
    };
    
    const created = await createDepartment(newDepartment);
    console.log('✓ Department created:', created);
    
    if (!created || !created.id) {
      throw new Error('Created department is missing ID');
    }

    // Test 2: Get all departments
    console.log('\n2. Testing getDepartments...');
    const departments = await getDepartments();
    console.log('✓ Departments retrieved:', departments.length);
    
    const testDepartment = departments.find(d => d.id === created.id);
    if (!testDepartment) {
      throw new Error('Created department not found in list');
    }

    // Test 3: Update the department
    console.log('\n3. Testing updateDepartment...');
    const updatedDepartment = {
      ...created,
      name: 'Updated Test Department',
      description: 'This department has been updated'
    };
    
    const updated = await updateDepartment(updatedDepartment);
    console.log('✓ Department updated:', updated);
    
    if (updated.name !== 'Updated Test Department') {
      throw new Error('Department name was not updated correctly');
    }

    // Test 4: Delete the department
    console.log('\n4. Testing deleteDepartment...');
    await deleteDepartment(updated.id);
    console.log('✓ Department deleted');
    
    // Verify deletion
    const departmentsAfterDelete = await getDepartments();
    const deletedDepartment = departmentsAfterDelete.find(d => d.id === updated.id);
    
    if (deletedDepartment) {
      throw new Error('Department still exists after deletion');
    }
    
    console.log('✓ Department deletion verified');

    console.log('\n🎉 All Department CRUD tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Department CRUD test failed:', error);
    return false;
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDepartmentCRUD().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testDepartmentCRUD };