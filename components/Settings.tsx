import React from 'react';
import GlassCard from './GlassCard';
import { Settings as SettingsIcon, User, Shield, Bell, Cloud } from 'lucide-react';

const Settings: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <GlassCard>
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-gray-100 rounded-full text-gray-700">
            <User size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Profile Settings</h3>
          </div>
        </div>
        <div className="space-y-4">
           <div className="flex justify-between items-center py-3 border-b border-gray-100">
             <span className="text-gray-700">Display Name</span>
             <span className="text-gray-500">Admin User</span>
           </div>
           <div className="flex justify-between items-center py-3 border-b border-gray-100">
             <span className="text-gray-700">Email Address</span>
             <span className="text-gray-500">admin@trackit.com</span>
           </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-gray-100 rounded-full text-gray-700">
            <SettingsIcon size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Application Preferences</h3>
          </div>
        </div>
        
        <div className="grid gap-4">
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/40 transition-colors cursor-pointer">
             <div className="flex items-center gap-3">
               <Bell className="text-gray-400" size={20} />
               <span className="text-gray-700">Notifications</span>
             </div>
             <div className="w-10 h-6 bg-green-500 rounded-full relative">
               <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
             </div>
          </div>

           <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/40 transition-colors cursor-pointer">
             <div className="flex items-center gap-3">
               <Cloud className="text-gray-400" size={20} />
               <span className="text-gray-700">Cloud Sync (Supabase)</span>
             </div>
             <span className="text-xs text-amber-500 font-medium bg-amber-50 px-2 py-1 rounded-md">Coming Soon</span>
          </div>
        </div>
      </GlassCard>

      <div className="text-center pt-8">
        <p className="text-xs text-gray-400">TrackIT Inventory v1.0.0</p>
      </div>
    </div>
  );
};

export default Settings;
