import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Loader } from 'lucide-react';
import ConfirmDialog, { DialogType } from '../../components/ConfirmDialog';
import DepartmentManagement from '../../components/DepartmentManagement';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../../services/departmentService';
import { Department, UserAccount, Asset, Employee } from '../../types';
import * as authClient from '../../services/authClient';

interface DepartmentManagementPageProps {
  departments: Department[];
  assets: Asset[];
  employees: Employee[];
  onAdd: (department: Omit<Department, 'id'>) => Promise<void>;
  onUpdate: (department: Department) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  currentUser?: UserAccount | null;
}

const DepartmentManagementPage: React.FC<DepartmentManagementPageProps> = ({ departments: initialDepartments, assets, employees, onAdd, onUpdate, onDelete, canCreate = true, canUpdate = true, canDelete = true, currentUser = null }) => {
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: DialogType;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: DialogType.ERROR,
    title: '',
    message: '',
    onConfirm: undefined
  });

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDepartments();
      setDepartments(data);
    } catch (err) {
      console.error('Error fetching departments:', err);
      setDialogState({
        isOpen: true,
        type: DialogType.ERROR,
        title: 'Load Failed',
        message: 'Failed to load departments. Please try again.',
        onConfirm: () => setDialogState(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialDepartments.length === 0) {
      fetchDepartments();
    }
  }, [initialDepartments]);

  const handleAdd = async (department: Omit<Department, 'id'>) => {
    try {
      // Use the currentUser prop instead of restoring session
      await createDepartment(department, currentUser);
      await fetchDepartments();
    } catch (err) {
      console.error('Error creating department:', err);
      setDialogState({
        isOpen: true,
        type: DialogType.ERROR,
        title: 'Create Failed',
        message: 'Failed to create department. Please try again.',
        onConfirm: () => setDialogState(prev => ({ ...prev, isOpen: false }))
      });
      throw err;
    }
  };

  const handleUpdate = async (department: Department) => {
    try {
      // Use the currentUser prop instead of restoring session
      await updateDepartment(department, currentUser);
      await fetchDepartments();
    } catch (err) {
      console.error('Error updating department:', err);
      setDialogState({
        isOpen: true,
        type: DialogType.ERROR,
        title: 'Update Failed',
        message: 'Failed to update department. Please try again.',
        onConfirm: () => setDialogState(prev => ({ ...prev, isOpen: false }))
      });
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDepartment(id, currentUser);
      await fetchDepartments();
    } catch (err) {
      console.error('Error deleting department:', err);
      setDialogState({
        isOpen: true,
        type: DialogType.ERROR,
        title: 'Delete Failed',
        message: 'Failed to delete department. Please try again.',
        onConfirm: () => setDialogState(prev => ({ ...prev, isOpen: false }))
      });
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader size={32} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <DepartmentManagement
          departments={departments}
          assets={assets}
          employees={employees}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      )}
      
      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={dialogState.onConfirm}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
      />
    </div>
  );
};

export default DepartmentManagementPage;