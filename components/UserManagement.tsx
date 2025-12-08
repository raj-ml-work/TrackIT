import React, { useMemo, useState } from 'react';
import GlassCard from './GlassCard';
import { UserAccount, UserRole, UserStatus } from '../types';
import { UserPlus, Search, ShieldCheck, Shield, Mail, Clock, X, Pencil, Power, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserManagementProps {
  users: UserAccount[];
  onAdd: (user: Omit<UserAccount, 'id' | 'lastLogin'>) => void;
  onUpdate: (user: UserAccount) => void;
  onToggleStatus: (id: string) => void;
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

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = filterRole === 'All' || user.role === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [users, search, filterRole]);

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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      onUpdate({ ...editingUser, ...form });
    } else {
      onAdd(form);
    }
    closeModal();
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold shadow-lg shadow-gray-900/20 hover:-translate-y-0.5 transition-transform"
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
            <span className="col-span-2 text-right">Last Login</span>
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

            {filteredUsers.map(user => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="grid grid-cols-12 items-center px-3 py-3 rounded-xl hover:bg-white/60 transition-colors border border-transparent hover:border-gray-100"
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
                <div className="col-span-2 flex items-center gap-2 justify-end text-sm text-gray-500">
                  <Clock size={14} />
                  <span>{user.lastLogin}</span>
                </div>
                <div className="col-span-12 flex items-center gap-2 mt-3 md:mt-0 md:justify-end text-sm">
                  <button
                    onClick={() => openEdit(user)}
                    className="px-3 py-2 rounded-lg bg-gray-900 text-white hover:-translate-y-0.5 transition-transform flex items-center gap-1 text-xs"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => onToggleStatus(user.id)}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1 text-xs"
                  >
                    {user.status === UserStatus.ACTIVE ? <Power size={14} /> : <RefreshCw size={14} />}
                    {user.status === UserStatus.ACTIVE ? 'Deactivate' : 'Reactivate'}
                  </button>
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
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
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
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Full Name</label>
                  <input
                    required
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Email</label>
                  <input
                    required
                    type="email"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Role</label>
                    <select
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
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
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none"
                      value={form.status}
                      onChange={e => setForm(prev => ({ ...prev, status: e.target.value as UserStatus }))}
                    >
                      {Object.values(UserStatus).map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:-translate-y-0.5 transition-transform"
                  >
                    {editingUser ? 'Save Changes' : 'Create User'}
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
