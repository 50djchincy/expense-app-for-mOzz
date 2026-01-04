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
  getDocs,
  increment // Added increment
} from 'firebase/firestore';
import { 
  Users, 
  Calendar as CalendarIcon, 
  Banknote, 
  Plus, 
  X, 
  Loader2, 
  Save, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Heart,
  Zap,
  CheckCircle2,
  Briefcase,
  ArrowRight,
  UserCheck,
  Wallet,
  AlertCircle,
  CreditCard // Added CreditCard icon
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
  const { profile, isSandbox } = useAuth();
  const { accounts, transferFunds, transactions } = useAccounts();
  const [activeTab, setActiveTab] = useState<'directory' | 'holidays' | 'payroll'>('directory');
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStaffForHoliday, setSelectedStaffForHoliday] = useState<string>('');

  // Modal States
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState<StaffMember | null>(null);
  const [showLoanModal, setShowLoanModal] = useState<StaffMember | null>(null); // Added Loan Modal State
  const [payrollConfig, setPayrollConfig] = useState<PayrollConfig | null>(null);

  const getSandboxData = <T,>(key: string, fallback: T): T => {
    const stored = localStorage.getItem(`mozz_sb_${key}`);
    return stored ? JSON.parse(stored) : fallback;
  };

  const setSandboxData = (key: string, data: any) => {
    localStorage.setItem(`mozz_sb_${key}`, JSON.stringify(data));
  };

  const SANDBOX_STAFF_KEY = 'staff';
  const SANDBOX_HOLIDAYS_KEY = 'holidays';

  useEffect(() => {
    if (isSandbox) {
      setStaff(getSandboxData<StaffMember[]>(SANDBOX_STAFF_KEY, []));
      setHolidays(getSandboxData<HolidayRecord[]>(SANDBOX_HOLIDAYS_KEY, []));
      setLoading(false);
      return;
    }

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
  }, [isSandbox]);

  // --- Date Range Logic (15th to 14th) ---
  const periodRange = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const startDate = new Date(year, month - 1, 15);
    const endDate = new Date(year, month, 14);
    return { startDate, endDate };
  }, [currentMonth]);

  const daysInPeriod = useMemo(() => {
    const days: Date[] = [];
    const { startDate, endDate } = periodRange;
    const curr = new Date(startDate);
    while (curr <= endDate) {
      days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return days;
  }, [periodRange]);
  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Get the first day of the month (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    // Get the number of days in the specific month
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    
    // Create array with padding for days before the 1st
    const days: (Date | null)[] = Array(firstDayOfMonth).fill(null);
    
    // Add actual days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  }, [currentMonth]);

  const getLeaveCount = (staffId: string) => {
    const { startDate, endDate } = periodRange;
    return holidays.filter(h => {
        const hDate = new Date(h.date);
        return h.staffId === staffId && hDate >= startDate && hDate <= endDate;
    }).length;
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    setActionLoading(true);
    try {
      const id = `staff_${Date.now()}`;
      const newStaff: StaffMember = {
        id,
        name: String(formData.get('name')),
        role: String(formData.get('role')),
        salary: Number(formData.get('salary')),
        loanBalance: Number(formData.get('loanBalance')) || 0,
        loanInstallment: 0,
        color: COLORS[staff.length % COLORS.length],
        isActive: true,
        joinedAt: Date.now()
      };

      if (isSandbox) {
        const nextStaff = [newStaff, ...staff];
        setStaff(nextStaff);
        setSandboxData(SANDBOX_STAFF_KEY, nextStaff);
      } else {
        await setDoc(doc(db, getFullPath('staff'), id), newStaff);
      }
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
      alert("Advance issued successfully.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- NEW: Handle Giving Loans ---
  const handleGiveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showLoanModal) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const amount = Number(formData.get('amount'));
    const source = formData.get('source') as string;
    const notes = formData.get('notes') as string;

    if (amount <= 0) {
      alert("Amount must be positive.");
      return;
    }

    setActionLoading(true);
    try {
      // 1. Move money from Bank to 'Staff Receivables' (Asset)
      await transferFunds(
        source,
        'staff_advances_rec', 
        amount,
        `Loan to ${showLoanModal.name}: ${notes}`,
        'Staff Loan', 
        { staffId: showLoanModal.id }
      );

      // 2. Update the Staff Member's loanBalance field
      if (isSandbox) {
        const nextStaff = staff.map(member => {
          if (member.id !== showLoanModal.id) return member;
          return { ...member, loanBalance: (member.loanBalance || 0) + amount };
        });
        setStaff(nextStaff);
        setSandboxData(SANDBOX_STAFF_KEY, nextStaff);
      } else {
        await updateDoc(doc(db, getFullPath('staff'), showLoanModal.id), {
          loanBalance: increment(amount)
        });
      }

      setShowLoanModal(null);
      alert("Loan issued successfully.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleHoliday = async (staffId: string, dateStr: string) => {
    if (!staffId) return; 
    
    const existing = holidays.find(h => h.staffId === staffId && h.date === dateStr);
    try {
      if (existing) {
        if (isSandbox) {
          const nextHolidays = holidays.filter(h => h.id !== existing.id);
          setHolidays(nextHolidays);
          setSandboxData(SANDBOX_HOLIDAYS_KEY, nextHolidays);
        } else {
          await deleteDoc(doc(db, getFullPath('holidays'), existing.id));
        }
      } else {
        const newHoliday: HolidayRecord = {
          id: `holiday_${Date.now()}`,
          staffId,
          date: dateStr
        };
        if (isSandbox) {
          const nextHolidays = [newHoliday, ...holidays];
          setHolidays(nextHolidays);
          setSandboxData(SANDBOX_HOLIDAYS_KEY, nextHolidays);
        } else {
          await addDoc(collection(db, getFullPath('holidays')), {
            staffId,
            date: dateStr
          });
        }
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- Helper: Calculate Outstanding Advances for UI ---
  const getOutstandingAdvances = (staffId: string) => {
    const staffTxs = transactions.filter(t => 
      (t as any).staffId === staffId && 
      ['Staff Advance', 'Staff Payroll Internal'].includes(t.category) &&
      t.isSettled
    );
    const issued = staffTxs.filter(t => t.category === 'Staff Advance').reduce((acc, t) => acc + t.amount, 0);
    const cleared = staffTxs.filter(t => t.category === 'Staff Payroll Internal').reduce((acc, t) => acc + t.amount, 0);
    return Math.max(0, issued - cleared);
  };

  const initiatePayroll = (staffId: string, type: 'SALARY' | 'SERVICE_CHARGE') => {
    const s = staff.find(sm => sm.id === staffId);
    if (!s) return;

    // Filter transactions (only 'Staff Advance' is auto-deducted)
    const staffTxs = transactions.filter(t => 
      (t as any).staffId === staffId && 
      ['Staff Advance', 'Staff Payroll Internal'].includes(t.category) &&
      t.isSettled
    );

    let totalIssued = 0;
    let totalCleared = 0;

    staffTxs.forEach(tx => {
       if (tx.category === 'Staff Advance') {
          totalIssued += tx.amount;
       } else if (tx.category === 'Staff Payroll Internal') {
          totalCleared += tx.amount;
       }
    });

    const outstandingAdvances = Math.max(0, totalIssued - totalCleared);

    setPayrollConfig({
      staff: s,
      type,
      baseAmount: type === 'SALARY' ? s.salary : 0,
      advancesTotal: outstandingAdvances,
      loanRepayment: 0,
      sourceId: 'business_bank'
    });
  };

  const confirmPayout = async () => {
    if (!payrollConfig) return;
    const { staff: s, type, baseAmount, advancesTotal, loanRepayment, sourceId } = payrollConfig;
    
    const netPay = baseAmount - advancesTotal - loanRepayment;
    if (netPay < 0) {
      alert("Net payout cannot be negative.");
      return;
    }

    setActionLoading(true);
    try {
      // 1. Pay Net Amount
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

      // 2. Clear Advances
      if (advancesTotal > 0) {
        await transferFunds(
          'staff_advances_rec',
          'payroll_expenses',
          advancesTotal,
          `Clearing Advances for ${s.name}`,
          'Staff Payroll Internal',
          { staffId: s.id }
        );
      }

      // 3. Loan Repayment
      // FIXED: Moves from 'staff_advances_rec' to Expense to cancel the debt asset
      if (loanRepayment > 0) {
        await transferFunds(
          'staff_advances_rec', 
          'payroll_expenses',
          loanRepayment,
          `Loan Repayment: ${s.name}`,
          'Staff Loan Repayment',
          { staffId: s.id }
        );
        if (isSandbox) {
          const nextStaff = staff.map(member => {
            if (member.id !== s.id) return member;
            return { ...member, loanBalance: Math.max(0, (member.loanBalance || 0) - loanRepayment) };
          });
          setStaff(nextStaff);
          setSandboxData(SANDBOX_STAFF_KEY, nextStaff);
        } else {
          await updateDoc(doc(db, getFullPath('staff'), s.id), {
            loanBalance: Math.max(0, s.loanBalance - loanRepayment)
          });
        }
      }

      alert(`Payroll processed for ${s.name}.`);
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
          <p className="text-slate-400">Manage team directory, attendance & payroll.</p>
        </div>
        <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-white/5">
          <button onClick={() => setActiveTab('directory')} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'directory' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Directory</button>
          <button onClick={() => setActiveTab('holidays')} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'holidays' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Holidays</button>
          <button onClick={() => setActiveTab('payroll')} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'payroll' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Payroll</button>
        </div>
      </div>

      {/* --- DIRECTORY TAB --- */}
      {activeTab === 'directory' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
               <h2 className="text-xl font-bold text-white">Employee Directory</h2>
               <div className="px-3 py-1 bg-slate-800 rounded-lg text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-white/5">
                  Cycle: {periodRange.startDate.getDate()} {periodRange.startDate.toLocaleString('default', { month: 'short' })} - {periodRange.endDate.getDate()} {periodRange.endDate.toLocaleString('default', { month: 'short' })}
               </div>
            </div>
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
                       <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Briefcase size={10} /> {s.role}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 relative z-10">
                   <div className="flex justify-between p-3 bg-slate-900/50 rounded-xl border border-white/5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Base Salary</span>
                      <span className="text-sm font-bold text-white">${s.salary.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between p-3 bg-slate-900/50 rounded-xl border border-white/5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Loan Balance</span>
                      <span className="text-sm font-bold text-rose-400">${s.loanBalance.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between p-3 bg-slate-900/50 rounded-xl border border-white/5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Leaves (This Cycle)</span>
                      <span className="text-sm font-bold text-purple-400">{getLeaveCount(s.id)} Days</span>
                   </div>
                </div>

                <button 
                  onClick={async () => {
                    if (isSandbox) {
                      const nextStaff = staff.filter(member => member.id !== s.id);
                      setStaff(nextStaff);
                      setSandboxData(SANDBOX_STAFF_KEY, nextStaff);
                      return;
                    }
                    await deleteDoc(doc(db, getFullPath('staff'), s.id));
                  }} 
                  className="absolute bottom-6 right-6 p-2 text-rose-400 hover:bg-rose-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  title="Delete Staff"
                >
                   <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- HOLIDAYS TAB --- */}
{/* --- HOLIDAYS TAB (UPDATED) --- */}
{/* --- HOLIDAYS TAB --- */}
{/* --- HOLIDAYS TAB --- */}
{activeTab === 'holidays' && (
        <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* 1. SELECTION PANEL (Left) */}
          <div className="lg:w-80 space-y-4">
            <div className="glass rounded-[2rem] p-6 border border-white/10 shadow-xl h-fit">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <UserCheck className="text-purple-400" size={20} /> 
                Select Staff
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Click a team member to manage their schedule. Then click dates on the calendar to toggle holidays.
              </p>
              
              <div className="grid grid-cols-1 gap-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                {staff.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStaffForHoliday(s.id === selectedStaffForHoliday ? '' : s.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                      selectedStaffForHoliday === s.id 
                        ? 'bg-purple-500/20 border-purple-500 text-white shadow-lg shadow-purple-500/10' 
                        : 'bg-slate-900/40 border-white/5 text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm ring-2 ring-transparent group-hover:ring-white/20 transition-all" style={{ backgroundColor: s.color }}>
                      {s.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs uppercase tracking-wide truncate">{s.name}</p>
                      <p className="text-[10px] opacity-60 truncate">{s.role}</p>
                    </div>
                    {selectedStaffForHoliday === s.id && <CheckCircle2 size={16} className="text-purple-400" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="glass rounded-[1.5rem] p-5 border border-white/10 flex flex-col gap-3">
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full bg-slate-500 opacity-50"></div>
                 <span className="text-[10px] uppercase font-bold text-slate-400">Other Staff Off</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full border-2 border-white bg-purple-500"></div>
                 <span className="text-[10px] uppercase font-bold text-slate-400">Selected Staff Off</span>
               </div>
            </div>
          </div>

          {/* 2. CYCLE VIEW (Right) */}
          <div className="flex-1 glass rounded-[2.5rem] p-4 md:p-8 border border-white/10 shadow-2xl">
            
            {/* Header: Controls the 15th-14th Cycle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {selectedStaffForHoliday 
                    ? `Editing: ${staff.find(s => s.id === selectedStaffForHoliday)?.name}` 
                    : 'Overview Mode'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                   Managing Cycle ending in {currentMonth.toLocaleDateString([], { month: 'long' })}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-2xl border border-white/5 self-start sm:self-auto">
                <button 
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} 
                  className="p-2 hover:bg-white/5 rounded-xl text-slate-400 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                
                {/* THE KEY CHANGE: Shows "Dec 15 - Jan 14" instead of "January" */}
                <span className="text-sm font-bold text-white min-w-[140px] text-center">
                  {periodRange.startDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })} - {periodRange.endDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                </span>
                
                <button 
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} 
                  className="p-2 hover:bg-white/5 rounded-xl text-slate-400 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Grid: Shows strictly the days in the cycle */}
            <div className="grid grid-cols-7 gap-2 md:gap-3">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest py-2">{d}</div>
              ))}

              {/* 1. Padding: Empty slots to align the 15th to the correct weekday */}
              {Array.from({ length: daysInPeriod[0].getDay() }).map((_, i) => (
                 <div key={`pad-start-${i}`} className="hidden md:block" />
              ))}

              {/* 2. Days: Renders strictly 15th -> 14th */}
              {daysInPeriod.map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const dayHolidays = holidays.filter(h => h.date === dateStr);
                
                // Logic to check if the CURRENTLY SELECTED staff is off
                const isSelectedStaffOff = selectedStaffForHoliday && dayHolidays.some(h => h.staffId === selectedStaffForHoliday);
                
                return (
                  <div 
                    key={dateStr}
                    onClick={() => selectedStaffForHoliday ? toggleHoliday(selectedStaffForHoliday, dateStr) : null}
                    className={`
                      aspect-square rounded-xl md:rounded-2xl p-1.5 md:p-2 flex flex-col justify-between transition-all border relative overflow-hidden
                      ${selectedStaffForHoliday 
                          ? 'cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 active:scale-95' 
                          : 'cursor-not-allowed opacity-60 grayscale-[0.5]'}
                      ${isSelectedStaffOff 
                          ? 'bg-rose-500/10 border-rose-500/40' 
                          : 'bg-slate-900/40 border-white/5'}
                    `}
                  >
                    <div className="flex justify-between items-start z-10">
                       <span className={`text-[10px] md:text-xs font-bold ${isSelectedStaffOff ? 'text-rose-400' : 'text-slate-500'}`}>
                         {date.getDate()}
                       </span>
                       {isSelectedStaffOff && <Heart size={10} className="text-rose-500 fill-rose-500" />}
                    </div>
                    
                    {/* Dots for staff currently on holiday */}
                    <div className="flex flex-wrap content-end gap-1 z-10">
                       {dayHolidays.map(h => {
                          const s = staff.find(sm => sm.id === h.staffId);
                          if (!s) return null;
                          
                          const isSelected = s.id === selectedStaffForHoliday;
                          
                          return (
                             <div 
                               key={h.id} 
                               title={s.name}
                               className={`rounded-full transition-all shadow-sm ${isSelected ? 'w-2 h-2 md:w-2.5 md:h-2.5 ring-2 ring-slate-900 z-20' : 'w-1.5 h-1.5 md:w-2 md:h-2 opacity-60'}`}
                               style={{ backgroundColor: s.color }}
                             />
                          );
                       })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- PAYROLL TAB --- */}
      {activeTab === 'payroll' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-xl space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Banknote className="text-emerald-400" /> Payroll & Advances</h2>
              <div className="space-y-4">
                {staff.map(s => (
                  <div key={s.id} className="p-6 bg-slate-900/50 rounded-[1.5rem] border border-white/5 hover:border-purple-500/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: s.color }}>{s.name[0]}</div>
                       <div>
                         <p className="font-bold text-white">{s.name}</p>
                         <p className="text-[10px] text-slate-500 uppercase tracking-widest">{s.role}</p>
                       </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       <button 
                         onClick={() => setShowAdvanceModal(s)}
                         className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-xl border border-white/10 uppercase tracking-widest transition-all flex items-center gap-2"
                       >
                         <Wallet size={12} className="text-amber-400" /> Advance
                       </button>
                       {/* NEW: Give Loan Button */}
                       <button 
                         onClick={() => setShowLoanModal(s)}
                         className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-xl border border-white/10 uppercase tracking-widest transition-all flex items-center gap-2"
                       >
                         <CreditCard size={12} className="text-rose-400" /> Loan
                       </button>
                       
                       <div className="w-px h-6 bg-white/10 mx-1" />

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
                   <p className="text-[10px] text-slate-400">Issue advances anytime. They are deducted from the next payout.</p>
                </li>
                <li className="flex gap-3">
                   <div className="p-1.5 bg-white/5 rounded-lg text-slate-400 h-fit"><CheckCircle2 size={14} /></div>
                   <p className="text-[10px] text-slate-400">Loans increase the staff debt balance and are deducted manually.</p>
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

      {/* --- MODALS --- */}
      
      {/* New Staff Modal */}
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
                   <input name="loanBalance" type="number" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Initial Loan Amount" />
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
             
             {/* Pending Balance Info */}
             <div className="mb-6 p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: showAdvanceModal.color }}>{showAdvanceModal.name[0]}</div>
                   <div>
                      <p className="font-bold text-white">{showAdvanceModal.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase">{showAdvanceModal.role}</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pending</p>
                   <p className="text-lg font-bold text-rose-400">${getOutstandingAdvances(showAdvanceModal.id).toLocaleString()}</p>
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

      {/* NEW: Give Loan Modal */}
      {showLoanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !actionLoading && setShowLoanModal(null)} />
          <div className="glass w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl font-bold text-white flex items-center gap-2"><CreditCard size={28} className="text-rose-400" /> New Loan</h2>
               <button onClick={() => setShowLoanModal(null)} className="text-slate-500 hover:text-white" disabled={actionLoading}><X size={24} /></button>
             </div>
             
             <div className="mb-6 p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: showLoanModal.color }}>{showLoanModal.name[0]}</div>
                   <div>
                      <p className="font-bold text-white">{showLoanModal.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase">Current Loan</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Balance</p>
                   <p className="text-lg font-bold text-rose-400">${showLoanModal.loanBalance.toLocaleString()}</p>
                </div>
             </div>

             <form onSubmit={handleGiveLoan} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Loan Amount</label>
                   <input name="amount" type="number" required className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-4 text-3xl font-black text-white outline-none" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Source of Funds</label>
                   <select name="source" required className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none">
                     <option value="till_float">Till Cash (${accounts.find(a => a.id === 'till_float')?.balance})</option>
                     <option value="business_bank">Business Bank (${accounts.find(a => a.id === 'business_bank')?.balance})</option>
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Notes / Terms</label>
                   <input name="notes" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none" placeholder="e.g. 6 month term" />
                </div>
                <button disabled={actionLoading} type="submit" className="w-full py-5 gradient-purple rounded-3xl text-white font-bold shadow-xl shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                  {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <CreditCard size={24} />} Issue Loan
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
