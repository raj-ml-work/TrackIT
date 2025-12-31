import React, { useMemo, useState } from 'react';
import GlassCard from './GlassCard';
import ConfirmDialog, { DialogType } from './ConfirmDialog';
import { Location, Asset } from '../types';
import { MapPin, Plus, X, Trash2, Loader, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LocationManagementProps {
  locations: Location[];
  assets: Asset[];
  onAdd: (location: Omit<Location, 'id'>) => Promise<void>;
  onUpdate: (location: Location) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

const initialForm: Omit<Location, 'id'> = {
  name: '',
  city: '',
  comments: ''
};

const LocationManagement: React.FC<LocationManagementProps> = ({ locations, assets, onAdd, onUpdate, onDelete, canCreate = true, canUpdate = true, canDelete = true }) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<Omit<Location, 'id'>>(initialForm);
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

  const locationTagPalettes = [
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

  const getLocationTagStyle = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
      hash = (hash * 31 + name.charCodeAt(i)) % locationTagPalettes.length;
    }
    const palette = locationTagPalettes[hash];
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

  const [formErrors, setFormErrors] = useState<{ name?: string; city?: string }>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(search.toLowerCase()) ||
    loc.city.toLowerCase().includes(search.toLowerCase())
  );

  // Compute usage counts
  const locationUsage = useMemo(() => {
    const usage: Record<string, number> = {};
    locations.forEach(loc => {
      usage[loc.id] = assets.filter(a => a.location === loc.name).length;
    });
    return usage;
  }, [locations, assets]);

  const openNew = () => {
    setForm(initialForm);
    setEditingId(null);
    setIsModalOpen(true);
    setFormErrors({});
  };

  const openEdit = (location: Location) => {
    setForm(location);
    setEditingId(location.id);
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
    const errors: { name?: string; city?: string } = {};
    
    if (!form.name || form.name.trim() === '') {
      errors.name = 'Location name is required';
    }
    
    if (!form.city || form.city.trim() === '') {
      errors.city = 'City is required';
    }
    
    // Check for duplicate location names (case-insensitive)
    if (form.name && form.name.trim() !== '') {
      const existingLocation = locations.find(loc =>
        loc.name.toLowerCase() === form.name.toLowerCase() && (!editingId || loc.id !== editingId)
      );

      if (existingLocation) {
        errors.name = `Location "${form.name}" already exists`;
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setFormErrors({});
    setIsSubmitting(true);

    try {
      if (editingId) {
        await onUpdate({ ...form, id: editingId });
      } else {
        await onAdd(form);
      }
      closeModal();
    } catch (error) {
      // Error is already handled in the handler
      console.error('Error submitting location:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (location: Location) => {
    const usageCount = locationUsage[location.id] || 0;
    
    if (usageCount > 0) {
      setDialogState({
        isOpen: true,
        type: DialogType.ERROR,
        title: 'Cannot Delete Location',
        message: `Cannot delete ${location.name}. It has ${usageCount} asset(s) assigned. Please reassign them first.`,
        onConfirm: undefined
      });
      return;
    }
  
    setDialogState({
      isOpen: true,
      type: DialogType.CONFIRM,
      title: 'Delete Location',
      message: `Are you sure you want to delete "${location.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await onDelete(location.id);
          // Close the dialog after successful deletion
          setDialogState(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          // Error is already handled in the handler
          console.error('Error deleting location:', error);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <GlassCard>
        {canCreate && (
          <div className="flex justify-end mb-4">
            <button
              onClick={openNew}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-600 text-white text-sm font-semibold shadow-lg shadow-green-600/20 hover:-translate-y-0.5 hover:bg-green-700 transition-transform"
            >
              <Plus size={18} />
              Add Location
            </button>
          </div>
        )}
        <div>
          {locations.length === 0 ? (
            <div className="text-center py-12">
              <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 font-medium mb-2">No locations yet</p>
              <p className="text-sm text-gray-500">Add your first location to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {filteredLocations.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/60"
                  >
                    <p className="text-gray-700 font-semibold mb-1">No locations yet</p>
                    <p className="text-gray-500 text-sm">Add your first location to standardize asset locations.</p>
                  </motion.div>
                )}

                <div className="flex flex-wrap gap-3">
                  {filteredLocations.map((location, index) => {
                    const tagStyle = getLocationTagStyle(location.name);
                    return (
                      <motion.div
                        key={location.id}
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
                            <MapPin size={14} />
                          </div>
                          <span className="font-medium text-gray-800">{location.name}</span>
                          <span className="text-xs px-2 py-1 rounded-full" style={tagStyle.meta}>
                            {location.city}
                          </span>
                          {location.comments && (
                            <span className="text-xs px-2 py-1 rounded-full truncate max-w-[100px]" style={tagStyle.meta}>
                              {location.comments}
                            </span>
                          )}
                          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={tagStyle.meta}>
                            {locationUsage[location.id] || 0}
                          </span>
                        </div>
                        <div className="absolute -top-2 -right-2 flex gap-1">
                          {canUpdate && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => openEdit(location)}
                              className="p-1 bg-blue-50 text-blue-600 rounded-full transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </motion.button>
                          )}
                          {canDelete && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleDelete(location)}
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
          )}
        </div>
      </GlassCard>

      {/* Add Location Modal */}
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
                <div className="p-2 rounded-lg bg-green-100 text-green-700">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{editingId ? 'Edit Location' : 'Add Location'}</p>
                  <h4 className="text-lg font-bold text-gray-800">{editingId ? 'Edit Location' : 'New Location'}</h4>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Location Name *</label>
                  <input
                    required
                    disabled={isSubmitting}
                    className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
                      formErrors.name 
                        ? 'border-red-300 focus:ring-red-100' 
                        : 'border-gray-200 focus:ring-green-100'
                    }`}
                    value={form.name}
                    onChange={e => {
                      setForm(prev => ({ ...prev, name: e.target.value }));
                      if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                    }}
                    placeholder="e.g. HQ - Building A"
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">City *</label>
                  <input
                    required
                    disabled={isSubmitting}
                    className={`w-full p-3 bg-gray-50 border rounded-xl focus:ring-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
                      formErrors.city 
                        ? 'border-red-300 focus:ring-red-100' 
                        : 'border-gray-200 focus:ring-green-100'
                    }`}
                    value={form.city}
                    onChange={e => {
                      setForm(prev => ({ ...prev, city: e.target.value }));
                      if (formErrors.city) setFormErrors(prev => ({ ...prev, city: undefined }));
                    }}
                    placeholder="e.g. San Francisco"
                  />
                  {formErrors.city && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.city}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Comments</label>
                  <textarea
                    disabled={isSubmitting}
                    rows={3}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity resize-none"
                    value={form.comments}
                    onChange={e => setForm(prev => ({ ...prev, comments: e.target.value }))}
                    placeholder="Additional notes about this location (optional)"
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
                        {editingId ? 'Updating...' : 'Adding...'}
                      </>
                    ) : (
                      <>
                        {editingId ? <Edit2 size={16} /> : <Plus size={16} />}
                        {editingId ? 'Update Location' : 'Add Location'}
                      </>
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

export default LocationManagement;
