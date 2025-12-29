import React, { useMemo, useState } from 'react';
import GlassCard from './GlassCard';
import ConfirmDialog, { DialogType } from './ConfirmDialog';
import { Location, Asset } from '../types';
import { MapPin, Search, Plus, X, Pencil, Trash2, Loader } from 'lucide-react';
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
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
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

  // Compute usage counts
  const locationUsage = useMemo(() => {
    const usage: Record<string, number> = {};
    locations.forEach(loc => {
      usage[loc.id] = assets.filter(a => a.location === loc.name).length;
    });
    return usage;
  }, [locations, assets]);

  const filteredLocations = useMemo(() => {
    return locations.filter(location => {
      const matchesSearch =
        location.name.toLowerCase().includes(search.toLowerCase()) ||
        location.city.toLowerCase().includes(search.toLowerCase()) ||
        location.comments?.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [locations, search]);

  const openNew = () => {
    setEditingLocation(null);
    setForm(initialForm);
    setIsModalOpen(true);
  };

  const openEdit = (location: Location) => {
    setEditingLocation(location);
    setForm({
      name: location.name,
      city: location.city,
      comments: location.comments
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLocation(null);
    setForm(initialForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingLocation) {
        await onUpdate({ ...editingLocation, ...form });
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
    const usage = locationUsage[location.id] || 0;
    
    if (usage > 0) {
      setDialogState({
        isOpen: true,
        type: DialogType.ERROR,
        title: 'Cannot Delete Location',
        message: `Cannot delete ${location.name}. It has ${usage} asset(s) assigned. Please reassign them first.`,
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
        } catch (error) {
          // Error is already handled in the handler
          console.error('Error deleting location:', error);
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {canCreate && (
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold shadow-lg shadow-gray-900/20 hover:-translate-y-0.5 transition-transform"
          >
            <Plus size={18} />
            Add Location
          </button>
        )}
      </div>

      <GlassCard>
        <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl w-full md:w-80">
            <Search size={16} className="text-gray-400" />
            <input
              className="w-full bg-transparent focus:outline-none text-sm"
              placeholder="Search by name, city, or comments"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

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
              {filteredLocations.map((location, index) => (
                <motion.div
                  key={location.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                  className="relative"
                >
                  <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center text-gray-700">
                      <MapPin size={14} />
                    </div>
                    <span className="font-medium text-gray-800">{location.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{location.city}</span>
                    {location.comments && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full truncate max-w-[100px]">
                        {location.comments}
                      </span>
                    )}
                    <span className="text-xs text-gray-600 font-semibold bg-gray-100 px-2 py-1 rounded-full">
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
                        <Pencil size={14} />
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
              ))}
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
                <div className="p-2 rounded-lg bg-green-100 text-green-700">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{editingLocation ? 'Edit Location' : 'Add Location'}</p>
                  <h4 className="text-lg font-bold text-gray-800">Location Details</h4>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">Location Name *</label>
                  <input
                    required
                    disabled={isSubmitting}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. HQ - Building A"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-1">City *</label>
                  <input
                    required
                    disabled={isSubmitting}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    value={form.city}
                    onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="e.g. San Francisco"
                  />
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
                        {editingLocation ? 'Saving...' : 'Creating...'}
                      </>
                    ) : (
                      <>{editingLocation ? 'Save Changes' : 'Create Location'}</>
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




