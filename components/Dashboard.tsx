import React, { useEffect, useMemo, useState } from 'react';
import { Asset, AssetStatus, AssetType, Employee, Location } from '../types';
import GlassCard from './GlassCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Sparkles, TrendingUp, AlertCircle, Package, IndianRupee, MapPin } from 'lucide-react';
import { generateInventoryInsight } from '../services/geminiService';
import { motion } from 'framer-motion';

interface DashboardProps {
  assets: Asset[];
  locations: Location[];
  employees: Employee[];
}

const COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f59e0b'];
const STATUS_COLORS: Record<AssetStatus, string> = {
  [AssetStatus.IN_USE]: '#22c55e',
  [AssetStatus.ASSIGNED]: '#16a34a',
  [AssetStatus.AVAILABLE]: '#38bdf8',
  [AssetStatus.MAINTENANCE]: '#f59e0b',
  [AssetStatus.RETIRED]: '#94a3b8'
};

const Dashboard: React.FC<DashboardProps> = ({ assets, locations, employees }) => {
  const [insight, setInsight] = useState<string>("");
  const [loadingInsight, setLoadingInsight] = useState(false);

  const totalValue = assets.reduce((acc, curr) => acc + curr.cost, 0);
  const isUtilized = (asset: Asset) =>
    asset.status === AssetStatus.IN_USE || asset.status === AssetStatus.ASSIGNED;
  const inUseCount = assets.filter(isUtilized).length;
  const utilizationRate = assets.length > 0 ? Math.round((inUseCount / assets.length) * 100) : 0;
  
  // Calculate expiring warranties (next 90 days)
  const expiringCount = assets.filter(a => {
    const today = new Date();
    const expiry = new Date(a.warrantyExpiry);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 90;
  }).length;

  const typeData = Object.values(AssetType).map(type => {
    const typeAssets = assets.filter(a => a.type === type);
    const inUse = typeAssets.filter(isUtilized).length;
    const available = typeAssets.filter(a => a.status === AssetStatus.AVAILABLE).length;
    return {
      name: type,
      inUse,
      available,
      total: typeAssets.length
    };
  }).filter(d => d.total > 0);

  const statusData = Object.values(AssetStatus).map(status => ({
    name: status,
    count: assets.filter(a => a.status === status).length,
    color: STATUS_COLORS[status] || '#94a3b8'
  }));

  const usedStatusSet = useMemo(() => new Set([AssetStatus.IN_USE, AssetStatus.ASSIGNED]), []);

  const laptopLocationStats = useMemo(() => {
    const stats = new Map<string, { used: number; available: number; total: number }>();

    assets
      .filter(asset => asset.type === AssetType.LAPTOP)
      .forEach(asset => {
        const location = asset.location?.trim() || 'Unassigned';
        const current = stats.get(location) || { used: 0, available: 0, total: 0 };

        if (usedStatusSet.has(asset.status)) {
          current.used += 1;
        }
        if (asset.status === AssetStatus.AVAILABLE) {
          current.available += 1;
        }

        current.total += 1;
        stats.set(location, current);
      });

    return Array.from(stats.entries())
      .map(([location, counts]) => ({ location, ...counts }))
      .sort((a, b) => b.total - a.total);
  }, [assets, usedStatusSet]);

  const laptopDepartmentStats = useMemo(() => {
    const employeeLookup = new Map<string, Employee>();
    employees.forEach(employee => {
      if (employee.id) employeeLookup.set(employee.id, employee);
      if (employee.employeeId) employeeLookup.set(employee.employeeId, employee);
      if (employee.name) employeeLookup.set(employee.name, employee);
    });

    const counts = new Map<string, number>();

    assets
      .filter(asset => asset.type === AssetType.LAPTOP)
      .forEach(asset => {
        if (!usedStatusSet.has(asset.status)) {
          return;
        }

        const assigneeKey = asset.employeeId || asset.assignedToId || asset.assignedTo || '';
        const employee = employeeLookup.get(assigneeKey);
        const department = employee?.department?.trim() || 'Unassigned';

        counts.set(department, (counts.get(department) || 0) + 1);
      });

    return Array.from(counts.entries())
      .map(([department, used]) => ({ department, used }))
      .sort((a, b) => b.used - a.used);
  }, [assets, employees, usedStatusSet]);

  // Location distribution by name
  const locationData = locations.map(loc => ({
    name: loc.name,
    assets: assets.filter(a => a.location === loc.name).length
  })).filter(d => d.assets > 0).sort((a, b) => b.assets - a.assets);

  // City distribution
  const cityData = locations.reduce((acc, loc) => {
    const city = loc.city;
    if (!acc[city]) {
      acc[city] = 0;
    }
    acc[city] += assets.filter(a => a.location === loc.name).length;
    return acc;
  }, {} as Record<string, number>);

  const cityDistribution = Object.entries(cityData)
    .map(([city, count]: [string, number]) => ({ name: city, assets: count }))
    .filter(d => d.assets > 0)
    .sort((a, b) => b.assets - a.assets);

  useEffect(() => {
    // Initial insight generation if API key is present
    if (process.env.API_KEY && assets.length > 0 && !insight) {
      handleGenerateInsight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]); // Only re-run if assets change drastically or on mount

  const handleGenerateInsight = async () => {
    setLoadingInsight(true);
    const result = await generateInventoryInsight(assets);
    setInsight(result);
    setLoadingInsight(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard hoverEffect>
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <Package size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Assets</p>
              <h3 className="text-2xl font-bold text-gray-800">{assets.length}</h3>
            </div>
          </div>
        </GlassCard>

        <GlassCard hoverEffect>
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-emerald-100 text-emerald-600">
              <IndianRupee size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Value</p>
              <h3 className="text-2xl font-bold text-gray-800">₹{totalValue.toLocaleString()}</h3>
            </div>
          </div>
        </GlassCard>

        <GlassCard hoverEffect>
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-violet-100 text-violet-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Utilization</p>
              <h3 className="text-2xl font-bold text-gray-800">{utilizationRate}%</h3>
            </div>
          </div>
        </GlassCard>

        <GlassCard hoverEffect>
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-rose-100 text-rose-600">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Warranty Alerts</p>
              <h3 className="text-2xl font-bold text-gray-800">{expiringCount}</h3>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2">
           <div className="flex justify-between items-center mb-4">
             <div>
               <h3 className="text-lg font-bold text-gray-800">Asset Utilization</h3>
               <p className="text-xs text-gray-500 mt-1">In use vs available by type</p>
             </div>
             <div className="flex items-center gap-3 text-xs text-gray-600">
               <span className="flex items-center gap-1.5">
                 <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                 In Use
               </span>
               <span className="flex items-center gap-1.5">
                 <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                 Available
               </span>
             </div>
           </div>
           <div className="h-64 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={typeData} barCategoryGap={18}>
                 <defs>
                 <linearGradient id="inUseGradient" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="0%" stopColor="#1f4f8a" stopOpacity={0.9} />
                   <stop offset="100%" stopColor="#093266" stopOpacity={0.9} />
                 </linearGradient>
                 <linearGradient id="availableGradient" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="0%" stopColor="#6ad06f" stopOpacity={0.9} />
                   <stop offset="100%" stopColor="#3faf43" stopOpacity={0.9} />
                 </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 8" stroke="#e5e7eb" vertical={false} />
                 <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                 <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                 <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderRadius: '12px', border: 'none', boxShadow: '0 6px 18px rgba(15,23,42,0.12)' }} 
                 />
                 <Bar dataKey="inUse" fill="url(#inUseGradient)" radius={[10, 10, 0, 0]} barSize={26} />
                 <Bar dataKey="available" fill="url(#availableGradient)" radius={[10, 10, 0, 0]} barSize={26} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Status Breakdown</h3>
              <p className="text-xs text-gray-500 mt-1">Current asset lifecycle state</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total Assets</p>
              <p className="text-lg font-semibold text-gray-800">{assets.length}</p>
            </div>
          </div>
          <div className="h-60 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {statusData.map((entry) => (
                    <linearGradient
                      key={`grad-${entry.name}`}
                      id={`statusGrad-${entry.name.replace(/\s+/g, '')}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={entry.color} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={entry.color} stopOpacity={0.55} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={[{ name: 'track', count: assets.length || 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={86}
                  dataKey="count"
                  fill="#eef2f7"
                  stroke="none"
                />
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={86}
                  paddingAngle={3}
                  dataKey="count"
                  stroke="#f8fafc"
                  strokeWidth={2}
                >
                  {statusData.map((entry) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={`url(#statusGrad-${entry.name.replace(/\s+/g, '')})`}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 6px 18px rgba(15,23,42,0.12)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <span className="block text-2xl font-bold text-gray-800">{assets.length}</span>
                <span className="text-xs text-gray-500 uppercase tracking-wider">Total</span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {statusData.map((status) => (
              <div
                key={status.name}
                className="flex items-center gap-2 rounded-full border border-gray-100 bg-white px-3 py-1.5 text-xs shadow-sm"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                <span className="font-medium text-gray-600">{status.name}</span>
                <span className="font-semibold text-gray-800">{status.count}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Laptop Status Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard>
          <div className="flex items-center gap-3 mb-6">
            <Package className="text-emerald-500" size={20} />
            <div>
              <h3 className="text-lg font-bold text-gray-800">Laptops by Location</h3>
              <p className="text-xs text-gray-500">Used vs available</p>
            </div>
          </div>
          {laptopLocationStats.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={laptopLocationStats}
                  layout="vertical"
                  margin={{ left: 16, right: 16 }}
                >
                  <defs>
                    <linearGradient id="laptopUsedGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#1f4f8a" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#093266" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="laptopAvailableGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6ad06f" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#3faf43" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 8" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="location"
                    width={120}
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 6px 18px rgba(15,23,42,0.12)' }}
                  />
                  <Bar dataKey="used" name="Used" stackId="a" fill="url(#laptopUsedGradient)" radius={[8, 8, 8, 8]} />
                  <Bar dataKey="available" name="Available" stackId="a" fill="url(#laptopAvailableGradient)" radius={[8, 8, 8, 8]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Package size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No laptop data available</p>
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="text-indigo-500" size={20} />
            <div>
              <h3 className="text-lg font-bold text-gray-800">Laptops by Department</h3>
              <p className="text-xs text-gray-500">Assigned laptop usage</p>
            </div>
          </div>
          {laptopDepartmentStats.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={laptopDepartmentStats} margin={{ left: 8, right: 16, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 8" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="department"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 6px 18px rgba(15,23,42,0.12)' }}
                  />
                  <Bar dataKey="used" name="Used" fill="#818cf8" radius={[10, 10, 0, 0]} barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <TrendingUp size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No assigned laptops yet</p>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Location Distribution Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Location Name Distribution */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="text-green-500" size={20} />
            <h3 className="text-lg font-bold text-gray-800">Distribution by Location</h3>
          </div>
          {locationData.length > 0 ? (
            <div className="space-y-3">
              {locationData.map((loc, index) => {
                const percentage = assets.length > 0 ? Math.round((loc.assets / assets.length) * 100) : 0;
                return (
                  <motion.div
                    key={loc.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-gray-800">{loc.name}</span>
                        <span className="text-sm text-gray-600">{loc.assets} assets ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, delay: index * 0.1 }}
                          className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <MapPin size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No location data available</p>
            </div>
          )}
        </GlassCard>

        {/* City Distribution */}
        <GlassCard>
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="text-blue-500" size={20} />
            <h3 className="text-lg font-bold text-gray-800">Distribution by City</h3>
          </div>
          {cityDistribution.length > 0 ? (
            <div className="space-y-3">
              {cityDistribution.map((city, index) => {
                const percentage = assets.length > 0 ? Math.round((city.assets / assets.length) * 100) : 0;
                return (
                  <motion.div
                    key={city.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-gray-800">{city.name}</span>
                        <span className="text-sm text-gray-600">{city.assets} assets ({percentage}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, delay: index * 0.1 }}
                          className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full"
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <MapPin size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No city data available</p>
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard className="relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Sparkles size={100} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
             <Sparkles className="text-violet-500" size={20} />
             <h3 className="text-lg font-bold text-gray-800">TrackIT Insights</h3>
          </div>
          
          <div className="min-h-[60px]">
            {loadingInsight ? (
               <div className="flex items-center space-x-2 text-gray-500 animate-pulse">
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                 <span>Analyzing inventory patterns...</span>
               </div>
            ) : (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-600 leading-relaxed max-w-4xl"
              >
                {insight || "Connect your API key and add assets to receive AI-powered optimization summaries."}
              </motion.p>
            )}
          </div>
          
          <div className="mt-4">
             <button 
                onClick={handleGenerateInsight}
                disabled={loadingInsight}
                className="text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors flex items-center gap-1"
             >
               Refresh Analysis
             </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default Dashboard;
