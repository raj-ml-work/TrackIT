/**
 * Employee Personal Info Service
 * 
 * Handles all database operations for Employee Personal Information
 */

import { EmployeePersonalInfo } from '../types';
import { getSupabaseClient } from './supabaseClient';

const TABLE_NAME = 'employee_personal_info';

/**
 * Get personal info by ID
 */
export const getEmployeePersonalInfoById = async (id: string): Promise<EmployeePersonalInfo | null> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return transformPersonalInfoFromDB(data);
  } catch (error) {
    console.error('Error fetching employee personal info:', error);
    throw error;
  }
};

/**
 * Create personal info
 */
export const createEmployeePersonalInfo = async (personalInfo: Omit<EmployeePersonalInfo, 'id'>): Promise<EmployeePersonalInfo> => {
  try {
    const supabase = await getSupabaseClient();
    const personalInfoData = transformPersonalInfoToDB(personalInfo);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(personalInfoData)
      .select()
      .single();

    if (error) throw error;

    return transformPersonalInfoFromDB(data);
  } catch (error) {
    console.error('Error creating employee personal info:', error);
    throw error;
  }
};

/**
 * Update personal info
 */
export const updateEmployeePersonalInfo = async (personalInfo: EmployeePersonalInfo): Promise<EmployeePersonalInfo> => {
  try {
    const supabase = await getSupabaseClient();
    const personalInfoData = transformPersonalInfoToDB(personalInfo);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(personalInfoData)
      .eq('id', personalInfo.id)
      .select()
      .single();

    if (error) throw error;

    return transformPersonalInfoFromDB(data);
  } catch (error) {
    console.error('Error updating employee personal info:', error);
    throw error;
  }
};

/**
 * Delete personal info
 */
export const deleteEmployeePersonalInfo = async (id: string): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting employee personal info:', error);
    throw error;
  }
};

/**
 * Transform database format to app format
 */
const transformPersonalInfoFromDB = (dbPersonalInfo: any): EmployeePersonalInfo => {
  return {
    id: dbPersonalInfo.id,
    firstName: dbPersonalInfo.first_name,
    lastName: dbPersonalInfo.last_name,
    gender: dbPersonalInfo.gender,
    mobileNumber: dbPersonalInfo.mobile_number,
    emergencyContactName: dbPersonalInfo.emergency_contact_name,
    emergencyContactNumber: dbPersonalInfo.emergency_contact_number,
    personalEmail: dbPersonalInfo.personal_email,
    linkedinUrl: dbPersonalInfo.linkedin_url,
    additionalComments: dbPersonalInfo.additional_comments
  };
};

/**
 * Transform app format to database format
 */
const transformPersonalInfoToDB = (personalInfo: EmployeePersonalInfo | Omit<EmployeePersonalInfo, 'id'>): any => {
  return {
    id: 'id' in personalInfo ? personalInfo.id : undefined,
    first_name: personalInfo.firstName,
    last_name: personalInfo.lastName || null,
    gender: personalInfo.gender || null,
    mobile_number: personalInfo.mobileNumber || null,
    emergency_contact_name: personalInfo.emergencyContactName || null,
    emergency_contact_number: personalInfo.emergencyContactNumber || null,
    personal_email: personalInfo.personalEmail || null,
    linkedin_url: personalInfo.linkedinUrl || null,
    additional_comments: personalInfo.additionalComments || null
  };
};


