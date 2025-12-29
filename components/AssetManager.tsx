import React, { useState, useEffect } from 'react';
import { Asset, AssetStatus, AssetType, AssetSpecs, AssetCommentType, Location, Employee, EmployeeStatus } from '../types';
import GlassCard from './GlassCard';
import { Search, Filter, Plus, Edit2, Trash2, X, Check, Laptop, Monitor, Smartphone, HardDrive, Printer, Box, Tv, Projector as ProjectorIcon, ArrowRight, ArrowLeft, Calendar, IndianRupee, MapPin, Hash, User, FileText, Cpu, Layers, MessageSquare, Send, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AssetManagerProps {
  assets: Asset[];
  employees?: Employee[];
  locations: Location[];
  onAdd: (asset: Omit<Asset, 'id'>) => Promise<void>;
  onUpdate: (asset: Asset) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddComment: (assetId: string, message: string) => Promise<void>;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

const initialSpecs: AssetSpecs = {
  brand: '',
  model: '',
  cpu: '',
  ram: '',
  storage: '',
  screenSize: '',
  printerType: 'Color'
};

const initialAsset: Omit<Asset, 'id'> = {
  name: '',
  type: AssetType.LAPTOP,
  status: AssetStatus.AVAILABLE,
  serialNumber: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  warrantyExpiry: '',
  cost: 0,
  location: '',
  specs: initialSpecs
};

const getIcon = (type: AssetType) => {
  switch (type) {
    case AssetType.LAPTOP: return <Laptop size={18} />;
    case AssetType.DESKTOP: return <Box size={18} />;
    case AssetType.MONITOR: return <Monitor size={18} />;
    case AssetType.MOBILE: return <Smartphone size={18} />;
    case AssetType.PRINTER: return <Printer size={18} />;
    case AssetType.TV: return <Tv size={18} />;
    case AssetType.PROJECTOR: return <ProjectorIcon size={18} />;
    default: return <HardDrive size={18} />;
  }
};

const AssetManager: React.FC<AssetManagerProps> = ({ assets, employees = [], locations, onAdd, onUpdate, onDelete, onAddComment, canCreate = true, canUpdate = true, canDelete = true }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<AssetType | 'All'>('All');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Asset, 'id'>>(initialAsset);
  const [formErrors, setFormErrors] = useState<{ 
    name?: string; 
    serialNumber?: string; 
    location?: string;
    locationId?: string;
    assignedTo?: string; 
    assignedToId?: string;
    status?: string;
    purchaseDate?: string;
    cost?: string;
  }>({});

  // Details Drawer State (for backward compatibility, but we'll use modal)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  
  // Modal-based view state (new approach)
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  
  // Comment State
  const [commentText, setCommentText] = useState('');

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          asset.specs?.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          asset.specs?.model?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'All' || asset.type === filterType;
    return matchesSearch && matchesFilter;
  });

  // Update selected asset when assets change (e.g., when a comment is added)
  useEffect(() => {
    if (selectedAsset) {
      const updated = assets.find(a => a.id === selectedAsset.id);
      if (updated) {
        setSelectedAsset(updated);
      }
    }
  }, [assets, selectedAsset?.id]);

  const hasExtraSpecs = (type: AssetType) => {
    return [
      AssetType.LAPTOP, 
      AssetType.DESKTOP, 
      AssetType.MOBILE, 
      AssetType.MONITOR, 
      AssetType.TV, 
      AssetType.PRINTER
    ].includes(type);
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasExtraSpecs(formData.type)) {
      setCurrentStep(2);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Validate all required fields
    const errors: { 
      name?: string; 
      serialNumber?: string; 
      location?: string;
      locationId?: string;
      assignedTo?: string; 
      assignedToId?: string;
      status?: string;
      purchaseDate?: string;
      cost?: string;
    } = {};
    
    // Required field validations
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Asset name is required';
    }
    
    if (!formData.serialNumber || formData.serialNumber.trim() === '') {
      errors.serialNumber = 'Serial number is required';
    }
    
    if (!formData.locationId && (!formData.location || formData.location.trim() === '')) {
      errors.locationId = 'Location is required';
      errors.location = 'Location is required';
    }
    
    if (!formData.purchaseDate || formData.purchaseDate.trim() === '') {
      errors.purchaseDate = 'Purchase date is required';
    }
    
    if (formData.cost === undefined || formData.cost === null || formData.cost < 0) {
      errors.cost = 'Cost must be a valid number (0 or greater)';
    }
    
    // If status is "In Use", assignedToId must be set
    const assignedToId = formData.assignedToId || formData.employeeId;
    if (formData.status === AssetStatus.IN_USE && !assignedToId) {
      errors.assignedToId = 'An employee must be assigned when status is "In Use"';
      errors.status = 'Status cannot be "In Use" without an assigned employee';
    }
    
    // If there are validation errors, show them and prevent submission
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    // If assignedToId is set, ensure status is "In Use"
    // If assignedToId is not set and status is "In Use", change to "Available"
    const finalFormData = {
      ...formData,
      assignedToId: assignedToId || undefined,
      employeeId: assignedToId || undefined,
      status: assignedToId 
        ? AssetStatus.IN_USE 
        : (formData.status === AssetStatus.IN_USE ? AssetStatus.AVAILABLE : formData.status)
    };
    
    setFormErrors({});
    
    try {
      if (editingId) {
        await onUpdate({ ...finalFormData, id: editingId });
        // If we are editing the currently viewed asset, update the view as well
        if (selectedAsset && selectedAsset.id === editingId) {
          setSelectedAsset({ ...finalFormData, id: editingId } as Asset);
        }
      } else {
        await onAdd(finalFormData);
      }
      closeModal();
    } catch (error) {
      // Error is already handled in the handler
      console.error('Error submitting asset:', error);
    }
  };

  const openEdit = (asset: Asset) => {
    // Use assignedToId or employeeId if available, otherwise try to find employee by name
    let assignedToId = asset.assignedToId || asset.employeeId;
    if (!assignedToId && asset.assignedTo) {
      const employee = employees.find(emp => emp.name === asset.assignedTo);
      assignedToId = employee?.id;
    }
    
    // Use locationId if available, otherwise try to find location by name
    let locationId = asset.locationId;
    if (!locationId && asset.location) {
      const location = locations.find(loc => loc.name === asset.location);
      locationId = location?.id;
    }
    
    setFormData({
        ...asset,
        assignedToId: assignedToId,
        employeeId: assignedToId,
        locationId: locationId,
        specs: { ...initialSpecs, ...asset.specs, ...asset.assetSpecs }
    });
    setEditingId(asset.id);
    setCurrentStep(1);
    setIsModalOpen(true);
    setFormErrors({});
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setCurrentStep(1);
    setFormData(initialAsset);
    setFormErrors({});
  };

  const updateSpecs = (field: keyof AssetSpecs, value: string) => {
    setFormData(prev => ({
      ...prev,
      specs: {
        ...prev.specs,
        [field]: value
      }
    }));
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset || !commentText.trim()) return;
    
    try {
      await onAddComment(selectedAsset.id, commentText.trim());
      setCommentText('');
    } catch (error) {
      // Error is already handled in the handler
      console.error('Error adding comment:', error);
    }
  };

  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      {/* Core Identifiers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Friendly Name *</label>
          <input 
            required 
            type="text" 
            className={`w-full p-2 bg-gray-50 border rounded-lg outline-none transition-all ${
              formErrors.name ? 'border-red-300 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:ring-2 focus:ring-blue-500/20'
            }`}
            value={formData.name} 
            onChange={e => {
              setFormData({...formData, name: e.target.value});
              if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
            }} 
            placeholder="e.g. Designer Workstation 1" 
          />
          {formErrors.name && (
            <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Type *</label>
          <select className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"
            value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as AssetType})}>
              {Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
           <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Status *</label>
           <select 
             className={`w-full p-2 bg-gray-50 border rounded-lg outline-none transition-all ${
               formErrors.status ? 'border-red-300 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:ring-2 focus:ring-blue-500/20'
             }`}
             value={formData.status} 
             onChange={e => {
               const newStatus = e.target.value as AssetStatus;
               const errors: { assignedTo?: string; status?: string } = {};
               
               // If setting status to "In Use" but no one is assigned, show error
               const assignedToId = formData.assignedToId || formData.employeeId;
               const statusErrors: { assignedToId?: string; status?: string } = {};
               if (newStatus === AssetStatus.IN_USE && !assignedToId) {
                 statusErrors.assignedToId = 'An employee must be assigned when status is "In Use"';
                 statusErrors.status = 'Please assign an employee first';
                 setFormErrors(prev => ({ ...prev, ...statusErrors }));
               } else {
                 // Clear errors if valid
                 setFormErrors(prev => {
                   const newErrors = { ...prev };
                   delete newErrors.assignedToId;
                   delete newErrors.status;
                   return newErrors;
                 });
               }
               
               setFormData({...formData, status: newStatus});
               setFormErrors(errors);
             }}
           >
               {Object.values(AssetStatus).map(s => <option key={s} value={s}>{s}</option>)}
           </select>
           {formErrors.status && (
             <p className="mt-1 text-xs text-red-600">{formErrors.status}</p>
           )}
        </div>
      </div>

      {/* Common Brand/Model Info */}
      <div className="grid grid-cols-2 gap-4">
         <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Brand</label>
            <input type="text" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
               value={formData.specs?.brand} onChange={e => updateSpecs('brand', e.target.value)} placeholder="e.g. Dell, Apple" />
         </div>
         <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Model</label>
            <input type="text" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
               value={formData.specs?.model} onChange={e => updateSpecs('model', e.target.value)} placeholder="e.g. XPS 15" />
         </div>
      </div>

      {/* Tracking Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Serial Number *</label>
          <input 
            required 
            type="text" 
            className={`w-full p-2 bg-gray-50 border rounded-lg outline-none transition-all ${
              formErrors.serialNumber ? 'border-red-300 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:ring-2 focus:ring-blue-500/20'
            }`}
            value={formData.serialNumber} 
            onChange={e => {
              setFormData({...formData, serialNumber: e.target.value});
              if (formErrors.serialNumber) setFormErrors(prev => ({ ...prev, serialNumber: undefined }));
            }} 
            placeholder="S/N" 
          />
          {formErrors.serialNumber && (
            <p className="mt-1 text-xs text-red-600">{formErrors.serialNumber}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Location *</label>
          <select 
            className={`w-full p-2 bg-gray-50 border rounded-lg outline-none transition-all ${
              formErrors.location || formErrors.locationId ? 'border-red-300 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:ring-2 focus:ring-blue-500/20'
            }`}
            value={formData.locationId || formData.location || ''}
            onChange={e => {
              const selectedLocation = locations.find(loc => loc.id === e.target.value);
              setFormData({
                ...formData, 
                locationId: e.target.value || undefined,
                location: selectedLocation?.name || ''
              });
              if (formErrors.location || formErrors.locationId) {
                setFormErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.location;
                  delete newErrors.locationId;
                  return newErrors;
                });
              }
            }}
          >
            <option value="">Select Location</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name} - {loc.city}</option>
            ))}
          </select>
          {(formErrors.location || formErrors.locationId) && (
            <p className="mt-1 text-xs text-red-600">{formErrors.location || formErrors.locationId}</p>
          )}
        </div>
      </div>

      {/* Financials */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Cost (₹)</label>
          <input type="number" min="0" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            value={formData.cost} onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Purchase Date *</label>
          <input 
            type="date" 
            className={`w-full p-2 bg-gray-50 border rounded-lg outline-none transition-all ${
              formErrors.purchaseDate ? 'border-red-300 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:ring-2 focus:ring-blue-500/20'
            }`}
            value={formData.purchaseDate} 
            onChange={e => {
              setFormData({...formData, purchaseDate: e.target.value});
              if (formErrors.purchaseDate) setFormErrors(prev => ({ ...prev, purchaseDate: undefined }));
            }} 
          />
          {formErrors.purchaseDate && (
            <p className="mt-1 text-xs text-red-600">{formErrors.purchaseDate}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Warranty Expiry</label>
          <input 
            type="date" 
            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            value={formData.warrantyExpiry} 
            onChange={e => setFormData({...formData, warrantyExpiry: e.target.value})} 
          />
        </div>
      </div>
      
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Assigned To</label>
        <select 
          className={`w-full p-2 bg-gray-50 border rounded-lg outline-none transition-all ${
            formErrors.assignedTo || formErrors.assignedToId ? 'border-red-300 focus:ring-2 focus:ring-red-500/20' : 'border-gray-200 focus:ring-2 focus:ring-blue-500/20'
          }`}
          value={formData.assignedToId || formData.employeeId || ''}
          onChange={e => {
            const newAssignedToId = e.target.value || undefined;
            const selectedEmployee = employees.find(emp => emp.id === newAssignedToId);
            
            // If assigning to someone, automatically set status to "In Use"
            if (newAssignedToId && selectedEmployee) {
              setFormData(prev => ({ 
                ...prev, 
                assignedToId: newAssignedToId,
                employeeId: newAssignedToId,
                assignedTo: selectedEmployee.name, // Keep for display/backward compatibility
                status: AssetStatus.IN_USE 
              }));
              // Clear any errors since assignment is valid
              setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.assignedTo;
                delete newErrors.assignedToId;
                delete newErrors.status;
                return newErrors;
              });
            } else {
              // If unassigning, set status to "Available" if it was "In Use"
              setFormData(prev => ({ 
                ...prev, 
                assignedToId: undefined,
                employeeId: undefined,
                assignedTo: undefined,
                status: prev.status === AssetStatus.IN_USE ? AssetStatus.AVAILABLE : prev.status
              }));
              // Clear errors
              setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.assignedTo;
                delete newErrors.assignedToId;
                delete newErrors.status;
                return newErrors;
              });
            }
          }}
        >
          <option value="">Unassigned</option>
          {employees
            .filter(emp => emp.status === EmployeeStatus.ACTIVE)
            .map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name || `${emp.employeeId}`} - {emp.employeeId} {emp.department ? `(${emp.department})` : ''}
              </option>
            ))}
        </select>
        {(formErrors.assignedTo || formErrors.assignedToId) && (
          <p className="mt-1 text-xs text-red-600">{formErrors.assignedTo || formErrors.assignedToId}</p>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => {
    const type = formData.type;
    const isComputing = type === AssetType.LAPTOP || type === AssetType.DESKTOP || type === AssetType.MOBILE;
    const isDisplay = type === AssetType.MONITOR || type === AssetType.TV;
    const isPrinter = type === AssetType.PRINTER;

    return (
      <div className="space-y-6">
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm text-blue-600">
            {getIcon(type)}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{type} Specifications</h3>
            <p className="text-xs text-gray-500 mt-1">Please provide the technical details specific to this device type.</p>
          </div>
        </div>

        <div className="bg-gray-50/50 p-6 rounded-xl space-y-4 border border-gray-100">
          {/* Computing Specs */}
          {isComputing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {(type === AssetType.LAPTOP || type === AssetType.DESKTOP) && (
                   <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Processor (CPU)</label>
                      <input type="text" className="w-full p-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
                         value={formData.specs?.cpu} onChange={e => updateSpecs('cpu', e.target.value)} placeholder="e.g. Intel Core i7-12700H, Apple M2 Max" />
                   </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Memory (RAM)</label>
                  <input type="text" className="w-full p-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
                      value={formData.specs?.ram} onChange={e => updateSpecs('ram', e.target.value)} placeholder="e.g. 16GB, 32GB" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Storage</label>
                  <input type="text" className="w-full p-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
                      value={formData.specs?.storage} onChange={e => updateSpecs('storage', e.target.value)} placeholder="e.g. 512GB SSD" />
                </div>
              </div>
            </div>
          )}

          {/* Display Specs */}
          {isDisplay && (
            <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Screen Size</label>
                <input type="text" className="w-full p-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
                   value={formData.specs?.screenSize} onChange={e => updateSpecs('screenSize', e.target.value)} placeholder="e.g. 27 inch, 55 inch" />
            </div>
          )}

          {/* Printer Specs */}
          {isPrinter && (
             <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Output Type</label>
                <select className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none"
                   value={formData.specs?.printerType} onChange={e => updateSpecs('printerType', e.target.value)}>
                     <option value="Color">Color</option>
                     <option value="Monochrome">Black & White</option>
                </select>
             </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {canCreate && (
        <div className="flex justify-end">
          <button
            onClick={() => { setCurrentStep(1); setIsModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold shadow-lg shadow-gray-900/20 hover:-translate-y-0.5 transition-transform"
          >
            <Plus size={18} />
            Add Asset
          </button>
        </div>
      )}

      <GlassCard>
        <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl w-full md:w-80">
            <Search size={16} className="text-gray-400" />
            <input
              className="w-full bg-transparent focus:outline-none text-sm"
              placeholder="Search assets by name, serial number, brand, or model"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Type</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as AssetType | 'All')}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none"
            >
              <option value="All">All Types</option>
              {Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Asset List */}
        <div className="space-y-2">
          <div className="grid grid-cols-12 text-xs text-gray-400 px-2">
            <span className="col-span-4">Asset</span>
            <span className="col-span-2">Location</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-2">Assigned To</span>
            <span className="col-span-2 text-right">Actions</span>
          </div>

          <AnimatePresence>
            {filteredAssets.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 text-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/60"
              >
                <p className="text-gray-700 font-semibold mb-1">No assets found</p>
                <p className="text-gray-500 text-sm">Try adjusting your search or filters, or add a new asset.</p>
              </motion.div>
            )}

            {filteredAssets.map((asset, index) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.01 }}
                className="grid grid-cols-12 items-center px-3 py-3 rounded-xl hover:bg-white/60 transition-all border border-transparent hover:border-gray-100 hover:shadow-sm"
              >
                <div className="col-span-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${
                      asset.status === AssetStatus.IN_USE ? 'bg-blue-100 text-blue-600' : 
                      asset.status === AssetStatus.AVAILABLE ? 'bg-green-100 text-green-600' : 
                      asset.status === AssetStatus.RETIRED ? 'bg-red-100 text-red-600' :
                      'bg-yellow-100 text-yellow-600'
                    }`}>
                      {getIcon(asset.type)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 leading-tight">{asset.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                        <span>{asset.serialNumber}</span>
                        {asset.specs?.brand && (
                          <>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <span className="font-sans">{asset.specs.brand} {asset.specs.model}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-700">{asset.location}</p>
                </div>
                <div className="col-span-2">
                  <span className={`inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    asset.status === AssetStatus.IN_USE ? 'bg-blue-100 text-blue-800' :
                    asset.status === AssetStatus.AVAILABLE ? 'bg-green-100 text-green-800' :
                    asset.status === AssetStatus.RETIRED ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {asset.status}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-700">{asset.assignedTo || 'Unassigned'}</p>
                </div>
                <div className="col-span-2 flex items-center gap-2 justify-end">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setViewingAsset(asset)}
                    className="p-2 hover:bg-green-50 text-green-600 rounded-lg transition-colors"
                    title="View Details"
                  >
                    <Eye size={16} />
                  </motion.button>
                  {canUpdate && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(asset); }}
                      className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await onDelete(asset.id);
                        } catch (error) {
                          console.error('Error deleting asset:', error);
                        }
                      }}
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

      {/* Asset Detail Modal (New Modal-based Approach) */}
      <AnimatePresence>
        {viewingAsset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setViewingAsset(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <button className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" onClick={() => setViewingAsset(null)}>
                <X size={18} />
              </button>

              {/* Asset Header */}
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-4 bg-gray-100 rounded-2xl text-gray-700">
                    {getIcon(viewingAsset.type)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900">{viewingAsset.name}</h3>
                    <p className="text-sm font-mono text-gray-600">Serial: {viewingAsset.serialNumber}</p>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    viewingAsset.status === AssetStatus.IN_USE ? 'bg-blue-100 text-blue-800' :
                    viewingAsset.status === AssetStatus.AVAILABLE ? 'bg-green-100 text-green-800' :
                    viewingAsset.status === AssetStatus.RETIRED ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {viewingAsset.status}
                  </span>
                </div>

              {/* Asset Details Grid */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-gray-400 mt-1" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Location</p>
                    <p className="text-sm text-gray-800">{viewingAsset.location}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <User size={16} className="text-gray-400 mt-1" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Assigned To</p>
                    <p className="text-sm text-gray-800">{viewingAsset.assignedTo || 'Unassigned'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <IndianRupee size={16} className="text-gray-400 mt-1" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Cost</p>
                    <p className="text-sm text-gray-800">₹{viewingAsset.cost.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar size={16} className="text-gray-400 mt-1" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Purchased</p>
                    <p className="text-sm text-gray-800">{viewingAsset.purchaseDate}</p>
                  </div>
                </div>
              </div>
            </div>

              {/* Specs Section */}
              {viewingAsset.specs && (
                <div className="border-t pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Cpu size={20} className="text-gray-600" />
                    <h4 className="text-lg font-bold text-gray-900">Hardware Specs</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                    {viewingAsset.specs.brand && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 uppercase">Brand</span>
                        <p className="text-sm text-gray-800">{viewingAsset.specs.brand}</p>
                      </div>
                    )}
                    {viewingAsset.specs.model && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 uppercase">Model</span>
                        <p className="text-sm text-gray-800">{viewingAsset.specs.model}</p>
                      </div>
                    )}
                    {viewingAsset.specs.cpu && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 uppercase">Processor</span>
                        <p className="text-sm text-gray-800">{viewingAsset.specs.cpu}</p>
                      </div>
                    )}
                    {viewingAsset.specs.ram && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 uppercase">Memory</span>
                        <p className="text-sm text-gray-800">{viewingAsset.specs.ram}</p>
                      </div>
                    )}
                    {viewingAsset.specs.storage && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 uppercase">Storage</span>
                        <p className="text-sm text-gray-800">{viewingAsset.specs.storage}</p>
                      </div>
                    )}
                    {viewingAsset.specs.screenSize && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 uppercase">Display</span>
                        <p className="text-sm text-gray-800">{viewingAsset.specs.screenSize}</p>
                      </div>
                    )}
                    {viewingAsset.specs.printerType && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 uppercase">Type</span>
                        <p className="text-sm text-gray-800">{viewingAsset.specs.printerType}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div className="border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={20} className="text-gray-600" />
                  <h4 className="text-lg font-bold text-gray-900">Comments & Activity</h4>
                  <span className="text-sm text-gray-500">({viewingAsset.comments?.length || 0})</span>
                </div>

                {viewingAsset.comments && viewingAsset.comments.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {viewingAsset.comments
                      .slice()
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((comment) => (
                        <motion.div
                          key={comment.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-4 rounded-xl border ${
                            comment.type === AssetCommentType.SYSTEM
                              ? 'bg-blue-50/50 border-blue-100'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold ${
                                comment.type === AssetCommentType.SYSTEM
                                  ? 'bg-blue-200 text-blue-700'
                                  : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                              }`}>
                                {comment.type === AssetCommentType.SYSTEM ? 'S' : comment.authorName.substring(0, 1)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{comment.authorName}</p>
                                <p className="text-xs text-gray-500">{getRelativeTime(comment.createdAt)}</p>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              comment.type === AssetCommentType.SYSTEM
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {comment.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{comment.message}</p>
                        </motion.div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl bg-gray-50">
                    <MessageSquare size={32} className="mx-auto text-gray-300 mb-2 opacity-50" />
                    <p className="text-sm text-gray-600">No comments yet</p>
                    <p className="text-xs text-gray-500">Start a conversation about this asset</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Drawer (Old Approach - Keeping for backward compatibility) */}
      <AnimatePresence>
        {selectedAsset && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedAsset(null)}
            >
              <div className="p-8 space-y-8">
                {/* Header */}
                <div className="flex justify-between items-start">
                   <button onClick={() => setSelectedAsset(null)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                     <X size={24} />
                   </button>
                   <div className="flex gap-2">
                      {canUpdate && (
                        <button onClick={() => openEdit(selectedAsset)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">
                          <Edit2 size={20} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={async () => {
                            if(confirm('Delete this asset?')) {
                              try {
                                await onDelete(selectedAsset.id);
                                setSelectedAsset(null);
                              } catch (error) {
                                console.error('Error deleting asset:', error);
                              }
                            }
                          }}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                   </div>
                </div>

              {/* Asset Header */}
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`p-4 rounded-2xl ${
                    selectedAsset.status === AssetStatus.IN_USE ? 'bg-blue-100 text-blue-600' : 
                    selectedAsset.status === AssetStatus.AVAILABLE ? 'bg-green-100 text-green-600' : 
                    selectedAsset.status === AssetStatus.RETIRED ? 'bg-red-100 text-red-600' :
                    'bg-yellow-100 text-yellow-600'
                  }`}>
                    {getIcon(selectedAsset.type)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900">{selectedAsset.name}</h3>
                    <p className="text-sm text-gray-600">{selectedAsset.type}</p>
                  </div>
                </div>

                <div className="h-px bg-gray-100 w-full" />

                {/* Main Info */}
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Primary Details</h3>
                  <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                     <div className="flex items-start gap-3">
                        <Hash className="text-gray-400 mt-0.5" size={18} />
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Serial</p>
                          <p className="font-mono text-gray-800">{selectedAsset.serialNumber}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-3">
                        <MapPin className="text-gray-400 mt-0.5" size={18} />
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Location</p>
                          <p className="text-gray-800">{selectedAsset.location}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-3 col-span-2">
                        <User className="text-gray-400 mt-0.5" size={18} />
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Assigned To</p>
                          <p className="text-gray-800 font-medium">{selectedAsset.assignedTo || 'Unassigned'}</p>
                        </div>
                     </div>
                  </div>
                </div>

                {/* Financials */}
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Financials</h3>
                  <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                     <div className="flex items-start gap-3">
                       <IndianRupee className="text-gray-400 mt-0.5" size={18} />
                       <div>
                          <p className="text-xs text-gray-500 uppercase">Cost</p>
                          <p className="text-gray-800 font-mono">₹{selectedAsset.cost.toLocaleString()}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-3">
                        <Calendar className="text-gray-400 mt-0.5" size={18} />
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Purchased</p>
                          <p className="text-gray-800">{selectedAsset.purchaseDate}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-3 col-span-2">
                        <FileText className="text-gray-400 mt-0.5" size={18} />
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Warranty Expiry</p>
                          <p className="text-gray-800">{selectedAsset.warrantyExpiry}</p>
                        </div>
                     </div>
                  </div>
                </div>

                {/* Specs */}
                {selectedAsset.specs && (
                  <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <Cpu className="text-gray-500" size={18} />
                        <h3 className="text-sm font-bold text-gray-700">Hardware Specs</h3>
                     </div>
                     <div className="space-y-3">
                        {selectedAsset.specs.brand && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Brand</span>
                            <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.brand}</span>
                          </div>
                        )}
                        {selectedAsset.specs.model && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Model</span>
                            <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.model}</span>
                          </div>
                        )}
                        {selectedAsset.specs.cpu && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Processor</span>
                            <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.cpu}</span>
                          </div>
                        )}
                        {selectedAsset.specs.ram && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Memory</span>
                            <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.ram}</span>
                          </div>
                        )}
                        {selectedAsset.specs.storage && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Storage</span>
                            <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.storage}</span>
                          </div>
                        )}
                        {selectedAsset.specs.screenSize && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Display</span>
                            <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.screenSize}</span>
                          </div>
                        )}
                        {selectedAsset.specs.printerType && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Type</span>
                            <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.printerType}</span>
                          </div>
                        )}
                     </div>
                  </div>
                )}

                {/* Comments & Activity */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      selectedAsset.status === AssetStatus.IN_USE ? 'bg-blue-100 text-blue-800' :
                      selectedAsset.status === AssetStatus.AVAILABLE ? 'bg-green-100 text-green-800' :
                      selectedAsset.status === AssetStatus.RETIRED ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedAsset.status}
                    </span>
                    <button onClick={() => { setSelectedAsset(null); openEdit(selectedAsset); }} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors" title="Edit">
                      <Edit2 size={18} />
                    </button>
                    {canDelete && (
                      <button 
                        onClick={async () => { 
                          if(confirm('Delete this asset?')) { 
                            try {
                              await onDelete(selectedAsset.id); 
                              setSelectedAsset(null);
                            } catch (error) {
                              console.error('Error deleting asset:', error);
                            }
                          }
                        }} 
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Asset Details Grid */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-start gap-2">
                    <Hash size={16} className="text-gray-400 mt-1" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Serial Number</p>
                      <p className="text-sm font-mono text-gray-800">{selectedAsset.serialNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-gray-400 mt-1" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Location</p>
                      <p className="text-sm text-gray-800">{selectedAsset.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <User size={16} className="text-gray-400 mt-1" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Assigned To</p>
                      <p className="text-sm text-gray-800 font-medium">{selectedAsset.assignedTo || 'Unassigned'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <DollarSign size={16} className="text-gray-400 mt-1" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Cost</p>
                      <p className="text-sm font-mono text-gray-800">${selectedAsset.cost.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar size={16} className="text-gray-400 mt-1" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Purchase Date</p>
                      <p className="text-sm text-gray-800">{selectedAsset.purchaseDate}</p>
                    </div>
                  </div>
                  {selectedAsset.warrantyExpiry && (
                    <div className="flex items-start gap-2">
                      <FileText size={16} className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Warranty Expiry</p>
                        <p className="text-sm text-gray-800">{selectedAsset.warrantyExpiry}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Hardware Specs Section */}
              {selectedAsset.specs && (
                <div className="border-t pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Cpu size={20} className="text-gray-600" />
                    <h4 className="text-lg font-bold text-gray-900">Hardware Specs</h4>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    {selectedAsset.specs.brand && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Brand</span>
                        <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.brand}</span>
                      </div>
                    )}
                    {selectedAsset.specs.model && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Model</span>
                        <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.model}</span>
                      </div>
                    )}
                    {selectedAsset.specs.cpu && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Processor</span>
                        <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.cpu}</span>
                      </div>
                    )}
                    {selectedAsset.specs.ram && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Memory</span>
                        <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.ram}</span>
                      </div>
                    )}
                    {selectedAsset.specs.storage && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Storage</span>
                        <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.storage}</span>
                      </div>
                    )}
                    {selectedAsset.specs.screenSize && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Display</span>
                        <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.screenSize}</span>
                      </div>
                    )}
                    {selectedAsset.specs.printerType && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Type</span>
                        <span className="text-sm font-medium text-gray-900">{selectedAsset.specs.printerType}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comments & Activity Section */}
              <div className="border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={20} className="text-gray-600" />
                  <h4 className="text-lg font-bold text-gray-900">Comments & Activity</h4>
                  <span className="text-sm text-gray-500">({selectedAsset.comments?.length || 0})</span>
                </div>

                {/* Comments List */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 mb-4">
                    {selectedAsset.comments && selectedAsset.comments.length > 0 ? (
                      selectedAsset.comments
                        .slice()
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((comment) => (
                          <motion.div
                            key={comment.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-xl border ${
                              comment.type === AssetCommentType.SYSTEM
                                ? 'bg-blue-50/50 border-blue-100'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold ${
                                  comment.type === AssetCommentType.SYSTEM
                                    ? 'bg-blue-200 text-blue-700'
                                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                                }`}>
                                  {comment.type === AssetCommentType.SYSTEM ? 'S' : comment.authorName.substring(0, 1)}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{comment.authorName}</p>
                                  <p className="text-xs text-gray-500">{getRelativeTime(comment.createdAt)}</p>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                comment.type === AssetCommentType.SYSTEM
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {comment.type}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">{comment.message}</p>
                          </motion.div>
                        ))
                    ) : (
                      <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                        <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No comments yet</p>
                        <p className="text-xs">Start a conversation about this asset</p>
                      </div>
                    )}
                  </div>

                  {/* Add Comment Form */}
                  <form onSubmit={handleSubmitComment} className="mt-4 pt-4 border-t border-gray-200">
                    <div className="space-y-3">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a note about this asset..."
                        rows={3}
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 outline-none transition-all text-sm resize-none"
                      />
                      <div className="flex justify-end">
                        <motion.button
                          type="submit"
                          disabled={!commentText.trim()}
                          whileHover={commentText.trim() ? { scale: 1.02 } : {}}
                          whileTap={commentText.trim() ? { scale: 0.98 } : {}}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-md shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          <Send size={16} />
                          Add Comment
                        </motion.button>
                      </div>
                    </div>
                  </form>
              </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 m-auto z-50 w-full max-w-xl h-[90vh] overflow-y-auto pointer-events-none flex items-center justify-center"
            >
               <GlassCard className="pointer-events-auto w-full max-w-xl max-h-[90vh] overflow-y-auto !bg-white/95 shadow-2xl border-white/50 m-4 flex flex-col">
                 <div className="flex justify-between items-center mb-6 shrink-0">
                   <div>
                     <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Edit Asset' : 'New Asset'}</h2>
                     <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${currentStep === 1 ? 'bg-blue-100 text-blue-700' : 'text-gray-400'}`}>Step 1: Details</span>
                        {hasExtraSpecs(formData.type) && (
                          <>
                            <span className="text-gray-300">/</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${currentStep === 2 ? 'bg-blue-100 text-blue-700' : 'text-gray-400'}`}>Step 2: Specs</span>
                          </>
                        )}
                     </div>
                   </div>
                   <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                     <X size={20} className="text-gray-500" />
                   </button>
                 </div>

                 <form onSubmit={handleNext} className="space-y-4 flex-1 overflow-y-auto p-1">
                    {currentStep === 1 ? renderStep1() : renderStep2()}
                 </form>

                 <div className="pt-6 flex justify-between items-center shrink-0 border-t border-gray-100 mt-4">
                    {currentStep === 2 ? (
                      <button 
                        type="button" 
                        onClick={() => setCurrentStep(1)} 
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                      >
                        <ArrowLeft size={16} /> Back
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        onClick={closeModal} 
                        className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    )}

                    {currentStep === 1 && hasExtraSpecs(formData.type) ? (
                      <button 
                        type="button" 
                        onClick={handleNext} 
                        className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-500/30 flex items-center gap-2 text-sm font-medium"
                      >
                        Next <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => handleSubmit()} 
                        className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-indigo-500/30 flex items-center gap-2 text-sm font-medium"
                      >
                        <Check size={16} /> {editingId ? 'Update Asset' : 'Create Asset'}
                      </button>
                    )}
                  </div>
               </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssetManager;
