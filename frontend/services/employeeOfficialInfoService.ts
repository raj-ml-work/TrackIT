/**
 * Employee Official Info Service
 * 
 * Handles all database operations for Employee Official Information
 */

import { EmployeeOfficialInfo } from '../types';
import { getSupabaseClient } from './supabaseClient';

const TABLE_NAME = 'employee_official_info';

/**
 * Get official info by ID
 */
export const getEmployeeOfficialInfoById = async (id: string): Promise<EmployeeOfficialInfo | null> => {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return transformOfficialInfoFromDB(data);
  } catch (error) {
    console.error('Error fetching employee official info:', error);
    throw error;
  }
};

/**
 * Create official info
 */
export const createEmployeeOfficialInfo = async (officialInfo: Omit<EmployeeOfficialInfo, 'id'>): Promise<EmployeeOfficialInfo> => {
  try {
    const supabase = await getSupabaseClient();
    const officialInfoData = transformOfficialInfoToDB(officialInfo);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(officialInfoData)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Unable to save official details. Please try again.');
      }
      throw error;
    }
    if (!data) {
      throw new Error('Unable to save official details. Please try again.');
    }

    return transformOfficialInfoFromDB(data);
  } catch (error) {
    console.error('Error creating employee official info:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unable to save official details. Please try again.');
  }
};

/**
 * Update official info
 */
export const updateEmployeeOfficialInfo = async (officialInfo: EmployeeOfficialInfo): Promise<EmployeeOfficialInfo> => {
  try {
    const supabase = await getSupabaseClient();
    const officialInfoData = transformOfficialInfoToDB(officialInfo);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update(officialInfoData)
      .eq('id', officialInfo.id)
      .select()
      .single();

    if (error) throw error;

    return transformOfficialInfoFromDB(data);
  } catch (error) {
    console.error('Error updating employee official info:', error);
    throw error;
  }
};

/**
 * Delete official info
 */
export const deleteEmployeeOfficialInfo = async (id: string): Promise<void> => {
  try {
    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting employee official info:', error);
    throw error;
  }
};

/**
 * Transform database format to app format
 */
const transformOfficialInfoFromDB = (dbOfficialInfo: any): EmployeeOfficialInfo => {
  return {
    id: dbOfficialInfo.id,
    division: dbOfficialInfo.division,
    biometricId: dbOfficialInfo.biometric_id,
    rfidSerial: dbOfficialInfo.rfid_serial,
    agreementSigned: dbOfficialInfo.agreement_signed || false,
    startDate: dbOfficialInfo.start_date,
    officialDob: dbOfficialInfo.official_dob,
    officialEmail: dbOfficialInfo.official_email,
    assignmentType: dbOfficialInfo.assignment_type,
    clientName: dbOfficialInfo.client_name,
    clientLocation: dbOfficialInfo.client_location,
    managerName: dbOfficialInfo.manager_name,
    directorName: dbOfficialInfo.director_name,
    projectDescription: dbOfficialInfo.project_description,
    clientWorkNotes: dbOfficialInfo.client_work_notes,
    assignmentDate: dbOfficialInfo.assignment_date
  };
};

/**
 * Transform app format to database format
 */
const transformOfficialInfoToDB = (officialInfo: EmployeeOfficialInfo | Omit<EmployeeOfficialInfo, 'id'>): any => {
  return {
    id: 'id' in officialInfo ? officialInfo.id : undefined,
    division: officialInfo.division || null,
    biometric_id: officialInfo.biometricId || null,
    rfid_serial: officialInfo.rfidSerial || null,
    agreement_signed: officialInfo.agreementSigned || false,
    start_date: officialInfo.startDate || null,
    official_dob: officialInfo.officialDob || null,
    official_email: officialInfo.officialEmail || null,
    assignment_type: officialInfo.assignmentType || null,
    client_name: officialInfo.clientName || null,
    client_location: officialInfo.clientLocation || null,
    manager_name: officialInfo.managerName || null,
    director_name: officialInfo.directorName || null,
    project_description: officialInfo.projectDescription || null,
    client_work_notes: officialInfo.clientWorkNotes || null,
    assignment_date: officialInfo.assignmentDate || null
  };
};
