import React, { useMemo, useState } from 'react';
import GlassCard from './GlassCard';
import { Department, Employee } from '../types';
import { Building2, Plus, X, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DepartmentManagementProps {
  departments: Department[];
  employees: Employee[];
  onAdd: (department: Omit<Department, 'id'>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canDelete?: boolean;
}

const initialForm: Omit<Department, 'id'> = {
  name: '',
  description: ''
};

// Color palette for tags
const tagColors = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
];

const DepartmentManagement: React.FC<DepartmentManagementProps> = ({ 
  departments, 
  employees, 
  onAdd, 
  onDelete, 
  canDelete = true 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<Omit<Department, 'id'>>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Compute usage counts
  const departmentUsage = useMemo(() => {
    const usage: Record<string, number> = {};
    departments.forEach(dept => {
      usage[dept.id] = employees.filter(emp => emp.department === dept.name).length;
    });
    return usage;
  }, [departments, employees]);

  // Get color for tag based on index
  const getTagColor = (index: number) => {
    return tagColors[index % tagColors.length];
  };

  const openNew = () => {
    setForm(initialForm);
    setIsModalOpen(true);
    setFormErrors({});
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(initialForm);
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const errors: { name?: string } = {};
    
    if (!form.name || form.name.trim() === '') {
      errors.name = 'Department name is required';
    }
    
    // Check for duplicate department names (case-insensitive)
    if (form.name && form.name.trim() !== '') {
      const existingDepartment = departments.find(dept => 
        dept.name.toLowerCase() === form.name.toLowerCase()
      );
      
      if (existingDepartment) {
        errors.name = `Department "${form.name}" already exists`;
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setFormErrors({});
    setIsSubmitting(true);

    try {
      await onAdd(form);
      closeModal();
    } catch (error) {
      // Error is already handled in the handler
      console.error('Error submitting department:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (department: Department) => {
    const usageCount = departmentUsage[department.id] || 0;
    
    if (usageCount > 0) {
      alert(`Cannot delete "${department.name}". It is being used by ${usageCount} employee(s). Please reassign employees first.`);
      return;
    }

    if (confirm(`Are you sure you want to delete "${department.name}"?`)) {
      setDeletingId(department.id);
      try {
        await onDelete(department.id);
      } catch (error) {
        // Error is already handled in the handler
        console.error('Error deleting department:', error);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Departments</h3>
          <p className="text-sm text-gray-600">Manage departments as tags. Click to delete unused departments.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-300"
        >
          <Plus size={18} />
          Add Department
        </button>
      </div>

      <GlassCard>
        {departments.length === 0 ? (
          <div className="text-center py-12">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 font-medium mb-2">No departments yet</p>
            <p className="text-sm text-gray-500">Add your first department to get started</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <AnimatePresence>
              {departments.map((department, index) => {
                const usageCount = departmentUsage[department.id] || 0;
                const isDeleting = deletingId === department.id;
                const canDeleteDepartment = canDelete && usageCount === 0;
                
                return (
                  <motion.div
                    key={department.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={`relative group inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      getTagColor(index)
                    } ${canDeleteDepartment ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}`}
                    onClick={() => canDeleteDepartment && !isDeleting && handleDelete(department)}
                    title={
                      usageCount > 0 
                        ? `Used by ${usageCount} employee(s) - cannot delete`
                        : canDelete 
                          ? 'Click to delete'
                          : 'No permission to delete'
                    }
                  >
                    <Building2 size={16} />
                    <span className="font-medium">{department.name}</span>
                    {usageCount > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-white/50 font-semibold">
                        {usageCount}
                      </span>
                    )}
                    {canDeleteDepartment && !isDeleting && (
                      <X 
                        size={14} 
                        className="opacity-60 group-hover:opacity-100 transition-opacity"
                      />
                    )}
                    {isDeleting && (
                      <Loader size={14} className="animate-spin" />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </GlassCard>

      {/* Add Department Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative"
            >
              <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" onClick={closeModal}>
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <Building2 size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Add Department</p>
                  <h4 className="text-lg font-bold text-gray-800">New Department</h4>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Department Name *</label>
                  <input
                    required
                    disabled={isSubmitting}
                    className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
                      formErrors.name 
                        ? 'border-red-300 focus:ring-red-100' 
                        : 'border-gray-200 focus:ring-blue-100'
                    }`}
                    value={form.name}
                    onChange={e => {
                      setForm(prev => ({ ...prev, name: e.target.value }));
                      if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                    }}
                    placeholder="e.g. Engineering, Sales, Marketing"
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Description</label>
                  <textarea
                    disabled={isSubmitting}
                    rows={3}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity resize-none"
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the department (optional)"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 hover:-translate-y-0.5 transition-all duration-300 shadow-md shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        Add Department
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DepartmentManagement;

