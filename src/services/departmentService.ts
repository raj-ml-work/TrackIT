import { Department } from '../types';
import { getSupabaseClient } from './supabaseClient';

export interface DepartmentService {
  getAll(): Promise<Department[]>;
  getById(id: string): Promise<Department | null>;
  create(department: Omit<Department, 'id'>): Promise<Department>;
  update(id: string, updates: Partial<Department>): Promise<Department>;
  delete(id: string): Promise<void>;
  checkUsage(id: string): Promise<number>;
}

class DepartmentServiceImpl implements DepartmentService {
  /**
   * Get all departments with fresh data from the database
   */
  async getAll(): Promise<Department[]> {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name', { ascending: true })
        .not('name', 'is', null);

      if (error) {
        console.error('Error fetching departments:', error);
        throw new Error(`Failed to fetch departments: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAll departments:', error);
      throw error;
    }
  }

  /**
   * Get a department by ID
   */
  async getById(id: string): Promise<Department | null> {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Record not found
        }
        console.error('Error fetching department:', error);
        throw new Error(`Failed to fetch department: ${error.message}`);
      }

      return data || null;
    } catch (error) {
      console.error('Error in getById department:', error);
      throw error;
    }
  }

  /**
   * Create a new department
   */
  async create(department: Omit<Department, 'id'>): Promise<Department> {
    try {
      // Validate required fields
      if (!department.name || department.name.trim() === '') {
        throw new Error('Department name is required');
      }

      // Check for duplicate department names (case-insensitive)
      const existing = await this.checkDuplicateName(department.name);
      if (existing) {
        throw new Error(`Department "${department.name}" already exists`);
      }

      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('departments')
        .insert([{
          name: department.name.trim(),
          description: department.description || null
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating department:', error);
        throw new Error(`Failed to create department: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in create department:', error);
      throw error;
    }
  }

  /**
   * Update an existing department
   */
  async update(id: string, updates: Partial<Department>): Promise<Department> {
    try {
      // Validate that the department exists
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('Department not found');
      }

      // Check for duplicate name if name is being updated
      if (updates.name && updates.name !== existing.name) {
        const duplicate = await this.checkDuplicateName(updates.name);
        if (duplicate) {
          throw new Error(`Department "${updates.name}" already exists`);
        }
      }

      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('departments')
        .update({
          name: updates.name ? updates.name.trim() : existing.name,
          description: updates.description !== undefined ? updates.description : existing.description
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating department:', error);
        throw new Error(`Failed to update department: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in update department:', error);
      throw error;
    }
  }

  /**
   * Delete a department (only if not in use)
   */
  async delete(id: string): Promise<void> {
    try {
      // Check if department is in use
      const usageCount = await this.checkUsage(id);
      if (usageCount > 0) {
        throw new Error(`Cannot delete department. It is being used by ${usageCount} employee(s).`);
      }

      // Delete the department
      const supabase = await getSupabaseClient();
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting department:', error);
        throw new Error(`Failed to delete department: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in delete department:', error);
      throw error;
    }
  }

  /**
   * Check how many employees are using this department
   */
  async checkUsage(id: string): Promise<number> {
    try {
      // First get the department name
      const department = await this.getById(id);
      if (!department) {
        return 0;
      }

      // Count employees using this department
      const supabase = await getSupabaseClient();
      const { count, error } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('department', department.name);

      if (error) {
        console.error('Error checking department usage:', error);
        throw new Error(`Failed to check department usage: ${error.message}`);
      }

      return count || 0;
    } catch (error) {
      console.error('Error in checkUsage:', error);
      throw error;
    }
  }

  /**
   * Check for duplicate department names (case-insensitive)
   */
  private async checkDuplicateName(name: string): Promise<boolean> {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('departments')
        .select('id')
        .ilike('name', name.trim())
        .limit(1);

      if (error) {
        console.error('Error checking duplicate department name:', error);
        throw new Error(`Failed to check duplicate name: ${error.message}`);
      }

      return (data && data.length > 0) || false;
    } catch (error) {
      console.error('Error in checkDuplicateName:', error);
      throw error;
    }
  }
}

export const departmentService = new DepartmentServiceImpl();