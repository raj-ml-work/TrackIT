import { EmployeeOfficialInfo } from '../types';
import { getSupabaseClient } from './supabaseClient';
import { isSupabaseConfigured } from './database';

/**
 * Create a new employee official info record
 */
export const createEmployeeOfficialInfo = async (
  officialInfo: Omit<EmployeeOfficialInfo, 'id'>
): Promise<EmployeeOfficialInfo> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      ...officialInfo,
      id: `official-${Date.now()}`
    } as EmployeeOfficialInfo;
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('official_info')
    .insert({
      division: officialInfo.division,
      biometric_id: officialInfo.biometricId,
      rfid_serial: officialInfo.rfidSerial,
      agreement_signed: officialInfo.agreementSigned,
      start_date: officialInfo.startDate,
      official_dob: officialInfo.officialDob,
      official_email: officialInfo.officialEmail
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating employee official info:', error);
    throw new Error('Failed to create employee official info');
  }

  return {
    id: data.id,
    division: data.division,
    biometricId: data.biometric_id,
    rfidSerial: data.rfid_serial,
    agreementSigned: data.agreement_signed,
    startDate: data.start_date,
    officialDob: data.official_dob,
    officialEmail: data.official_email
  };
};

/**
 * Get employee official info by ID
 */
export const getEmployeeOfficialInfo = async (id: string): Promise<EmployeeOfficialInfo | null> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      id,
      division: 'Engineering',
      biometricId: 'BIO-001',
      rfidSerial: 'RFID-001',
      agreementSigned: true,
      startDate: '2024-01-01',
      officialDob: '1990-01-01',
      officialEmail: 'john.doe@auralis.inc'
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('official_info')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching employee official info:', error);
    throw new Error('Failed to fetch employee official info');
  }

  if (!data) return null;

  return {
    id: data.id,
    division: data.division,
    biometricId: data.biometric_id,
    rfidSerial: data.rfid_serial,
    agreementSigned: data.agreement_signed,
    startDate: data.start_date,
    officialDob: data.official_dob,
    officialEmail: data.official_email
  };
};

/**
 * Update employee official info
 */
export const updateEmployeeOfficialInfo = async (
  id: string,
  updates: Partial<EmployeeOfficialInfo>
): Promise<EmployeeOfficialInfo> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return {
      id,
      division: updates.division || 'Engineering',
      biometricId: updates.biometricId || 'BIO-001',
      rfidSerial: updates.rfidSerial || 'RFID-001',
      agreementSigned: updates.agreementSigned ?? true,
      startDate: updates.startDate || '2024-01-01',
      officialDob: updates.officialDob || '1990-01-01',
      officialEmail: updates.officialEmail || 'john.doe@auralis.inc'
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from('official_info')
    .update({
      division: updates.division,
      biometric_id: updates.biometricId,
      rfid_serial: updates.rfidSerial,
      agreement_signed: updates.agreementSigned,
      start_date: updates.startDate,
      official_dob: updates.officialDob,
      official_email: updates.officialEmail
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating employee official info:', error);
    throw new Error('Failed to update employee official info');
  }

  return {
    id: data.id,
    division: data.division,
    biometricId: data.biometric_id,
    rfidSerial: data.rfid_serial,
    agreementSigned: data.agreement_signed,
    startDate: data.start_date,
    officialDob: data.official_dob,
    officialEmail: data.official_email
  };
};

/**
 * Delete employee official info
 */
export const deleteEmployeeOfficialInfo = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured()) {
    // Mock implementation for development
    return;
  }

  const supabase = await getSupabaseClient();
  const { error } = await supabase
    .from('official_info')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting employee official info:', error);
    throw new Error('Failed to delete employee official info');
  }
};
