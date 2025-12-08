import React, { useMemo, useState } from 'react';
import GlassCard from './GlassCard';
import { Employee, EmployeeStatus, Asset, Location } from '../types';
import { UserPlus, Search, Mail, MapPin, Briefcase, Building, X, Pencil, Trash2, Loader, AlertTriangle, Eye, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmployeeManagementProps {
  employees: Employee[];
  assets: Asset[];
  locations: Location[];
  onAdd: (employee: Omit<Employee, 'id'>) => void;
  onUpdate: (employee: Employee) => void;
  onDelete: (id: string) => void;
  canDelete?: boolean;
}

const initialForm: Omit<Employee, 'id'> = {
  employeeId: '',
  name: '',
  email: '',
  department: '',
  location: '',
  title: '',
  status: EmployeeStatus.ACTIVE
};

const statusBadge = (status: EmployeeStatus) => {
  const base = 'text-xs px-3 py-1 rounded-full font-semibold';
  return status === EmployeeStatus.ACTIVE
    ? `${base} bg-emerald-100 text-emerald-700`
    : `${base} bg-amber-100 text-amber-700`;
};

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ employees, assets, locations, onAdd, onUpdate, onDelete, canDelete = true }) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<EmployeeStatus | 'All'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<Omit<Employee, 'id'>>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employeeIdError, setEmployeeIdError] = useState('');
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  // Compute assigned asset counts
  const assetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(emp => {
      counts[emp.id] = assets.filter(a => a.assignedTo === emp.name).length;
    });
    return counts;
  }, [employees, assets]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const matchesSearch =
        employee.name.toLowerCase().includes(search.toLowerCase()) ||
        employee.employeeId.toLowerCase().includes(search.toLowerCase()) ||
        employee.email?.toLowerCase().includes(search.toLowerCase()) ||
        employee.department?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === 'All' || employee.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [employees, search, filterStatus]);

  // Get assets assigned to an employee
  const getEmployeeAssets = (employeeName: string) => {
    return assets.filter(a => a.assignedTo === employeeName);
  };

  const openNew = () => {
    setEditingEmployee(null);
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setForm({
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      department: employee.department,
      location: employee.location,
      title: employee.title,
      status: employee.status
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setForm(initialForm);
    setEmployeeIdError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmployeeIdError('');

    // Validate employee ID uniqueness
    const existingEmployee = employees.find(emp => 
      emp.employeeId.toLowerCase() === form.employeeId.toLowerCase() && 
      emp.id !== editingEmployee?.id
    );

    if (existingEmployee) {
      setEmployeeIdError(`Employee ID "${form.employeeId}" is already in use by ${existingEmployee.name}`);
      return;
    }

    setIsSubmitting(true);

    await new Promise(resolve => setTimeout(resolve, 500));

    if (editingEmployee) {
      onUpdate({ ...editingEmployee, ...form });
    } else {
      onAdd(form);
    }

    setIsSubmitting(false);
    closeModal();
  };

  const handleDelete = (employee: Employee) => {
    const assignedCount = assetCounts[employee.id] || 0;
    if (assignedCount > 0) {
      alert(`Cannot delete ${employee.name}. They have ${assignedCount} asset(s) assigned. Please reassign or unassign assets first.`);
      return;
    }

    if (confirm(`Are you sure you want to delete ${employee.name}?`)) {
      onDelete(employee.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold shadow-lg shadow-gray-900/20 hover:-translate-y-0.5 transition-transform"
        >
          <UserPlus size={18} />
          Add Employee
        </button>
      </div>

      <GlassCard>
        <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl w-full md:w-80">
            <Search size={16} className="text-gray-400" />
            <input
              className="w-full bg-transparent focus:outline-none text-sm"
              placeholder="Search by name, employee ID, email, or department"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Status</span>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as EmployeeStatus | 'All')}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none"
            >
              <option value="All">All</option>
              {Object.values(EmployeeStatus).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-12 text-xs text-gray-400 px-2">
            <span className="col-span-3">Name</span>
            <span className="col-span-2">Employee ID</span>
            <span className="col-span-2">Department</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-2">Assets</span>
            <span className="col-span-1"></span>
          </div>

          <AnimatePresence>
            {filteredEmployees.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/60"
              >
                <p className="text-gray-700 font-semibold mb-1">No employees yet</p>
                <p className="text-gray-500 text-sm">Add your first employee to start managing asset assignments.</p>
              </motion.div>
            )}

            {filteredEmployees.map((employee, index) => (
              <motion.div
                key={employee.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.01 }}
                className="grid grid-cols-12 items-center px-3 py-3 rounded-xl hover:bg-white/60 transition-all border border-transparent hover:border-gray-100 hover:shadow-sm"
              >
                <div className="col-span-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-200 flex items-center justify-center text-gray-700 font-semibold">
                      {employee.name.substring(0, 1)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 leading-tight">{employee.name}</p>
                      {employee.title && (
                        <p className="text-xs text-gray-500 truncate">{employee.title}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-mono text-gray-700">{employee.employeeId}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-700">{employee.department || '—'}</p>
                </div>
                <div className="col-span-2">
                  <span className={statusBadge(employee.status)}>{employee.status}</span>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{assetCounts[employee.id] || 0}</span>
                    <span className="text-xs text-gray-500">assigned</span>
                  </div>
                </div>
                <div className="col-span-1 flex items-center gap-2 justify-end">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setViewingEmployee(employee)}
                    className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition-colors"
                    title="View Details"
                  >
                    <Eye size={16} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openEdit(employee)}
                    className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </motion.button>
                  {canDelete && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDelete(employee)}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))}
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
                  <UserPlus size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{editingEmployee ? 'Edit Employee' : 'Add Employee'}</p>
                  <h4 className="text-lg font-bold text-gray-800">Employee Details</h4>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {employeeIdError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2"
                  >
                    <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{employeeIdError}</p>
                  </motion.div>
                )}

                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Employee ID *</label>
                  <input
                    required
                    disabled={isSubmitting || !!editingEmployee}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity font-mono"
                    value={form.employeeId}
                    onChange={e => setForm(prev => ({ ...prev, employeeId: e.target.value.toUpperCase() }))}
                    placeholder="e.g. EMP001"
                  />
                  {editingEmployee && (
                    <p className="text-xs text-gray-500 mt-1">Employee ID cannot be changed after creation</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Full Name *</label>
                  <input
                    required
                    disabled={isSubmitting}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Email</label>
                  <input
                    type="email"
                    disabled={isSubmitting}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Department</label>
                    <input
                      disabled={isSubmitting}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      value={form.department}
                      onChange={e => setForm(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="e.g. Engineering"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Location</label>
                    <select
                      disabled={isSubmitting}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      value={form.location}
                      onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                    >
                      <option value="">Select Location</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.name}>{loc.name} - {loc.city}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Title</label>
                    <input
                      disabled={isSubmitting}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      value={form.title}
                      onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g. Senior Designer"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Status</label>
                    <select
                      disabled={isSubmitting}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      value={form.status}
                      onChange={e => setForm(prev => ({ ...prev, status: e.target.value as EmployeeStatus }))}
                    >
                      {Object.values(EmployeeStatus).map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {editingEmployee && assetCounts[editingEmployee.id] > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      This employee has <strong>{assetCounts[editingEmployee.id]} asset(s)</strong> assigned. 
                      They cannot be deleted until assets are reassigned.
                    </p>
                  </div>
                )}

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
                        {editingEmployee ? 'Saving...' : 'Creating...'}
                      </>
                    ) : (
                      <>{editingEmployee ? 'Save Changes' : 'Create Employee'}</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Employee Detail Modal */}
      <AnimatePresence>
        {viewingEmployee && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setViewingEmployee(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" onClick={() => setViewingEmployee(null)}>
                <X size={18} />
              </button>

              {/* Employee Header */}
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-200 flex items-center justify-center text-gray-700 text-2xl font-bold">
                    {viewingEmployee.name.substring(0, 1)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900">{viewingEmployee.name}</h3>
                    <p className="text-sm font-mono text-gray-600">ID: {viewingEmployee.employeeId}</p>
                  </div>
                  <span className={statusBadge(viewingEmployee.status)}>{viewingEmployee.status}</span>
                </div>

                {/* Employee Details Grid */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                  {viewingEmployee.email && (
                    <div className="flex items-start gap-2">
                      <Mail size={16} className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Email</p>
                        <p className="text-sm text-gray-800">{viewingEmployee.email}</p>
                      </div>
                    </div>
                  )}
                  {viewingEmployee.department && (
                    <div className="flex items-start gap-2">
                      <Building size={16} className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Department</p>
                        <p className="text-sm text-gray-800">{viewingEmployee.department}</p>
                      </div>
                    </div>
                  )}
                  {viewingEmployee.title && (
                    <div className="flex items-start gap-2">
                      <Briefcase size={16} className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Title</p>
                        <p className="text-sm text-gray-800">{viewingEmployee.title}</p>
                      </div>
                    </div>
                  )}
                  {viewingEmployee.location && (
                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Location</p>
                        <p className="text-sm text-gray-800">{viewingEmployee.location}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Assigned Assets Section */}
              <div className="border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package size={20} className="text-gray-600" />
                  <h4 className="text-lg font-bold text-gray-900">Assigned Assets</h4>
                  <span className="text-sm text-gray-500">({assetCounts[viewingEmployee.id] || 0})</span>
                </div>

                {getEmployeeAssets(viewingEmployee.name).length > 0 ? (
                  <div className="space-y-3">
                    {getEmployeeAssets(viewingEmployee.name).map((asset) => (
                      <motion.div
                        key={asset.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-semibold text-gray-900 mb-2">{asset.name}</h5>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                              <div className="flex items-center gap-2 text-gray-600">
                                <span className="text-xs text-gray-500">Type:</span>
                                <span>{asset.type}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <span className="text-xs text-gray-500">Status:</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  asset.status === 'In Use' ? 'bg-blue-100 text-blue-800' :
                                  asset.status === 'Available' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {asset.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <span className="text-xs text-gray-500">Serial:</span>
                                <span className="font-mono text-xs">{asset.serialNumber}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <span className="text-xs text-gray-500">Location:</span>
                                <span>{asset.location}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl bg-gray-50">
                    <Package size={40} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-600 font-medium">No assets assigned</p>
                    <p className="text-sm text-gray-500">This employee has no assets currently assigned to them</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmployeeManagement;

