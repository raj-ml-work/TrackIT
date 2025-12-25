import React, { useEffect, useState } from 'react';
import { Asset, AssetStatus, AssetType, Location } from '../types';
import GlassCard from './GlassCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { Sparkles, TrendingUp, AlertCircle, Package, IndianRupee, MapPin } from 'lucide-react';
import { generateInventoryInsight } from '../services/geminiService';
import { motion } from 'framer-motion';

interface DashboardProps {
  assets: Asset[];
  locations: Location[];
}

const COLORS = ['#0ea5e9', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f59e0b'];

const Dashboard: React.FC<DashboardProps> = ({ assets, locations }) => {
  const [insight, setInsight] = useState<string>("");
  const [loadingInsight, setLoadingInsight] = useState(false);

  const totalValue = assets.reduce((acc, curr) => acc + curr.cost, 0);
  const inUseCount = assets.filter(a => a.status === AssetStatus.IN_USE).length;
  const utilizationRate = assets.length > 0 ? Math.round((inUseCount / assets.length) * 100) : 0;
  
  // Calculate expiring warranties (next 90 days)
  const expiringCount = assets.filter(a => {
    const today = new Date();
    const expiry = new Date(a.warrantyExpiry);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 90;
  }).length;

  const typeData = Object.values(AssetType).map(type => ({
    name: type,
    value: assets.filter(a => a.type === type).length
  })).filter(d => d.value > 0);

  const statusData = Object.values(AssetStatus).map(status => ({
    name: status,
    count: assets.filter(a => a.status === status).length
  }));

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
           <div className="flex justify-between items-center mb-6">
             <h3 className="text-lg font-bold text-gray-800">Asset Distribution</h3>
           </div>
           <div className="h-64 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={typeData}>
                 <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                 <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                 <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                 />
                 <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} barSize={40} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-lg font-bold text-gray-800 mb-6">Status Breakdown</h3>
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: '12px', border: 'none' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <div className="text-center">
                 <span className="block text-2xl font-bold text-gray-800">{assets.length}</span>
                 <span className="text-xs text-gray-500 uppercase tracking-wider">Total</span>
               </div>
            </div>
          </div>
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
             <h3 className="text-lg font-bold text-gray-800">Auralis Insights</h3>
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
