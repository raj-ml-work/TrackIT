import React, { useMemo, useState } from 'react';
import GlassCard from './GlassCard';
import { UserAccount, UserRole, UserStatus } from '../types';
import { UserPlus, Search, ShieldCheck, Shield, Mail, Clock, X, Pencil, Power, RefreshCw, Loader, Eye, EyeOff, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserManagementProps {
  users: UserAccount[];
  onAdd: (user: Omit<UserAccount, 'id' | 'lastLogin'>) => Promise<void>;
  onUpdate: (user: UserAccount) => Promise<void>;
  onToggleStatus: (id: string) => Promise<void>;
}

const initialForm: Omit<UserAccount, 'id' | 'lastLogin'> = {
  name: '',
  email: '',
  role: UserRole.USER,
  status: UserStatus.ACTIVE
};

const roleBadge = (role: UserRole) => {
  const base = 'text-xs px-3 py-1 rounded-full font-semibold';
  return role === UserRole.ADMIN
    ? `${base} bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-sm`
    : `${base} bg-gray-100 text-gray-700`;
};

const statusBadge = (status: UserStatus) => {
  const base = 'text-xs px-3 py-1 rounded-full font-semibold';
  return status === UserStatus.ACTIVE
    ? `${base} bg-emerald-100 text-emerald-700`
    : `${base} bg-amber-100 text-amber-700`;
};

const UserManagement: React.FC<UserManagementProps> = ({ users, onAdd, onUpdate, onToggleStatus }) => {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'All'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [form, setForm] = useState<Omit<UserAccount, 'id' | 'lastLogin'>>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Password fields for new user creation
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string }>({});

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = filterRole === 'All' || user.role === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [users, search, filterRole]);

  const getPasswordStrength = (pwd: string): { strength: number; label: string; color: string } => {
    if (!pwd) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.length >= 10) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;

    if (strength <= 2) return { strength, label: 'Weak', color: 'bg-red-500' };
    if (strength <= 3) return { strength, label: 'Fair', color: 'bg-yellow-500' };
    if (strength <= 4) return { strength, label: 'Good', color: 'bg-blue-500' };
    return { strength, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(password);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
    setConfirmPassword(pwd);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  const openNew = () => {
    setEditingUser(null);
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const openEdit = (user: UserAccount) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setForm(initialForm);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPasswordError('');
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    const errors: { name?: string; email?: string } = {};
    
    // Validate required fields
    if (!form.name || form.name.trim() === '') {
      errors.name = 'Name is required';
    }
    
    if (!form.email || form.email.trim() === '') {
      errors.email = 'Email is required';
    } else {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email)) {
        errors.email = 'Please enter a valid email address';
      }
    }
    
    // Validate password for new users
    if (!editingUser) {
      if (!password) {
        setPasswordError('Password is required');
        if (Object.keys(errors).length === 0) return;
      } else if (password.length < 6) {
        setPasswordError('Password must be at least 6 characters');
        if (Object.keys(errors).length === 0) return;
      } else if (password !== confirmPassword) {
        setPasswordError('Passwords do not match');
        if (Object.keys(errors).length === 0) return;
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setFormErrors({});
    setIsSubmitting(true);
    
    try {
      if (editingUser) {
        await onUpdate({ ...editingUser, ...form });
      } else {
        // Include password when creating new user (will be handled by backend later)
        await onAdd({ ...form, password });
      }
      closeModal();
    } catch (error) {
      // Error is already handled in the handler
      console.error('Error submitting user:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">User Management</h3>
          <p className="text-gray-500">Control access for admins and team members.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all duration-300"
        >
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      <GlassCard>
        <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl w-full md:w-80">
            <Search size={16} className="text-gray-400" />
            <input
              className="w-full bg-transparent focus:outline-none text-sm"
              placeholder="Search by name or email"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Role</span>
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value as UserRole | 'All')}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none"
            >
              <option value="All">All</option>
              {Object.values(UserRole).map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-12 text-xs text-gray-400 px-2">
            <span className="col-span-3">Name</span>
            <span className="col-span-3">Email</span>
            <span className="col-span-2">Role</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-1 text-right">Last Login</span>
            <span className="col-span-1"></span>
          </div>

          <AnimatePresence>
            {filteredUsers.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/60"
              >
                <p className="text-gray-700 font-semibold mb-1">No users yet</p>
                <p className="text-gray-500 text-sm">Create your first teammate to unlock RBAC flows.</p>
              </motion.div>
            )}

            {filteredUsers.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.01 }}
                className="grid grid-cols-12 items-center px-3 py-3 rounded-xl hover:bg-white/60 transition-all border border-transparent hover:border-gray-100 hover:shadow-sm"
              >
                <div className="col-span-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-700 font-semibold">
                      {user.name.substring(0, 1)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 leading-tight">{user.name}</p>
                      <p className="text-xs text-gray-500">#{user.id.slice(-4)}</p>
                    </div>
                  </div>
                </div>
                <div className="col-span-3 flex items-center gap-2 text-gray-700">
                  <Mail size={14} className="text-gray-400" />
                  <span className="text-sm truncate">{user.email}</span>
                </div>
                <div className="col-span-2">
                  <span className={roleBadge(user.role)}>
                    {user.role === UserRole.ADMIN ? <ShieldCheck size={12} className="inline mr-1" /> : <Shield size={12} className="inline mr-1" />}
                    {user.role}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className={statusBadge(user.status)}>{user.status}</span>
                </div>
                <div className="col-span-1 flex items-center gap-2 justify-end text-sm text-gray-500">
                  <Clock size={14} className="hidden md:block" />
                  <span className="text-xs md:text-sm">{user.lastLogin}</span>
                </div>
                <div className="col-span-1 flex items-center gap-2 justify-end">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openEdit(user)}
                    className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={async () => {
                      try {
                        await onToggleStatus(user.id);
                      } catch (error) {
                        console.error('Error toggling user status:', error);
                      }
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      user.status === UserStatus.ACTIVE 
                        ? 'hover:bg-amber-50 text-amber-600' 
                        : 'hover:bg-emerald-50 text-emerald-600'
                    }`}
                    title={user.status === UserStatus.ACTIVE ? 'Deactivate' : 'Reactivate'}
                  >
                    {user.status === UserStatus.ACTIVE ? <Power size={16} /> : <RefreshCw size={16} />}
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </GlassCard>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg relative"
            >
              <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" onClick={closeModal}>
                <X size={18} />
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gray-100 text-gray-700">
                  <UserPlus size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{editingUser ? 'Edit User' : 'Add User'}</p>
                  <h4 className="text-lg font-bold text-gray-800">Access Controls</h4>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {passwordError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2"
                  >
                    <X size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{passwordError}</p>
                  </motion.div>
                )}
                
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Full Name *</label>
                  <input
                    required
                    disabled={isSubmitting}
                    className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
                      formErrors.name 
                        ? 'border-red-300 focus:ring-red-100' 
                        : 'border-gray-200 focus:ring-indigo-100'
                    }`}
                    value={form.name}
                    onChange={e => {
                      setForm(prev => ({ ...prev, name: e.target.value }));
                      if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                    }}
                    placeholder="e.g. John Doe"
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Email *</label>
                  <input
                    required
                    type="email"
                    disabled={isSubmitting}
                    className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
                      formErrors.email 
                        ? 'border-red-300 focus:ring-red-100' 
                        : 'border-gray-200 focus:ring-indigo-100'
                    }`}
                    value={form.email}
                    onChange={e => {
                      setForm(prev => ({ ...prev, email: e.target.value }));
                      if (formErrors.email) setFormErrors(prev => ({ ...prev, email: undefined }));
                    }}
                    placeholder="e.g. john.doe@example.com"
                  />
                  {formErrors.email && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>
                  )}
                </div>

                {/* Password fields - only for new users */}
                {!editingUser && (
                  <>
                    <div className="pt-2 pb-1">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Key size={16} className="text-gray-500" />
                          <span className="text-xs text-gray-500 uppercase font-medium">Account Password</span>
                        </div>
                        <button
                          type="button"
                          onClick={generateRandomPassword}
                          disabled={isSubmitting}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors disabled:opacity-50"
                        >
                          Generate Strong Password
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-500 uppercase block mb-1">Password *</label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
                              disabled={isSubmitting}
                              className="w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none disabled:opacity-50"
                              value={password}
                              onChange={e => setPassword(e.target.value)}
                              placeholder="Minimum 6 characters"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                          {password && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mt-2"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                                    className={`h-full ${passwordStrength.color} transition-all`}
                                  />
                                </div>
                                <span className="text-xs font-medium text-gray-600">{passwordStrength.label}</span>
                              </div>
                            </motion.div>
                          )}
                        </div>

                        <div>
                          <label className="text-xs text-gray-500 uppercase block mb-1">Confirm Password *</label>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              required
                              disabled={isSubmitting}
                              className="w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none disabled:opacity-50"
                              value={confirmPassword}
                              onChange={e => setConfirmPassword(e.target.value)}
                              placeholder="Re-enter password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Role</label>
                    <select
                      disabled={isSubmitting}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      value={form.role}
                      onChange={e => setForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                    >
                      {Object.values(UserRole).map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Status</label>
                    <select
                      disabled={isSubmitting}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                      value={form.status}
                      onChange={e => setForm(prev => ({ ...prev, status: e.target.value as UserStatus }))}
                    >
                      {Object.values(UserStatus).map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Note for editing existing users */}
                {editingUser && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-xs text-blue-800">
                      <span className="font-semibold">Note:</span> To change this user's password, they should use the "Change Password" option in their profile menu after logging in.
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
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 hover:-translate-y-0.5 transition-all duration-300 shadow-md shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        {editingUser ? 'Saving...' : 'Creating...'}
                      </>
                    ) : (
                      <>{editingUser ? 'Save Changes' : 'Create User'}</>
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

export default UserManagement;
