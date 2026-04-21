/**
 * Salary Service
 *
 * Handles all API operations for employee salary records.
 * Salary data is sensitive and only accessible by Admin and Management roles.
 */

import { EmployeeSalaryInfo } from '../types';
import { apiFetchJson } from './apiClient';

/**
 * Get all salary records for an employee, ordered by effective date (newest first)
 */
export const getEmployeeSalary = async (employeeId: string): Promise<EmployeeSalaryInfo[]> => {
  return apiFetchJson<EmployeeSalaryInfo[]>(`/employees/${employeeId}/salary`);
};

/**
 * Get the latest salary record for all employees (Management Summary)
 */
export const getLatestSalaries = async (): Promise<EmployeeSalaryInfo[]> => {
  return apiFetchJson<EmployeeSalaryInfo[]>('/salaries/latest');
};

/**
 * Add a new salary record for an employee
 */
export const addEmployeeSalary = async (
  employeeId: string,
  salary: Omit<EmployeeSalaryInfo, 'id' | 'employeeId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'createdByName'>
): Promise<EmployeeSalaryInfo> => {
  return apiFetchJson<EmployeeSalaryInfo>(`/employees/${employeeId}/salary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(salary)
  });
};

/**
 * Update an existing salary record
 */
export const updateEmployeeSalary = async (
  salaryId: string,
  salary: Partial<EmployeeSalaryInfo>
): Promise<EmployeeSalaryInfo> => {
  return apiFetchJson<EmployeeSalaryInfo>(`/salary/${salaryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(salary)
  });
};

/**
 * Delete a salary record
 */
export const deleteEmployeeSalary = async (salaryId: string): Promise<void> => {
  await apiFetchJson<{ ok: boolean }>(`/salary/${salaryId}`, { method: 'DELETE' });
};
