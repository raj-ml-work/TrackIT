import React, { useMemo, useState } from 'react';
import GlassCard from './GlassCard';
import ConfirmDialog, { DialogType } from './ConfirmDialog';
import { Department, Asset, Employee } from '../types';
import { Building2, Search, Plus, X, Pencil, Trash2, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DepartmentManagementProps {
  departments: Department[];
  assets: Asset[];
  employees: Employee[];
  onAdd: (department: Omit<Department, 'id'>) => Promise<void>;
  onUpdate: (department: Department) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

const initialForm: Omit<Department, 'id'> = {
  name: '',
  description: ''
};

const DepartmentManagement: React.FC<DepartmentManagementProps> = ({ departments, assets, employees, onAdd, onUpdate, onDelete, canCreate = true, canUpdate = true, canDelete = true }) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [form, setForm] = useState<Omit<Department, 'id'>>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: DialogType;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: DialogType.CONFIRM,
    title: '',
    message: '',
    onConfirm: undefined
  });

  const departmentTagPalettes = [
    {
      bg: '#eff6ff',
      border: '#bfdbfe',
      text: '#1e3a8a',
      iconBg: '#dbeafe',
      iconText: '#1d4ed8',
      metaBg: '#e0e7ff',
      metaText: '#3730a3'
    },
    {
      bg: '#ecfeff',
      border: '#a5f3fc',
      text: '#155e75',
      iconBg: '#cffafe',
      iconText: '#0e7490',
      metaBg: '#e6fffb',
      metaText: '#0f766e'
    },
    {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      text: '#166534',
      iconBg: '#dcfce7',
      iconText: '#15803d',
      metaBg: '#e7f5eb',
      metaText: '#166534'
    },
    {
      bg: '#f7fee7',
      border: '#d9f99d',
      text: '#365314',
      iconBg: '#ecfccb',
      iconText: '#3f6212',
      metaBg: '#f1f5d6',
      metaText: '#365314'
    },
    {
      bg: '#fffbeb',
      border: '#fde68a',
      text: '#92400e',
      iconBg: '#fef3c7',
      iconText: '#b45309',
      metaBg: '#fff3d6',
      metaText: '#92400e'
    },
    {
      bg: '#fff7ed',
      border: '#fed7aa',
      text: '#9a3412',
      iconBg: '#ffedd5',
      iconText: '#c2410c',
      metaBg: '#ffe7d1',
      metaText: '#9a3412'
    },
    {
      bg: '#fff1f2',
      border: '#fecdd3',
      text: '#9f1239',
      iconBg: '#ffe4e6',
      iconText: '#be123c',
      metaBg: '#ffe4ec',
      metaText: '#9f1239'
    },
    {
      bg: '#fdf2f8',
      border: '#fbcfe8',
      text: '#9d174d',
      iconBg: '#fce7f3',
      iconText: '#be185d',
      metaBg: '#fde7f6',
      metaText: '#9d174d'
    },
    {
      bg: '#f5f3ff',
      border: '#ddd6fe',
      text: '#4c1d95',
      iconBg: '#ede9fe',
      iconText: '#6d28d9',
      metaBg: '#ede9fe',
      metaText: '#4c1d95'
    },
    {
      bg: '#eef2ff',
      border: '#c7d2fe',
      text: '#312e81',
      iconBg: '#e0e7ff',
      iconText: '#4338ca',
      metaBg: '#e0e7ff',
      metaText: '#312e81'
    },
    {
      bg: '#f1f5f9',
      border: '#cbd5f5',
      text: '#334155',
      iconBg: '#e2e8f0',
      iconText: '#475569',
      metaBg: '#e2e8f0',
      metaText: '#334155'
    },
    {
      bg: '#f8fafc',
      border: '#cbd5e1',
      text: '#1f2937',
      iconBg: '#e2e8f0',
      iconText: '#334155',
      metaBg: '#e2e8f0',
      metaText: '#1f2937'
    }
  ];

  const getDepartmentTagStyle = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
      hash = (hash * 31 + name.charCodeAt(i)) % departmentTagPalettes.length;
    }
    const palette = departmentTagPalettes[hash];
    return {
      chip: {
        backgroundColor: palette.bg,
        borderColor: palette.border,
        color: palette.text
      },
      icon: {
        backgroundColor: palette.iconBg,
        color: palette.iconText
      },
      meta: {
        backgroundColor: palette.metaBg,
        color: palette.metaText
      }
    };
  };

  // Compute employee counts for each department
  const departmentUsage = useMemo(() => {
    const usage: Record<string, number> = {};
    departments.forEach(dept => {
      // Count employees in this department
      usage[dept.id] = employees.filter(emp => emp.department === dept.name).length;
    });
    return usage;
  }, [departments, employees]);

  const filteredDepartments = useMemo(() => {
    return departments.filter(department => {
      const matchesSearch =
        department.name.toLowerCase().includes(search.toLowerCase()) ||
        department.description?.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [departments, search]);

  const openNew = () => {
    setEditingDepartment(null);
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const openEdit = (department: Department) => {
    setEditingDepartment(department);
    setForm({
      name: department.name,
      description: department.description
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDepartment(null);
    setForm(initialForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingDepartment) {
        await onUpdate({ ...editingDepartment, ...form });
      } else {
        await onAdd(form);
      }
      closeModal();
    } catch (error) {
      // Error is already handled in the handler
      console.error('Error submitting department:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (department: Department) => {
    const employeeCount = departmentUsage[department.id] || 0;
    
    if (employeeCount > 0) {
      setDialogState({
        isOpen: true,
        type: DialogType.ERROR,
        title: 'Cannot Delete Department',
        message: `Cannot delete ${department.name}. It has ${employeeCount} employee(s) assigned. Please reassign them first.`,
        onConfirm: undefined
      });
      return;
    }
  
    setDialogState({
      isOpen: true,
      type: DialogType.CONFIRM,
      title: 'Delete Department',
      message: `Are you sure you want to delete "${department.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await onDelete(department.id);
          // Close the dialog after successful deletion
          setDialogState(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          // Error is already handled in the handler
          console.error('Error deleting department:', error);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl w-full md:w-80">
            <Search size={16} className="text-gray-400" />
            <input
              className="w-full bg-transparent focus:outline-none text-sm"
              placeholder="Search by name or description"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {canCreate && (
            <div className="ml-auto">
              <button
                onClick={openNew}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-600 text-white text-sm font-semibold shadow-lg shadow-green-600/20 hover:-translate-y-0.5 hover:bg-green-700 transition-transform"
              >
                <Plus size={18} />
                Add Department
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {filteredDepartments.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/60"
              >
                <p className="text-gray-700 font-semibold mb-1">No departments yet</p>
                <p className="text-gray-500 text-sm">Add your first department to organize your employees.</p>
              </motion.div>
            )}

            <div className="flex flex-wrap gap-3">
              {filteredDepartments.map((department, index) => {
                const tagStyle = getDepartmentTagStyle(department.name);
                return (
                  <motion.div
                    key={department.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                    className="relative"
                  >
                    <div
                      className="flex items-center gap-2 px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all border"
                      style={tagStyle.chip}
                    >
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={tagStyle.icon}>
                        <Building2 size={14} />
                      </div>
                      <span className="font-medium text-gray-800">{department.name}</span>
                      {department.description && (
                        <span
                          className="text-xs px-2 py-1 rounded-full truncate max-w-[100px]"
                          style={tagStyle.meta}
                        >
                          {department.description}
                        </span>
                      )}
                      <span className="text-xs font-semibold px-2 py-1 rounded-full" style={tagStyle.meta}>
                        {departmentUsage[department.id] || 0} employees
                      </span>
                    </div>
                    <div className="absolute -top-2 -right-2 flex gap-1">
                      {canUpdate && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => openEdit(department)}
                          className="p-1 bg-blue-50 text-blue-600 rounded-full transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </motion.button>
                      )}
                      {canDelete && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDelete(department)}
                          className="p-1 bg-red-50 text-red-600 rounded-full transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        </div>
      </GlassCard>

      {/* Add/Edit Modal */}
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
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg relative"
            >
              <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" onClick={closeModal}>
                <X size={18} />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <Building2 size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{editingDepartment ? 'Edit Department' : 'Add Department'}</p>
                  <h4 className="text-lg font-bold text-gray-800">Department Details</h4>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Department Name *</label>
                  <input
                    required
                    disabled={isSubmitting}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Engineering"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Description</label>
                  <textarea
                    disabled={isSubmitting}
                    rows={3}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity resize-none"
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Additional notes about this department (optional)"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        {editingDepartment ? 'Saving...' : 'Creating...'}
                      </>
                    ) : (
                      <>{editingDepartment ? 'Save Changes' : 'Create Department'}</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
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

export default DepartmentManagement;
