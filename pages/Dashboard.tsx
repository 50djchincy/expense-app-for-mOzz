
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../AccountsContext';
import { useAuth } from '../AuthContext';
import { 
  Wallet, 
  Plus,
  Handshake,
  FileText,
  Activity,
  Zap,
  ChevronRight,
  Clock,
  Loader2,
  CheckCircle2,
  TrendingDown,
  ArrowRight
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { accounts, transactions, loading } = useAccounts();

  // Core Financials
  const tillFloat = accounts.find(a => a.id === 'till_float')?.balance || 0;
  const hikingBarDebt = accounts.find(a => a.id === 'hiking_bar_rec')?.balance || 0;
  const pendingBillsTotal = accounts.find(a => a.id === 'pending_bills')?.balance || 0;
  
  const totalAssets = accounts
    .filter(a => a.type === 'ASSET' || a.type === 'RECEIVABLE')
    .reduce((sum, a) => sum + a.balance, 0);
  
  const totalLiabilities = accounts
    .filter(a => a.type === 'LIABILITY')
    .reduce((sum, a) => sum + a.balance, 0);

  const netLiquidity = totalAssets - totalLiabilities;

  // Master Ledger Slice for Dashboard
  const recentTransactions = transactions.slice(0, 8);

  // Simplified Chart Data - In a real app we would aggregate by date
  const dummyChartData = [
    { name: 'Mon', revenue: 4200, expense: 3100 },
    { name: 'Tue', revenue: 3800, expense: 3400 },
    { name: 'Wed', revenue: 5100, expense: 2800 },
    { name: 'Thu', revenue: 4900, expense: 3900 },
    { name: 'Fri', revenue: 6200, expense: 4200 },
    { name: 'Sat', revenue: 7500, expense: 4100 },
    { name: 'Sun', revenue: 6800, expense: 5800 },
  ];

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || id;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="animate-spin text-purple-500" size={48} />
        <p className="text-slate-400 font-medium animate-pulse uppercase tracking-widest text-[10px]">Synchronizing Master Ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Premium Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-outfit font-black text-white tracking-tight">
            Terminal
          </h1>
          <p className="text-slate-400 mt-1 flex items-center gap-2">
            <Activity size={14} className="text-purple-400" />
            Operational pulse for <span className="text-white font-semibold">Mozzarella</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/daily-ops')}
            className="flex items-center gap-2 px-6 py-4 gradient-purple rounded-2xl text-white font-bold shadow-xl shadow-purple-500/30 active:scale-95 transition-all text-sm"
          >
            <Plus size={18} />
            Start New Shift
          </button>
        </div>
      </div>

      {/* Key Financial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardStatCard 
          title="Physical Cash" 
          value={`$${tillFloat.toLocaleString()}`} 
          subtitle="In Register Drawers"
          icon={Wallet}
          color="blue"
          onClick={() => navigate('/daily-ops')}
        />
        <DashboardStatCard 
          title="Partner Debt" 
          value={`$${hikingBarDebt.toLocaleString()}`} 
          subtitle="Hiking Bar Receivable"
          icon={Handshake}
          color="emerald"
          onClick={() => navigate('/hiking-bar')}
        />
        <DashboardStatCard 
          title="Pending Payables" 
          value={`$${pendingBillsTotal.toLocaleString()}`} 
          subtitle="Awaiting Liquidity"
          icon={FileText}
          color="rose"
          onClick={() => navigate('/expenses')}
        />
        <DashboardStatCard 
          title="Net Liquidity" 
          value={`$${netLiquidity.toLocaleString()}`} 
          subtitle="Master Vault Capacity"
          icon={Zap}
          color="purple"
          onClick={() => navigate('/money-lab')}
        />
      </div>

      {/* Main Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Performance Chart */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <h2 className="text-xl font-outfit font-bold text-white">Financial Trends</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Cash Flow Projections</p>
              </div>
              <div className="flex items-center gap-2">
                 <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-[10px] font-bold text-purple-400 uppercase">Revenue</span>
                 </div>
              </div>
            </div>
            
            <div className="h-[320px] w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dummyChartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} 
                    dy={10} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e1e2f', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '16px', 
                      fontSize: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#a855f7" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-7 bg-blue-500/5 border border-blue-500/10 rounded-[2rem] flex items-center justify-between group cursor-pointer" onClick={() => navigate('/history')}>
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Activity size={24} />
                </div>
                <div>
                   <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Master Ledger Active</p>
                   <p className="text-[10px] text-slate-500">Atomic tracking of all system movements verified.</p>
                </div>
             </div>
             <ChevronRight className="text-slate-600 group-hover:text-blue-400 transition-colors" />
          </div>
        </div>

        {/* Master Ledger Sidebar Feed */}
        <div className="space-y-6">
          <div className="glass rounded-[2rem] p-7 border border-white/10 shadow-xl flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-lg font-outfit font-bold text-white flex items-center gap-3">
                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 Master Ledger
               </h2>
               <button 
                 onClick={() => navigate('/history')}
                 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest hover:text-purple-300"
               >
                 View All
               </button>
            </div>
            
            <div className="flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-hide">
              {recentTransactions.map((tx) => {
                const isOutflow = tx.toAccountId === 'operational_expenses' || tx.toAccountId === 'payroll_expenses';
                const isInflow = tx.fromAccountId === 'service_fee_income';
                
                return (
                  <div key={tx.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          isInflow ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10' :
                          isOutflow ? 'bg-rose-500/10 text-rose-400 border-rose-500/10' :
                          'bg-purple-500/10 text-purple-400 border-purple-500/10'
                        }`}>
                          {isInflow ? <Zap size={16} /> : isOutflow ? <TrendingDown size={16} /> : <ArrowRight size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{tx.description}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                             <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">{getAccountName(tx.fromAccountId)}</span>
                             <ChevronRight size={8} className="text-slate-700" />
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{getAccountName(tx.toAccountId)}</span>
                          </div>
                        </div>
                      </div>
                      <p className={`text-sm font-black ${
                        isInflow ? 'text-emerald-400' : isOutflow ? 'text-rose-400' : 'text-purple-400'
                      }`}>
                        {isInflow ? '+' : isOutflow ? '-' : ''}${tx.amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              
              {recentTransactions.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-20">
                   <CheckCircle2 size={48} className="text-slate-500 mb-3" />
                   <p className="text-[10px] font-black uppercase tracking-[0.2em]">Ledger Empty</p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
               <div className="flex justify-between items-center px-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Live Pulse</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{new Date().toLocaleDateString()}</p>
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

const DashboardStatCard = ({ title, value, subtitle, icon: Icon, color, onClick }: any) => {
  const colorGradients: any = {
    purple: 'gradient-purple shadow-purple-500/20',
    emerald: 'gradient-emerald shadow-emerald-500/20',
    rose: 'gradient-rose shadow-rose-500/20',
    blue: 'gradient-blue shadow-blue-500/20',
  };

  const iconColors: any = {
    purple: 'text-purple-400 bg-purple-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
  };

  return (
    <div 
      onClick={onClick}
      className="glass rounded-[2rem] p-6 border border-white/10 hover:border-white/20 transition-all group cursor-pointer hover:-translate-y-1 shadow-xl relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-5 relative z-10">
        <div className={`p-3 rounded-2xl ${iconColors[color]}`}>
          <Icon size={24} strokeWidth={2.5} />
        </div>
        <div className="w-2 h-2 rounded-full bg-slate-800 border border-white/20" />
      </div>
      <div className="relative z-10">
        <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.1em]">{title}</h3>
        <p className="text-2xl font-outfit font-black text-white mt-1 group-hover:scale-105 origin-left transition-transform tracking-tight">{value}</p>
        <p className="text-[9px] text-slate-500 mt-1 font-medium">{subtitle}</p>
      </div>
      <div className={`absolute -bottom-6 -right-6 w-16 h-16 rounded-full opacity-5 blur-2xl ${colorGradients[color]}`} />
    </div>
  );
};
