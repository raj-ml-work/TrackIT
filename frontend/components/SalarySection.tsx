import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  History, 
  DollarSign, 
  Calendar, 
  AlertCircle,
  Loader,
  TrendingUp,
  Info,
  AlertTriangle
} from 'lucide-react';
import { EmployeeSalaryInfo } from '../types';
import { 
  getEmployeeSalary, 
  addEmployeeSalary, 
  updateEmployeeSalary, 
  deleteEmployeeSalary 
} from '../services/dataService';

interface SalarySectionProps {
  employeeId: string;
  canEditSalary: boolean;
}

const SalarySection: React.FC<SalarySectionProps> = ({ employeeId, canEditSalary }) => {
  const [salaries, setSalaries] = useState<EmployeeSalaryInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState<EmployeeSalaryInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<EmployeeSalaryInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    ctc: '',
    currency: 'INR',
    payFrequency: 'Monthly',
    effectiveDate: new Date().toISOString().split('T')[0],
    bonus: '',
    clientBillingRate: '',
    clientBillingCurrency: 'INR',
    notes: ''
  });

  useEffect(() => {
    fetchSalaries();
  }, [employeeId]);

  const fetchSalaries = async () => {
    setIsLoading(true);
    try {
      const data = await getEmployeeSalary(employeeId);
      setSalaries(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch salary data');
    } finally {
      setIsLoading(false);
    }
  };

  const openAddForm = () => {
    const current = salaries.length > 0 ? salaries[0] : null;
    setEditingSalary(null);
    setFormError('');
    setFormData({
      ctc: current ? current.ctc.toString() : '',
      currency: current ? current.currency : 'INR',
      payFrequency: current ? current.payFrequency : 'Monthly',
      effectiveDate: new Date().toISOString().split('T')[0],
      bonus: current?.bonus ? current.bonus.toString() : '',
      clientBillingRate: current?.clientBillingRate ? current.clientBillingRate.toString() : '',
      clientBillingCurrency: current?.clientBillingCurrency || 'INR',
      notes: ''
    });
    setIsFormOpen(true);
  };

  const openEditForm = (salary: EmployeeSalaryInfo) => {
    setEditingSalary(salary);
    setFormError('');
    setFormData({
      ctc: salary.ctc.toString(),
      currency: salary.currency,
      payFrequency: salary.payFrequency,
      effectiveDate: salary.effectiveDate,
      bonus: salary.bonus?.toString() || '',
      clientBillingRate: salary.clientBillingRate?.toString() || '',
      clientBillingCurrency: salary.clientBillingCurrency || 'INR',
      notes: salary.notes || ''
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');
    try {
      const payload = {
        ctc: parseFloat(formData.ctc),
        currency: formData.currency,
        payFrequency: formData.payFrequency,
        effectiveDate: formData.effectiveDate,
        bonus: formData.bonus ? parseFloat(formData.bonus) : undefined,
        clientBillingRate: formData.clientBillingRate ? parseFloat(formData.clientBillingRate) : undefined,
        clientBillingCurrency: formData.clientBillingCurrency,
        notes: formData.notes
      };

      if (editingSalary) {
        await updateEmployeeSalary(editingSalary.id, payload);
      } else {
        await addEmployeeSalary(employeeId, payload as any);
      }
      
      await fetchSalaries();
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save salary record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDelete = (salary: EmployeeSalaryInfo) => {
    setDeleteTarget(salary);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteEmployeeSalary(deleteTarget.id);
      await fetchSalaries();
      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete salary record. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setDeleteError('');
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader size={32} className="text-emerald-500 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Loading salary information...</p>
      </div>
    );
  }

  const currentSalary = salaries.length > 0 ? salaries[0] : null;

  return (
    <div className="space-y-8 pb-12">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Compensation Details</h2>
          <p className="text-sm text-gray-500 text-balance">Historical view of cost to company and billing rates.</p>
        </div>
        {canEditSalary && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openAddForm}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            Update Salary
          </motion.button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Current Status Card */}
      {currentSalary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp size={80} />
            </div>
            <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Annual CTC</p>
            <h3 className="text-3xl font-bold mb-4">{formatCurrency(currentSalary.ctc, currentSalary.currency)}</h3>
            <div className="flex items-center gap-2 text-xs text-emerald-500 bg-white/90 w-fit px-2 py-1 rounded-full font-bold">
              <Calendar size={12} />
              Effective: {new Date(currentSalary.effectiveDate).toLocaleDateString()}
            </div>
          </div>

          <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Billing Rate</p>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              {currentSalary.clientBillingRate 
                ? formatCurrency(currentSalary.clientBillingRate, currentSalary.clientBillingCurrency || 'INR') 
                : 'Not Set'}
            </h3>
            <p className="text-xs text-gray-500">Gross billing to client (annual)</p>
          </div>

          <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Bonus Component</p>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              {currentSalary.bonus 
                ? formatCurrency(currentSalary.bonus, currentSalary.currency) 
                : 'No Bonus'}
            </h3>
            <p className="text-xs text-gray-500">Variable/Annual bonus included in CTC</p>
          </div>
        </div>
      ) : (
        <div className="p-12 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-400">
            <DollarSign size={32} />
          </div>
          <h3 className="text-gray-900 font-bold mb-1">No Salary Records</h3>
          <p className="text-gray-500 text-sm max-w-xs mb-6">This employee doesn't have any compensation records yet.</p>
          {canEditSalary && (
            <button 
              onClick={openAddForm}
              className="text-emerald-600 text-sm font-bold hover:underline"
            >
              Add First Record
            </button>
          )}
        </div>
      )}

      {/* History Timeline */}
      {salaries.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <History size={18} className="text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Salary History</h3>
          </div>
          
          <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
            {salaries.map((salary, index) => {
              const isLatest = index === 0;
              return (
                <div key={salary.id} className="relative">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center transition-colors ${
                    isLatest ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}>
                    {isLatest && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>

                  <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-emerald-200 transition-colors shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h4 className="text-lg font-bold text-gray-900">{formatCurrency(salary.ctc, salary.currency)}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full uppercase">
                            {salary.payFrequency}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(salary.effectiveDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                          {salary.bonus && (
                            <div className="text-emerald-600 font-medium">
                              + {formatCurrency(salary.bonus, salary.currency)} Bonus
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {salary.clientBillingRate && (
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Billing</p>
                            <p className="text-sm font-bold text-gray-700">{formatCurrency(salary.clientBillingRate, salary.clientBillingCurrency || 'INR')}</p>
                          </div>
                        )}

                        {canEditSalary && (
                          <div className="flex items-center gap-2 border-l pl-6 border-gray-100">
                            <button
                              onClick={() => openEditForm(salary)}
                              className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => requestDelete(salary)}
                              className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {salary.notes && (
                      <div className="mt-4 pt-4 border-t border-gray-50 flex items-start gap-2 text-xs text-gray-500 italic">
                        <Info size={14} className="text-gray-300 shrink-0 mt-0.5" />
                        {salary.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingSalary ? 'Edit Salary Record' : 'Add New Salary Record'}
                </h3>
                <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                {/* Inline form error */}
                {formError && (
                  <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Annual CTC</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <DollarSign size={16} />
                      </div>
                      <input
                        required
                        type="number"
                        step="0.01"
                        className="w-full pl-9 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                        placeholder="e.g. 1200000"
                        value={formData.ctc}
                        onChange={e => setFormData({ ...formData, ctc: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Currency</label>
                    <select
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                      value={formData.currency}
                      onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bonus Component</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                      placeholder="Variable / Performance Bonus"
                      value={formData.bonus}
                      onChange={e => setFormData({ ...formData, bonus: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Effective Date</label>
                    <input
                      required
                      type="date"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                      value={formData.effectiveDate}
                      onChange={e => setFormData({ ...formData, effectiveDate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Billing Rate (Annual)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                      placeholder="Gross billing"
                      value={formData.clientBillingRate}
                      onChange={e => setFormData({ ...formData, clientBillingRate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pay Frequency</label>
                    <select
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
                      value={formData.payFrequency}
                      onChange={e => setFormData({ ...formData, payFrequency: e.target.value })}
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Bi-weekly">Bi-weekly</option>
                      <option value="Weekly">Weekly</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Internal Notes</label>
                  <textarea
                    rows={2}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-100 outline-none transition-all resize-none"
                    placeholder="Rationale for update, increment details, etc."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader size={18} className="animate-spin" /> : null}
                    {editingSalary ? 'Update Record' : 'Save Salary Record'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="p-8 flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                  <AlertTriangle size={28} className="text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Salary Record?</h3>
                  <p className="text-sm text-gray-500">
                    You're about to permanently delete the{' '}
                    <span className="font-semibold text-gray-700">
                      {formatCurrency(deleteTarget.ctc, deleteTarget.currency)}
                    </span>{' '}
                    record effective{' '}
                    <span className="font-semibold text-gray-700">
                      {new Date(deleteTarget.effectiveDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>.
                    This action cannot be undone.
                  </p>
                </div>

                {/* Inline delete error */}
                {deleteError && (
                  <div className="w-full flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm text-left">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{deleteError}</span>
                  </div>
                )}

                <div className="flex gap-3 w-full pt-2">
                  <button
                    onClick={cancelDelete}
                    disabled={isDeleting}
                    className="flex-1 px-5 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="flex-1 px-5 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeleting ? <Loader size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    {isDeleting ? 'Deleting…' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Internal X icon for the modal close button
const X = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export default SalarySection;
