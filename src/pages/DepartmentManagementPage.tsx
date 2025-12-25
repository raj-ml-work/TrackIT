import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, ArrowLeft, Loader } from 'lucide-react';
import ConfirmDialog, { DialogType } from '../../components/ConfirmDialog';
import DepartmentManagement from '../../components/DepartmentManagement';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../../services/departmentService';
import { Department } from '../../types';

interface DepartmentManagementPageProps {
  onBack: () => void;
  canDelete?: boolean;
}

const DepartmentManagementPage: React.FC<DepartmentManagementPageProps> = ({ onBack, canDelete = true }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
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
    fetchDepartments();
  }, []);

  const handleAdd = async (department: Omit<Department, 'id'>) => {
    try {
      await createDepartment(department);
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
      await updateDepartment(department);
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
      await deleteDepartment(id);
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
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          title="Back"
        >
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <Building2 size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Department Management</h1>
            <p className="text-gray-600 text-sm">Organize and manage your company departments</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader size={32} className="animate-spin text-gray-400" />
        </div>
      ) : (
        <DepartmentManagement
          departments={departments}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
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