/**
 * Test script to verify login functionality after fixes
 */

import { getSupabaseClient } from './services/supabaseClient.js';
import { hashPassword } from './services/passwordUtil.js';

async function testLoginFunctionality() {
  try {
    console.log('Testing login functionality...\n');
    
    // Test 1: Verify database connection
    console.log('1. Testing database connection...');
    const supabase = await getSupabaseClient();
    const { data: testUsers, error: testError } = await supabase
      .from('users')
      .select('id, name, email, password_hash')
      .limit(1);
    
    if (testError) {
      console.error('❌ Database connection failed:', testError);
      return;
    }
    
    console.log('✅ Database connection successful');
    console.log('Found users:', testUsers.length);
    
    // Test 2: Test login with the new password
    console.log('\n2. Testing login with new password...');
    const testEmail = 'babu@gmail.com';
    const testPassword = 'babu123';
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', testEmail)
      .single();
    
    if (userError) {
      console.error('❌ User not found:', userError);
      return;
    }
    
    console.log('✅ User found:', user.name);
    console.log('User email:', user.email);
    console.log('User status:', user.status);
    
    // Test 3: Verify password hash comparison
    console.log('\n3. Testing password hash verification...');
    const hashedInput = await hashPassword(testPassword);
    console.log('Input password hash:', hashedInput);
    console.log('Stored password hash:', user.password_hash);
    
    const isPasswordValid = user.password_hash === hashedInput;
    console.log('Password match:', isPasswordValid ? '✅ YES' : '❌ NO');
    
    if (!isPasswordValid) {
      console.log('❌ Password verification failed - login will fail');
      return;
    }
    
    // Test 4: Simulate the complete login flow
    console.log('\n4. Simulating complete login flow...');
    
    // Check if user is active
    if (user.status === 'Inactive') {
      console.log('❌ User is inactive - login will fail');
      return;
    }
    
    // Simulate successful login
    console.log('✅ Login simulation successful!');
    console.log('User would be logged in with:');
    console.log('- Name:', user.name);
    console.log('- Email:', user.email);
    console.log('- Role:', user.role);
    console.log('- Status:', user.status);
    
    // Test 5: Test with wrong password
    console.log('\n5. Testing with wrong password...');
    const wrongPassword = 'wrongpassword';
    const wrongHash = await hashPassword(wrongPassword);
    const isWrongPasswordValid = user.password_hash === wrongHash;
    console.log('Wrong password match:', isWrongPasswordValid ? '❌ YES (security issue!)' : '✅ NO (correct)');
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\nTo test in the UI:');
    console.log('Email: babu@gmail.com');
    console.log('Password: babu123');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testLoginFunctionality();