
import React, { useState, useEffect, useMemo } from 'react';
import { useAccounts } from '../AccountsContext';
import { useAuth } from '../AuthContext';
import { db, getFullPath } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { 
  Users, 
  Calendar, 
  Banknote, 
  Plus, 
  X, 
  Loader2, 
  Save, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Heart,
  TrendingUp,
  History,
  Zap,
  CheckCircle2,
  DollarSign,
  Wallet,
  ArrowRight,
  Briefcase,
  ArrowDownCircle,
  Building
} from 'lucide-react';
import { StaffMember, HolidayRecord, Transaction } from '../types';

const COLORS = [
  '#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
  '#ec4899', '#6366f1', '#06b6d4', '#84cc16', '#f97316'
];

interface PayrollConfig {
  staff: StaffMember;
  type: 'SALARY' | 'SERVICE_CHARGE';
  baseAmount: number;
  advancesTotal: number;
  loanRepayment: number;
  sourceId: string;
}

export const Staff: React.FC = () => {
  const { profile } = useAuth();
  const { accounts, transferFunds } = useAccounts();
  const [activeTab, setActiveTab] = useState<'roster' | 'holidays' | 'payroll'>('roster');
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Modal States
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState<StaffMember | null>(null);
  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);

  useEffect(() => {
    const unsubStaff = onSnapshot(collection(db, getFullPath('staff')), (snap) => {
      setStaff(snap.docs.map(d => ({ ...d.data(), id: d.id } as StaffMember)));
      setLoading(false);
    });

    const unsubHolidays = onSnapshot(collection(db, getFullPath('holidays')), (snap) => {
      setHolidays(snap.docs.map(d => ({ ...d.data(), id: d.id } as HolidayRecord)));
    });

    return () => {
      unsubStaff();
      unsubHolidays();
    };
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    setActionLoading(true);
    try {
      const id = `staff_${Date.now()}`;
      await setDoc(doc(db, getFullPath('staff'), id), {
        id,
        name: formData.get('name'),
        role: formData.get('role'),
        salary: Number(formData.get('salary')),
        loanBalance: Number(formData.get('loanBalance')) || 0,
        loanInstallment: Number(formData.get('loanInstallment')) || 0,
        color: COLORS[staff.length % COLORS.length],
        isActive: true,
        joinedAt: Date.now()
      });
      setShowAddStaff(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssueAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdvanceModal) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const amount = Number(formData.get('amount'));
    const source = formData.get('source') as string;

    setActionLoading(true);
    try {
      await transferFunds(
        source,
        'staff_advances_rec',
        amount,
        `Advance issued to ${showAdvanceModal.name}`,
        'Staff Advance',
        { staffId: showAdvanceModal.id }
      );
      setShowAdvanceModal(null);
      alert("Advance issued successfully. This will be deducted in the next payroll cycle.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleHoliday = async (staffId: string, dateStr: string) => {
    const existing = holidays.find(h => h.staffId === staffId && h.date === dateStr);
    try {
      if (existing) {
        await deleteDoc(doc(db, getFullPath('holidays'), existing.id));
      } else {
        await addDoc(collection(db, getFullPath('holidays')), {
          staffId,
          date: dateStr
        });
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    
    const calendar = [];
    for (let i = 0; i < firstDay; i++) calendar.push(null);
    for (let i = 1; i <= days; i++) calendar.push(new Date(year, month, i));
    
    return calendar;
  }, [currentMonth]);

  const initiatePayroll = async (staffId: string, type: 'SALARY' | 'SERVICE_CHARGE') => {
    const s = staff.find(sm => sm.id === staffId);
    if (!s) return;

    setActionLoading(true);
    try {
      // Fetch advances
      const q = query(
        collection(db, getFullPath('transactions')),
        where('staffId', '==', staffId),
        where('category', '==', 'Staff Advance'),
        where('isSettled', '==', true)
      );
      const advSnap = await getDocs(q);
      const advancesTotal = advSnap.docs
        .map(d => d.data() as Transaction)
        .reduce((sum, d) => sum + d.amount, 0);

      setPayrollConfig({
        staff: s,
        type,
        baseAmount: type === 'SALARY' ? s.salary : 0,
        advancesTotal,
        loanRepayment: type === 'SALARY' ? Math.min(s.loanInstallment, s.loanBalance) : 0,
        sourceId: 'business_bank'
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmPayout = async () => {
    if (!payrollConfig) return;
    const { staff: s, type, baseAmount, advancesTotal, loanRepayment, sourceId } = payrollConfig;
    
    const netPay = baseAmount - advancesTotal - loanRepayment;
    if (netPay < 0) {
      alert("Net payout cannot be negative. Adjust loan repayment or base amount.");
      return;
    }

    setActionLoading(true);
    try {
      // 1. Pay Net Amount: Source -> Payroll Expense
      if (netPay > 0) {
        await transferFunds(
          sourceId,
          'payroll_expenses',
          netPay,
          `${type} Payout (Net): ${s.name}`,
          'Staff Payroll',
          { staffId: s.id }
        );
      }

      // 2. Clear Advances: Advances Rec -> Payroll Expense (Internal Reversal)
      if (advancesTotal > 0) {
        await transferFunds(
          'staff_advances_rec',
          'payroll_expenses',
          advancesTotal,
          `Clearing Advances for ${s.name} via Payroll`,
          'Staff Payroll Internal',
          { staffId: s.id }
        );
      }

      // 3. Clear Loan Repayment portion (if any)
      if (loanRepayment > 0) {
        // Logically the repayment is money the staff "gave back" from their salary
        // So we reduce the payout and move that amount to reduce the Staff Advance Receivable (or a loan asset)
        // For simplicity here, we just transfer it from Source to Payroll Expense as if part of salary, 
        // then reduce the loan balance on the staff object.
        await transferFunds(
          sourceId,
          'payroll_expenses',
          loanRepayment,
          `Loan Repayment: ${s.name}`,
          'Staff Loan Repayment',
          { staffId: s.id }
        );
        
        await updateDoc(doc(db, getFullPath('staff'), s.id), {
          loanBalance: Math.max(0, s.loanBalance - loanRepayment)
        });
      }

      alert(`Payroll processed for ${s.name}. Advances cleared and loan updated.`);
      setPayrollConfig(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-purple-400" size={40} /></div>;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="text-purple-400" />
            Staff Hub
          </h1>
          <p className="text-slate-400">Advances, Holidays & Advanced Payroll Engine.</p>
        </div>
        <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-white/5">
          <button onClick={() => setActiveTab('roster')} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'roster' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Roster</button>
          <button onClick={() => setActiveTab('holidays')} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'holidays' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Holidays</button>
          <button onClick={() => setActiveTab('payroll')} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'payroll' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Payroll</button>
        </div>
      </div>

      {activeTab === 'roster' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Employee Management</h2>
            <button onClick={() => setShowAddStaff(true)} className="px-4 py-2 gradient-purple rounded-xl text-white text-xs font-bold flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-purple-500/20"><Plus size={16} /> New Staff</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staff.map(s => (
              <div key={s.id} className="glass rounded-[2rem] p-6 border border-white/10 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl opacity-10 group-hover:opacity-20 transition-opacity" style={{ backgroundImage: `linear-gradient(to bottom left, ${s.color}, transparent)` }} />
                <div className="flex items-center gap-4 mb-6 relative z-10">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg" style={{ backgroundColor: s.color }}>{s.name[0]}</div>
                  <div>
                    <h3 className="font-bold text-white text-lg leading-tight">{s.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Briefcase size={10} /> {s.role || 'Unspecified Role'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 relative z-10">
                   <div className="flex justify-between p-3 bg-slate-900/50 rounded-xl border border-white/5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Base Salary</span>
                      <span className="text-sm font-bold text-white">${s.salary.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between p-3 bg-slate-900/50 rounded-xl border border-white/5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Loan Debt</span>
                      <span className="text-sm font-bold text-rose-400">${s.loanBalance.toLocaleString()}</span>
                   </div>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5 flex gap-2 relative z-10">
                   <button 
                     onClick={() => setShowAdvanceModal(s)}
                     className="flex-1 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded-xl border border-purple-500/10 uppercase tracking-widest transition-all"
                   >
                     Issue Advance
                   </button>
                   <button onClick={() => deleteDoc(doc(db, getFullPath('staff'), s.id))} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                     <Trash2 size={16} />
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'holidays' && (
        <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-white">Holiday Planner</h2>
            <div className="flex items-center gap-4 bg-slate-900/50 p-1 rounded-2xl border border-white/5">
               <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 hover:bg-white/5 rounded-xl text-slate-400"><ChevronLeft size={20} /></button>
               <span className="text-sm font-bold text-white min-w-[120px] text-center">
                 {currentMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}
               </span>
               <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 hover:bg-white/5 rounded-xl text-slate-400"><ChevronRight size={20} /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-4">
             {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
               <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">{d}</div>
             ))}
             {daysInMonth.map((date, idx) => {
               if (!date) return <div key={`pad-${idx}`} />;
               const dateStr = date.toISOString().split('T')[0];
               const dayHolidays = holidays.filter(h => h.date === dateStr);
               
               return (
                 <div key={dateStr} className="aspect-square glass rounded-2xl border border-white/5 p-2 flex flex-col gap-1 relative group hover:border-purple-500/30 transition-all cursor-default">
                   <span className="text-xs font-bold text-slate-400 mb-1">{date.getDate()}</span>
                   <div className="flex flex-wrap gap-1">
                      {dayHolidays.map(h => {
                        const s = staff.find(sm => sm.id === h.staffId);
                        return (
                          <div key={h.id} title={s?.name} className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: s?.color }} />
                        );
                      })}
                   </div>
                   
                   <div className="absolute inset-0 bg-slate-900/90 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-wrap items-center justify-center p-2 gap-1 z-20">
                      {staff.map(s => {
                        const active = dayHolidays.some(h => h.staffId === s.id);
                        return (
                          <button 
                            key={s.id} 
                            onClick={() => toggleHoliday(s.id, dateStr)}
                            title={s.name}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${active ? 'shadow-lg scale-110' : 'bg-white/5 opacity-30 hover:opacity-100'}`}
                            style={{ backgroundColor: active ? s.color : undefined }}
                          >
                            <Heart size={10} className="text-white" />
                          </button>
                        );
                      })}
                   </div>
                 </div>
               );
             })}
          </div>
          <div className="mt-8 flex gap-4 flex-wrap">
             {staff.map(s => (
               <div key={s.id} className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                 {s.name}
               </div>
             ))}
          </div>
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-xl space-y-8">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Banknote className="text-emerald-400" /> Advanced Payroll Engine</h2>
              <div className="space-y-4">
                {staff.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-6 bg-slate-900/50 rounded-[1.5rem] border border-white/5 hover:border-purple-500/20 transition-all group">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: s.color }}>{s.name[0]}</div>
                       <div>
                         <p className="font-bold text-white">{s.name}</p>
                         <p className="text-[10px] text-slate-500 uppercase tracking-widest">{s.role} • Base: ${s.salary}</p>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => initiatePayroll(s.id, 'SALARY')} className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded-xl border border-purple-500/10 uppercase tracking-widest transition-all">Salary</button>
                       <button onClick={() => initiatePayroll(s.id, 'SERVICE_CHARGE')} className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-xl border border-blue-500/10 uppercase tracking-widest transition-all">SC Share</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="glass rounded-[2rem] p-8 border border-white/10 shadow-xl bg-gradient-to-br from-white/5 to-transparent space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Zap size={20} className="text-purple-400" /> Payroll Workflow</h3>
              <ul className="space-y-4">
                <li className="flex gap-3">
                   <div className="p-1.5 bg-white/5 rounded-lg text-slate-400 h-fit"><CheckCircle2 size={14} /></div>
                   <p className="text-[10px] text-slate-400">Advances are automatically calculated and deducted.</p>
                </li>
                <li className="flex gap-3">
                   <div className="p-1.5 bg-white/5 rounded-lg text-slate-400 h-fit"><CheckCircle2 size={14} /></div>
                   <p className="text-[10px] text-slate-400">Manual Loan repayment can be set for each payout.</p>
                </li>
                <li className="flex gap-3">
                   <div className="p-1.5 bg-white/5 rounded-lg text-slate-400 h-fit"><CheckCircle2 size={14} /></div>
                   <p className="text-[10px] text-slate-400">Selection of fund source (Cash vs Bank) is required.</p>
                </li>
              </ul>
              <div className="p-4 bg-slate-900 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Outstanding Advances</p>
                <p className="text-xl font-bold text-white">${accounts.find(a => a.id === 'staff_advances_rec')?.balance.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !actionLoading && setShowAddStaff(false)} />
          <div className="glass w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl font-bold text-white">New Staff Member</h2>
               <button onClick={() => setShowAddStaff(false)} className="text-slate-500 hover:text-white" disabled={actionLoading}><X size={24} /></button>
             </div>
             <form onSubmit={handleAddStaff} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Identity</label>
                   <input name="name" required className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Full Name" />
                   <input name="role" required className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Job Role (e.g. Head Chef)" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Financials</label>
                   <input name="salary" type="number" required className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Basic Monthly Salary" />
                   <div className="grid grid-cols-2 gap-4">
                     <input name="loanBalance" type="number" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Initial Loan" />
                     <input name="loanInstallment" type="number" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Installment" />
                   </div>
                </div>
                <button disabled={actionLoading} type="submit" className="w-full py-5 gradient-purple rounded-3xl text-white font-bold shadow-xl shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                  {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />} Save Member
                </button>
             </form>
          </div>
        </div>
      )}

      {/* Advance Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !actionLoading && setShowAdvanceModal(null)} />
          <div className="glass w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl font-bold text-white">Issue Advance</h2>
               <button onClick={() => setShowAdvanceModal(null)} className="text-slate-500 hover:text-white" disabled={actionLoading}><X size={24} /></button>
             </div>
             <div className="mb-6 p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20 flex items-center gap-4">
               <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: showAdvanceModal.color }}>{showAdvanceModal.name[0]}</div>
               <div>
                  <p className="font-bold text-white">{showAdvanceModal.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase">{showAdvanceModal.role}</p>
               </div>
             </div>
             <form onSubmit={handleIssueAdvance} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Advance Amount</label>
                   <input name="amount" type="number" required className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-4 text-3xl font-black text-white outline-none" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Source of Funds</label>
                   <select name="source" required className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none">
                     <option value="till_float">Till Cash (${accounts.find(a => a.id === 'till_float')?.balance})</option>
                     <option value="business_bank">Business Bank (${accounts.find(a => a.id === 'business_bank')?.balance})</option>
                   </select>
                </div>
                <button disabled={actionLoading} type="submit" className="w-full py-5 gradient-purple rounded-3xl text-white font-bold shadow-xl shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                  {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <ArrowRight size={24} />} Confirm Advance
                </button>
             </form>
          </div>
        </div>
      )}

      {/* Payroll Configuration Modal */}
      {payrollConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !actionLoading && setPayrollConfig(null)} />
          <div className="glass w-full max-w-lg rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
             <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
             <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: payrollConfig.staff.color }}>
                   <Banknote size={28} />
                 </div>
                 <div>
                   <h2 className="text-2xl font-bold text-white">Configure Payout</h2>
                   <p className="text-slate-400 text-sm">{payrollConfig.staff.name} • {payrollConfig.type.replace('_', ' ')}</p>
                 </div>
               </div>
               <button onClick={() => setPayrollConfig(null)} className="text-slate-500 hover:text-white" disabled={actionLoading}><X size={24} /></button>
             </div>

             <div className="space-y-5">
                {/* Dynamic Base Input */}
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                      {payrollConfig.type === 'SALARY' ? 'Basic Salary' : 'Service Charge Share'}
                   </label>
                   <input 
                      type="number"
                      value={payrollConfig.baseAmount || ''}
                      onChange={(e) => setPayrollConfig({...payrollConfig, baseAmount: Number(e.target.value)})}
                      readOnly={payrollConfig.type === 'SALARY'}
                      className={`w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-lg font-bold text-white outline-none ${payrollConfig.type === 'SALARY' ? 'opacity-50' : 'focus:ring-2 focus:ring-emerald-500/50'}`}
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   {/* Automatic Advance Display */}
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-rose-500 uppercase tracking-widest ml-1">Advances to Deduct</label>
                      <div className="w-full bg-rose-500/5 border border-rose-500/10 rounded-2xl px-4 py-3 text-lg font-bold text-rose-400">
                         -${payrollConfig.advancesTotal.toLocaleString()}
                      </div>
                   </div>

                   {/* Manual Loan Repayment */}
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest ml-1">Loan Repayment</label>
                      <input 
                         type="number"
                         value={payrollConfig.loanRepayment || ''}
                         onChange={(e) => setPayrollConfig({...payrollConfig, loanRepayment: Number(e.target.value)})}
                         className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-lg font-bold text-amber-400 focus:ring-2 focus:ring-amber-500/50 outline-none"
                         placeholder="0.00"
                      />
                   </div>
                </div>

                {/* Source Selection */}
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Source of Funds</label>
                   <select 
                      value={payrollConfig.sourceId}
                      onChange={(e) => setPayrollConfig({...payrollConfig, sourceId: e.target.value})}
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50"
                   >
                      <option value="business_bank">Business Bank (${accounts.find(a => a.id === 'business_bank')?.balance})</option>
                      <option value="till_float">Till Cash (${accounts.find(a => a.id === 'till_float')?.balance})</option>
                   </select>
                </div>

                {/* Net Calculation Display */}
                <div className="p-6 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 flex items-center justify-between">
                   <div>
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Final Net Payout</p>
                      <p className="text-4xl font-black text-white tracking-tighter">
                         ${(payrollConfig.baseAmount - payrollConfig.advancesTotal - payrollConfig.loanRepayment).toLocaleString()}
                      </p>
                   </div>
                   <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <ArrowRight className="text-emerald-400" size={24} />
                   </div>
                </div>
             </div>

             <button 
                onClick={confirmPayout} 
                disabled={actionLoading} 
                className="w-full mt-8 py-5 gradient-emerald rounded-[1.5rem] text-white font-black shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
             >
                {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Zap size={24} />} Confirm & Disburse
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
