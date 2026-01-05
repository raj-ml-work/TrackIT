import { EmployeePersonalInfo, Gender } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { isSupabaseConfigured } from './database';

/**
 * Create a new employee personal info record
 */
export const createEmployeePersonalInfo = async (
  personalInfo: Omit<EmployeePersonalInfo, 'id'>
): Promise<EmployeePersonalInfo> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      ...personalInfo,
      id: `personal-${Date.now()}`
    } as EmployeePersonalInfo;
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('personal_info')
    .insert({
      first_name: personalInfo.firstName,
      last_name: personalInfo.lastName,
      gender: personalInfo.gender,
      mobile_number: personalInfo.mobileNumber,
      emergency_contact_name: personalInfo.emergencyContactName,
      emergency_contact_number: personalInfo.emergencyContactNumber,
      personal_email: personalInfo.personalEmail,
      linkedin_url: personalInfo.linkedinUrl,
      additional_comments: personalInfo.additionalComments
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating employee personal info:', error);
    throw new Error('Failed to create employee personal info');
  }

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    gender: data.gender as Gender,
    mobileNumber: data.mobile_number,
    emergencyContactName: data.emergency_contact_name,
    emergencyContactNumber: data.emergency_contact_number,
    personalEmail: data.personal_email,
    linkedinUrl: data.linkedin_url,
    additionalComments: data.additional_comments
  };
};

/**
 * Get employee personal info by ID
 */
export const getEmployeePersonalInfo = async (id: string): Promise<EmployeePersonalInfo | null> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      id,
      firstName: 'John',
      lastName: 'Doe',
      gender: 'Male',
      mobileNumber: '123-456-7890',
      emergencyContactName: 'Jane Doe',
      emergencyContactNumber: '098-765-4321',
      personalEmail: 'john.doe@example.com',
      linkedinUrl: 'https://linkedin.com/in/johndoe',
      additionalComments: 'Additional comments'
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('personal_info')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching employee personal info:', error);
    throw new Error('Failed to fetch employee personal info');
  }

  if (!data) return null;

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    gender: data.gender as Gender,
    mobileNumber: data.mobile_number,
    emergencyContactName: data.emergency_contact_name,
    emergencyContactNumber: data.emergency_contact_number,
    personalEmail: data.personal_email,
    linkedinUrl: data.linkedin_url,
    additionalComments: data.additional_comments
  };
};

/**
 * Update employee personal info
 */
export const updateEmployeePersonalInfo = async (
  id: string,
  updates: Partial<EmployeePersonalInfo>
): Promise<EmployeePersonalInfo> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      id,
      firstName: updates.firstName || 'John',
      lastName: updates.lastName || 'Doe',
      gender: updates.gender || 'Male',
      mobileNumber: updates.mobileNumber || '123-456-7890',
      emergencyContactName: updates.emergencyContactName || 'Jane Doe',
      emergencyContactNumber: updates.emergencyContactNumber || '098-765-4321',
      personalEmail: updates.personalEmail || 'john.doe@example.com',
      linkedinUrl: updates.linkedinUrl || 'https://linkedin.com/in/johndoe',
      additionalComments: updates.additionalComments || 'Additional comments'
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('personal_info')
    .update({
      first_name: updates.firstName,
      last_name: updates.lastName,
      gender: updates.gender,
      mobile_number: updates.mobileNumber,
      emergency_contact_name: updates.emergencyContactName,
      emergency_contact_number: updates.emergencyContactNumber,
      personal_email: updates.personalEmail,
      linkedin_url: updates.linkedinUrl,
      additional_comments: updates.additionalComments
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating employee personal info:', error);
    throw new Error('Failed to update employee personal info');
  }

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    gender: data.gender as Gender,
    mobileNumber: data.mobile_number,
    emergencyContactName: data.emergency_contact_name,
    emergencyContactNumber: data.emergency_contact_number,
    personalEmail: data.personal_email,
    linkedinUrl: data.linkedin_url,
    additionalComments: data.additional_comments
  };
};

/**
 * Delete employee personal info
 */
export const deleteEmployeePersonalInfo = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return;
  }

  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from('personal_info')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting employee personal info:', error);
    throw new Error('Failed to delete employee personal info');
  }
};
