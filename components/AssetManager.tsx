import React, { useState, useEffect } from 'react';
import { Asset, AssetStatus, AssetType, AssetSpecs, AssetCommentType, Location, Employee, EmployeeStatus } from '../types';
import GlassCard from './GlassCard';
import { Search, Filter, Plus, Edit2, Trash2, X, Check, Laptop, Monitor, Smartphone, HardDrive, Printer, Box, Tv, Projector as ProjectorIcon, ArrowRight, ArrowLeft, Calendar, DollarSign, MapPin, Hash, User, FileText, Cpu, Layers, MessageSquare, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AssetManagerProps {
  assets: Asset[];
  employees?: Employee[];
  locations: Location[];
  onAdd: (asset: Omit<Asset, 'id'>) => Promise<void>;
  onUpdate: (asset: Asset) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddComment: (assetId: string, message: string) => Promise<void>;
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

const AssetManager: React.FC<AssetManagerProps> = ({ assets, employees = [], locations, onAdd, onUpdate, onDelete, onAddComment, canDelete = true }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<AssetType | 'All'>('All');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Asset, 'id'>>(initialAsset);

  // Details Drawer State
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  
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
    try {
      if (editingId) {
        await onUpdate({ ...formData, id: editingId });
        // If we are editing the currently viewed asset, update the view as well
        if (selectedAsset && selectedAsset.id === editingId) {
          setSelectedAsset({ ...formData, id: editingId } as Asset);
        }
      } else {
        await onAdd(formData);
      }
      closeModal();
    } catch (error) {
      // Error is already handled in the handler
      console.error('Error submitting asset:', error);
    }
  };

  const openEdit = (asset: Asset) => {
    setFormData({
        ...asset,
        specs: { ...initialSpecs, ...asset.specs }
    });
    setEditingId(asset.id);
    setCurrentStep(1);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setCurrentStep(1);
    setFormData(initialAsset);
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
          <input required type="text" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" 
            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Designer Workstation 1" />
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
           <select className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"
             value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as AssetStatus})}>
               {Object.values(AssetStatus).map(s => <option key={s} value={s}>{s}</option>)}
           </select>
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
          <input required type="text" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} placeholder="S/N" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Location</label>
          <select 
            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            value={formData.location}
            onChange={e => setFormData({...formData, location: e.target.value})}
          >
            <option value="">Select Location</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.name}>{loc.name} - {loc.city}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Financials */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Cost ($)</label>
          <input type="number" min="0" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            value={formData.cost} onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Purchased</label>
          <input type="date" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Warranty</label>
          <input type="date" className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            value={formData.warrantyExpiry} onChange={e => setFormData({...formData, warrantyExpiry: e.target.value})} />
        </div>
      </div>
      
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Assigned To</label>
        <select 
          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          value={formData.assignedTo || ''}
          onChange={e => setFormData({...formData, assignedTo: e.target.value || undefined})}
        >
          <option value="">Unassigned</option>
          {employees
            .filter(emp => emp.status === EmployeeStatus.ACTIVE)
            .map(emp => (
              <option key={emp.id} value={emp.name}>
                {emp.name} - {emp.employeeId} {emp.department ? `(${emp.department})` : ''}
              </option>
            ))}
        </select>
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
      {/* Header Controls */}
      <GlassCard className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Search assets..." 
            className="w-full pl-10 pr-4 py-2 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all text-gray-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
             <select 
               className="appearance-none pl-10 pr-8 py-2 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 text-gray-700"
               value={filterType}
               onChange={(e) => setFilterType(e.target.value as AssetType | 'All')}
             >
               <option value="All">All Types</option>
               {Object.values(AssetType).map(t => <option key={t} value={t}>{t}</option>)}
             </select>
             <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          </div>

          <button 
            onClick={() => { setCurrentStep(1); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2 rounded-xl hover:bg-gray-800 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus size={18} />
            <span>Add Asset</span>
          </button>
        </div>
      </GlassCard>

      {/* Asset List */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence>
          {filteredAssets.map((asset) => (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
            >
              <GlassCard 
                className="py-4 hover:bg-white/40 group cursor-pointer active:scale-[0.99]" 
                hoverEffect={false}
                onClick={() => setSelectedAsset(asset)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-3 rounded-2xl ${
                      asset.status === AssetStatus.IN_USE ? 'bg-blue-100 text-blue-600' : 
                      asset.status === AssetStatus.AVAILABLE ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {getIcon(asset.type)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">{asset.name}</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-500 font-mono">
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

                  <div className="hidden md:flex flex-col gap-1 w-32">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">Location</span>
                    <span className="text-sm text-gray-700">{asset.location}</span>
                  </div>

                  <div className="hidden md:flex flex-col gap-1 w-32">
                     <span className="text-xs text-gray-400 uppercase tracking-wide">Status</span>
                     <span className={`inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                       asset.status === AssetStatus.IN_USE ? 'bg-blue-100 text-blue-800' :
                       asset.status === AssetStatus.AVAILABLE ? 'bg-green-100 text-green-800' :
                       asset.status === AssetStatus.RETIRED ? 'bg-red-100 text-red-800' :
                       'bg-yellow-100 text-yellow-800'
                     }`}>
                       {asset.status}
                     </span>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); openEdit(asset); }} 
                      className="p-2 hover:bg-white/50 rounded-lg text-gray-600 hover:text-blue-600"
                    >
                      <Edit2 size={18} />
                    </button>
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
                        className="p-2 hover:bg-white/50 rounded-lg text-gray-600 hover:text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {filteredAssets.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No assets found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedAsset && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAsset(null)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-white/95 backdrop-blur-xl shadow-2xl z-50 overflow-y-auto border-l border-white/50"
            >
              <div className="p-8 space-y-8">
                {/* Header */}
                <div className="flex justify-between items-start">
                   <button onClick={() => setSelectedAsset(null)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                     <X size={24} />
                   </button>
                   <div className="flex gap-2">
                      <button onClick={() => openEdit(selectedAsset)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">
                        <Edit2 size={20} />
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
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                   </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                     <div className="p-4 bg-gray-100 rounded-2xl text-gray-700">
                       {getIcon(selectedAsset.type)}
                     </div>
                     <div>
                       <span className="text-sm text-gray-500 font-medium">{selectedAsset.type}</span>
                       <h2 className="text-2xl font-bold text-gray-900">{selectedAsset.name}</h2>
                     </div>
                  </div>
                  
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                     selectedAsset.status === AssetStatus.IN_USE ? 'bg-blue-100 text-blue-800' :
                     selectedAsset.status === AssetStatus.AVAILABLE ? 'bg-green-100 text-green-800' :
                     selectedAsset.status === AssetStatus.RETIRED ? 'bg-red-100 text-red-800' :
                     'bg-yellow-100 text-yellow-800'
                   }`}>
                     {selectedAsset.status}
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
                        <DollarSign className="text-gray-400 mt-0.5" size={18} />
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Cost</p>
                          <p className="text-gray-800 font-mono">${selectedAsset.cost.toLocaleString()}</p>
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
                    <MessageSquare className="text-gray-500" size={18} />
                    <h3 className="text-sm font-bold text-gray-700">Comments & Activity</h3>
                    <span className="text-xs text-gray-400 ml-auto">
                      {selectedAsset.comments?.length || 0} {selectedAsset.comments?.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
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
                          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          <Send size={16} />
                          Add Comment
                        </motion.button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
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
                        className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-lg flex items-center gap-2 text-sm font-medium"
                      >
                        Next <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => handleSubmit()} 
                        className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-lg flex items-center gap-2 text-sm font-medium"
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
