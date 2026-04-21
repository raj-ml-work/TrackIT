import React, { useEffect, useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  UserPlus, 
  DollarSign, 
  Briefcase, 
  AlertCircle,
  Loader,
  ChevronRight,
  Target,
  PieChart as PieIcon,
  BarChart as BarIcon,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';
import { Employee, EmployeeSalaryInfo } from '../types';
import { getEmployees, getLatestSalaries } from '../services/dataService';
import GlassCard from './GlassCard';

const ManagementDashboard: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaries, setSalaries] = useState<EmployeeSalaryInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empData, salData] = await Promise.all([
          getEmployees(),
          getLatestSalaries()
        ]);
        setEmployees(empData);
        setSalaries(salData);
      } catch (err: any) {
        setError(err.message || 'Failed to load management data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    if (employees.length === 0) return null;

    const totalEmployees = employees.length;
    const benchEmployees = employees.filter(e => e.officialInfo?.assignmentType === 'Bench');
    const billableEmployees = employees.filter(e => e.officialInfo?.assignmentType === 'Client Billable');

    // Link salary to employee for accurate calculation
    const salMap = new Map(salaries.map(s => [s.employeeId, s]));
    
    let totalPayroll = 0;
    let totalBilling = 0;
    let benchCost = 0;
    let billableCost = 0;

    employees.forEach(e => {
      const sal = salMap.get(e.id);
      if (sal) {
        totalPayroll += sal.ctc;
        if (sal.clientBillingRate) {
          totalBilling += sal.clientBillingRate;
        }
        
        if (e.officialInfo?.assignmentType === 'Bench') {
          benchCost += sal.ctc;
        } else if (e.officialInfo?.assignmentType === 'Client Billable') {
          billableCost += sal.ctc;
        }
      }
    });

    const margin = totalBilling - totalPayroll;
    const marginPercent = totalBilling > 0 ? (margin / totalBilling) * 100 : 0;
    const benchRate = (benchEmployees.length / totalEmployees) * 100;

    return {
      totalEmployees,
      benchCount: benchEmployees.length,
      billableCount: billableEmployees.length,
      benchRate,
      totalPayroll,
      totalBilling,
      margin,
      marginPercent,
      benchCost,
      billableCost
    };
  }, [employees, salaries]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader size={40} className="text-emerald-500 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Preparing management insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-3xl text-center">
        <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Access Error</h3>
        <p className="text-red-600 max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const distributionData = [
    { name: 'Billable', value: stats.billableCount, color: '#10b981' },
    { name: 'Bench', value: stats.benchCount, color: '#f59e0b' },
    { name: 'Other', value: stats.totalEmployees - stats.billableCount - stats.benchCount, color: '#94a3b8' }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-gray-500 mt-1">Financial health and resource utilization summary.</p>
        </div>
        <div className="flex gap-2">
          <div className="px-4 py-2 bg-white border border-gray-100 rounded-xl shadow-sm text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Target size={14} className="text-emerald-500" />
            Goal: 85% Utilization
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard hoverEffect className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-none shadow-emerald-200/50">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">Annual</span>
          </div>
          <p className="text-emerald-50 text-xs font-bold uppercase tracking-wider">Gross Billing</p>
          <h3 className="text-2xl font-black mt-1">{formatCurrency(stats.totalBilling)}</h3>
          <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-emerald-100">
            <ArrowUpRight size={12} />
            Targeting 15% YoY Growth
          </div>
        </GlassCard>

        <GlassCard hoverEffect className="bg-white border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-rose-50 text-rose-500 rounded-lg">
              <DollarSign size={20} />
            </div>
          </div>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Payroll (CTC)</p>
          <h3 className="text-2xl font-black text-gray-900 mt-1">{formatCurrency(stats.totalPayroll)}</h3>
          <p className="text-[10px] text-gray-500 font-medium mt-4">Total Cost to Company</p>
        </GlassCard>

        <GlassCard hoverEffect className="bg-white border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-2 rounded-lg ${stats.marginPercent > 20 ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
              <PieIcon size={20} />
            </div>
          </div>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Net Margin</p>
          <h3 className="text-2xl font-black text-gray-900 mt-1">{formatCurrency(stats.margin)}</h3>
          <div className={`mt-4 flex items-center gap-1 text-[10px] font-bold ${stats.marginPercent > 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {stats.marginPercent.toFixed(1)}% Operating Margin
          </div>
        </GlassCard>

        <GlassCard hoverEffect className="bg-white border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-2 rounded-lg ${stats.benchRate < 15 ? 'bg-blue-50 text-blue-500' : 'bg-rose-50 text-rose-500'}`}>
              <Users size={20} />
            </div>
          </div>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Bench Leakage</p>
          <h3 className="text-2xl font-black text-gray-900 mt-1">{formatCurrency(stats.benchCost)}</h3>
          <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-gray-500">
            {stats.benchCount} Resources currently unassigned
          </div>
        </GlassCard>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Utilization Chart */}
        <GlassCard className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Resource Utilization</h3>
              <p className="text-xs text-gray-500">Current allocation across departments.</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-emerald-600">{(100 - stats.benchRate).toFixed(0)}%</span>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Utilized</p>
            </div>
          </div>
          
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' 
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-4">
            {distributionData.map(d => (
              <div key={d.name} className="text-center">
                <div className="w-2 h-2 rounded-full mx-auto mb-2" style={{ backgroundColor: d.color }} />
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d.name}</p>
                <p className="text-sm font-black text-gray-900">{d.value}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Cost vs Billing by Department */}
        <GlassCard className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Department Performance</h3>
              <p className="text-xs text-gray-500">Cost vs Billing comparisons (Annual).</p>
            </div>
            <BarIcon size={20} className="text-gray-300" />
          </div>

          <div className="h-[320px] w-full">
            {(() => {
              const deptStats = new Map<string, { cost: number; billing: number }>();
              const salMap = new Map(salaries.map(s => [s.employeeId, s]));
              
              employees.forEach(e => {
                const dept = e.department || 'Other';
                const sal = salMap.get(e.id);
                const current = deptStats.get(dept) || { cost: 0, billing: 0 };
                
                if (sal) {
                  current.cost += sal.ctc;
                  current.billing += (sal.clientBillingRate || 0);
                }
                deptStats.set(dept, current);
              });

              const chartData = Array.from(deptStats.entries())
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.billing - a.billing)
                .slice(0, 5);

              return (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      fontSize={10} 
                      fontWeight="bold" 
                      tick={{ fill: '#9ca3af' }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      fontSize={10} 
                      fontWeight="bold" 
                      tick={{ fill: '#9ca3af' }}
                      tickFormatter={(value) => `₹${(value / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f9fafb' }}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        borderRadius: '16px', 
                        border: 'none', 
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' 
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="cost" name="Cost (CTC)" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={12} />
                    <Bar dataKey="billing" name="Billing" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </GlassCard>
      </div>

      {/* Bench Details Section */}
      <GlassCard className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Briefcase className="text-amber-500" size={24} />
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight">Bench Leakage Report</h3>
            <p className="text-sm text-gray-500">Inventory of resources currently on bench and their monthly cost impact.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Resource</th>
                <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Department</th>
                <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Monthly Cost</th>
                <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Bench Duration</th>
                <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employees
                .filter(e => e.officialInfo?.assignmentType === 'Bench')
                .map(e => {
                  const sal = salaries.find(s => s.employeeId === e.id);
                  const monthlyCost = sal ? sal.ctc / 12 : 0;
                  return (
                    <tr key={e.id} className="group hover:bg-gray-50/50 transition-colors">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                            {e.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{e.name}</p>
                            <p className="text-[10px] text-gray-400 font-medium">{e.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-md">{e.department}</span>
                      </td>
                      <td className="py-4 text-right">
                        <p className="text-sm font-black text-gray-900">{formatCurrency(monthlyCost)}</p>
                      </td>
                      <td className="py-4 text-right">
                         <span className="text-xs text-gray-500">--</span>
                      </td>
                      <td className="py-4 text-right">
                        <button className="p-2 text-gray-400 hover:text-emerald-600 transition-colors">
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {employees.filter(e => e.officialInfo?.assignmentType === 'Bench').length === 0 && (
            <div className="py-12 text-center">
              <p className="text-gray-400 text-sm font-medium italic">Zero bench leakage. All resources are currently assigned.</p>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
};

export default ManagementDashboard;
