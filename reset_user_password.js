/**
 * Test script to reset user password and verify login
 */

import { getSupabaseClient } from './services/supabaseClient.js';
import { hashPassword } from './services/passwordUtil.js';

async function resetUserPassword() {
  try {
    console.log('Resetting password for user: babu@gmail.com');
    
    // Generate a new password
    const newPassword = 'babu123';
    console.log('New password:', newPassword);
    
    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    console.log('Hashed password:', hashedPassword);
    
    // Update the user's password in the database
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('email', 'babu@gmail.com');
    
    if (error) {
      console.error('Error updating password:', error);
      return;
    }
    
    console.log('✅ Password updated successfully!');
    console.log('User can now login with:');
    console.log('Email: babu@gmail.com');
    console.log('Password:', newPassword);
    
    // Test the login with the new password
    console.log('\nTesting login with new password...');
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'babu@gmail.com')
      .single();
    
    if (fetchError) {
      console.error('Error fetching user:', fetchError);
      return;
    }
    
    console.log('User found:', user.name);
    console.log('Password hash stored:', user.password_hash);
    
    // Verify the hash matches
    const testHash = await hashPassword(newPassword);
    if (testHash === user.password_hash) {
      console.log('✅ Password hash verification successful!');
    } else {
      console.log('❌ Password hash verification failed!');
    }
    
  } catch (error) {
    console.error('Error resetting password:', error);
  }
}

resetUserPassword();