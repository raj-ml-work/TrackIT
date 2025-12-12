import React, { useMemo, useState } from 'react';
import GlassCard from './GlassCard';
import { Location, Asset } from '../types';
import { MapPin, Search, Plus, X, Pencil, Trash2, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LocationManagementProps {
  locations: Location[];
  assets: Asset[];
  onAdd: (location: Omit<Location, 'id'>) => Promise<void>;
  onUpdate: (location: Location) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canDelete?: boolean;
}

const initialForm: Omit<Location, 'id'> = {
  name: '',
  city: '',
  comments: ''
};

const LocationManagement: React.FC<LocationManagementProps> = ({ locations, assets, onAdd, onUpdate, onDelete, canDelete = true }) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [form, setForm] = useState<Omit<Location, 'id'>>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ name?: string; city?: string }>({});

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
        loc.name.toLowerCase() === form.name.toLowerCase() && 
        loc.id !== editingLocation?.id
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
      alert(`Cannot delete ${location.name}. It has ${usage} asset(s) assigned. Please reassign them first.`);
      return;
    }

    if (confirm(`Are you sure you want to delete ${location.name}?`)) {
      try {
        await onDelete(location.id);
      } catch (error) {
        // Error is already handled in the handler
        console.error('Error deleting location:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold shadow-lg shadow-gray-900/20 hover:-translate-y-0.5 transition-transform"
        >
          <Plus size={18} />
          Add Location
        </button>
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

        <div className="space-y-2">
          <div className="grid grid-cols-12 text-xs text-gray-400 px-2">
            <span className="col-span-4">Location Name</span>
            <span className="col-span-3">City</span>
            <span className="col-span-3">Comments</span>
            <span className="col-span-1">Usage</span>
            <span className="col-span-1"></span>
          </div>

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

            {filteredLocations.map((location, index) => (
              <motion.div
                key={location.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.01 }}
                className="grid grid-cols-12 items-center px-3 py-3 rounded-xl hover:bg-white/60 transition-all border border-transparent hover:border-gray-100 hover:shadow-sm"
              >
                <div className="col-span-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center text-gray-700">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 leading-tight">{location.name}</p>
                    </div>
                  </div>
                </div>
                <div className="col-span-3">
                  <p className="text-sm text-gray-700">{location.city}</p>
                </div>
                <div className="col-span-3">
                  <p className="text-sm text-gray-600 truncate">{location.comments || '—'}</p>
                </div>
                <div className="col-span-1">
                  <div className="text-xs text-gray-600 font-semibold">
                    {locationUsage[location.id] || 0}
                  </div>
                </div>
                <div className="col-span-1 flex items-center gap-2 justify-end">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openEdit(location)}
                    className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </motion.button>
                  {canDelete && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDelete(location)}
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
    </div>
  );
};

export default LocationManagement;




