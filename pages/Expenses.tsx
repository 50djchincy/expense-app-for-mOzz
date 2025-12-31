import React, { useState, useEffect, useMemo } from 'react';
import { useAccounts } from '../AccountsContext';
import { useAuth } from '../AuthContext';
import { db, getFullPath } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  deleteDoc, 
  query, 
  where,
  limit,
  orderBy
} from 'firebase/firestore';
import { 
  Receipt, 
  Star, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  X,
  Zap,
  PackageCheck,
  FileText,
  RefreshCcw,
  Search
} from 'lucide-react';
import { Transaction, ExpenseTemplate, RecurringExpense } from '../types';

export const Expenses: React.FC = () => {
  const { profile } = useAuth();
  const { accounts, transferFunds } = useAccounts();
  
  // Tabs: 'log' (Entry), 'recent' (History), 'pending' (IOUs), 'recurring' (Auto)
  const [activeTab, setActiveTab] = useState<'log' | 'recent' | 'pending' | 'recurring'>('log');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [pendingBills, setPendingBills] = useState<Transaction[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Transaction[]>([]);
  
  // Log Form State
  const [form, setForm] = useState({
    amount: '',
    description: '',
    category: 'Operations',
    fromAccountId: 'till_float',
    saveAsTemplate: false,
    isRecurring: false,
    receiveStock: false,
    frequency: 'MONTHLY' as any
  });

  // Vendor Autocomplete
  const uniqueVendors = useMemo(() => {
    const vendors = new Set(recentExpenses.map(t => t.description));
    return Array.from(vendors);
  }, [recentExpenses]);

  // Modal State
  const [settleModal, setSettleModal] = useState<Transaction | null>(null);

  useEffect(() => {
    let active = true;

    // 1. Fetch Templates
    const unsubTemplates = onSnapshot(collection(db, getFullPath('expense_templates')), (snap) => {
      if (active) setTemplates(snap.docs.map(d => ({ ...d.data(), id: d.id } as ExpenseTemplate)));
    });

    // 2. Fetch Recurring
    const unsubRecurring = onSnapshot(collection(db, getFullPath('recurring_expenses')), (snap) => {
      if (active) setRecurring(snap.docs.map(d => ({ ...d.data(), id: d.id } as RecurringExpense)));
    });

    // 3. Fetch Pending Bills (Liabilities)
    const unsubPending = onSnapshot(
      query(collection(db, getFullPath('transactions')), where('fromAccountId', '==', 'pending_bills')),
      (snap) => {
        if (active) setPendingBills(snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction)));
      }
    );

    // 4. Fetch Recent Expenses (FIXED: Removed complex 'where' clause to prevent Index Error hang)
    const unsubRecent = onSnapshot(
      query(
        collection(db, getFullPath('transactions')), 
        orderBy('date', 'desc'), 
        limit(60) // Fetch slightly more to account for filtering
      ),
      (snap) => {
        if (active) {
          const allDocs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction));
          // Filter client-side to avoid "Composite Index Missing" error
          const filtered = allDocs.filter(t => t.category !== 'Transfer').slice(0, 50);
          setRecentExpenses(filtered);
          setLoading(false); // <--- This ensures the loading spinner stops
        }
      },
      (error) => {
        console.error("Error fetching recent expenses:", error);
        // Ensure we stop loading even if there's an error
        if (active) setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubTemplates();
      unsubRecurring();
      unsubPending();
      unsubRecent();
    };
  }, []);

  const handleStockTrigger = (desc: string, amount: number) => {
    alert(`📦 STOCK MODULE CONNECTION:\n\nCreating inventory record for:\nItem: ${desc}\nCost: $${amount}\n\n(Redirecting to Stock Reception...)`);
  };

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description) return;
    setActionLoading(true);

    try {
      const amountNum = Number(form.amount);
      
      // 1. Execute Transfer
      await transferFunds(
        form.fromAccountId,
        'operational_expenses',
        amountNum,
        form.description,
        form.category
      );

      // 2. Templates
      if (form.saveAsTemplate) {
        await addDoc(collection(db, getFullPath('expense_templates')), {
          name: form.description,
          amount: amountNum,
          category: form.category,
          fromAccountId: form.fromAccountId,
          description: form.description
        });
      }

      // 3. Recurring
      if (form.isRecurring) {
        await addDoc(collection(db, getFullPath('recurring_expenses')), {
          name: form.description,
          amount: amountNum,
          frequency: form.frequency,
          fromAccountId: form.fromAccountId,
          category: form.category,
          description: form.description,
          isActive: true,
          lastGenerated: Date.now()
        });
      }

      // 4. Stock Trigger
      if (form.receiveStock) {
        handleStockTrigger(form.description, amountNum);
      } else {
        alert("Expense logged successfully!");
      }

      // Reset
      setForm({
        amount: '',
        description: '',
        category: 'Operations',
        fromAccountId: 'till_float',
        saveAsTemplate: false,
        isRecurring: false,
        receiveStock: false,
        frequency: 'MONTHLY'
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const loadTemplate = (t: ExpenseTemplate) => {
    setForm({
      ...form,
      amount: t.amount.toString(),
      description: t.description,
      category: t.category,
      fromAccountId: t.fromAccountId
    });
  };

  const handleSettleBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleModal) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const source = formData.get('source') as string;
    
    setActionLoading(true);
    try {
      await transferFunds(
        source,
        'pending_bills',
        settleModal.amount,
        `Settled: ${settleModal.description}`,
        'Debt Settlement'
      );
      setSettleModal(null);
      alert("Bill settled successfully!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (confirm("Delete this template?")) {
      await deleteDoc(doc(db, getFullPath('expense_templates'), id));
    }
  };

  if (loading) return <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-purple-400" size={40} /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Receipt className="text-rose-400" />
            Bills & Expenses
          </h1>
          <p className="text-slate-400">Log costs, manage payables, and connect to inventory.</p>
        </div>
      </div>

      <div className="flex p-1.5 bg-slate-900/50 rounded-2xl w-fit border border-white/5 overflow-x-auto">
        <button onClick={() => setActiveTab('log')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'log' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Log Expense</button>
        <button onClick={() => setActiveTab('recent')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'recent' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Recent Activity</button>
        <button onClick={() => setActiveTab('pending')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'pending' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Pending {pendingBills.length > 0 && <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />}</button>
        <button onClick={() => setActiveTab('recurring')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'recurring' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Recurring</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {activeTab === 'log' && (
          <>
            <div className="lg:col-span-2 space-y-6">
              {templates.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Quick Load Templates</h3>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {templates.map(t => (
                      <div key={t.id} className="relative group shrink-0">
                        <button onClick={() => loadTemplate(t)} className="px-5 py-4 bg-slate-900 border border-white/5 rounded-2xl hover:border-purple-500/50 transition-all text-left min-w-[140px] shadow-lg group">
                          <Star size={14} className="text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                          <p className="text-xs font-bold text-white truncate w-24">{t.name}</p>
                          <p className="text-[10px] text-slate-500 mt-1">${t.amount}</p>
                        </button>
                        <button onClick={() => deleteTemplate(t.id)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500/80 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="glass rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
                <form onSubmit={handleLogExpense} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Payment Source</label>
                      <select value={form.fromAccountId} onChange={(e) => setForm({...form, fromAccountId: e.target.value})} className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none">
                        <option value="till_float">Till Cash (Register)</option>
                        <option value="business_bank">Business Bank</option>
                        <option value="staff_card">Staff Card (Credit)</option>
                        <option value="pending_bills">Payment Pending (I.O.U)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Amount</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                        <input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} placeholder="0.00" className="w-full bg-slate-900 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-2xl font-bold text-white focus:ring-2 focus:ring-purple-500/50 outline-none" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Description / Vendor</label>
                    <div className="relative group">
                        <FileText size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                        <input required list="vendor-suggestions" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="e.g. Fresh Veggies Market" className="w-full bg-slate-900 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none" />
                        <datalist id="vendor-suggestions">
                            {uniqueVendors.map((v, i) => <option key={i} value={v} />)}
                        </datalist>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Category</label>
                      <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none">
                        <option>Operations</option>
                        <option>Supplies</option>
                        <option>Stock/Inventory</option>
                        <option>Staff Lunch</option>
                        <option>Utility</option>
                        <option>Repair</option>
                        <option>Marketing</option>
                      </select>
                    </div>
                    
                    <div className="flex flex-col justify-center gap-3 pl-2">
                       <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="checkbox" checked={form.receiveStock} onChange={(e) => setForm({...form, receiveStock: e.target.checked})} className="w-5 h-5 rounded-lg border-emerald-500/50 bg-emerald-500/10 text-emerald-500 focus:ring-0 focus:ring-offset-0 transition-all" />
                          <span className="text-sm text-emerald-400 font-bold group-hover:text-emerald-300 transition-colors flex items-center gap-2"><PackageCheck size={16} /> Receive into Inventory</span>
                       </label>
                       <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="checkbox" checked={form.saveAsTemplate} onChange={(e) => setForm({...form, saveAsTemplate: e.target.checked})} className="w-5 h-5 rounded-lg border-white/10 bg-slate-900 text-purple-500 focus:ring-0 focus:ring-offset-0 transition-all" />
                          <span className="text-xs text-slate-400 group-hover:text-white transition-colors">Save as Template</span>
                       </label>
                       <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="checkbox" checked={form.isRecurring} onChange={(e) => setForm({...form, isRecurring: e.target.checked})} className="w-5 h-5 rounded-lg border-white/10 bg-slate-900 text-purple-500 focus:ring-0 focus:ring-offset-0 transition-all" />
                          <span className="text-xs text-slate-400 group-hover:text-white transition-colors">Mark as Recurring</span>
                       </label>
                    </div>
                  </div>

                  {form.isRecurring && (
                    <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest ml-1">Billing Cycle</label>
                      <div className="flex gap-4 mt-2">
                        {['DAILY', 'WEEKLY', 'MONTHLY'].map(freq => (
                          <button 
                            key={freq}
                            type="button"
                            onClick={() => setForm({...form, frequency: freq as any})}
                            className={`flex-1 py-2 rounded-xl text-[10px] font-bold border transition-all ${form.frequency === freq ? 'bg-purple-500 text-white border-purple-500' : 'bg-slate-900 text-slate-500 border-white/5 hover:text-white'}`}
                          >
                            {freq}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button disabled={actionLoading} type="submit" className="w-full py-5 gradient-purple rounded-3xl text-white font-bold shadow-xl shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                    {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Zap size={24} />} Log Operations Expense
                  </button>
                </form>
              </div>

              {/* Just Logged Section */}
              <div className="px-4">
                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Just Logged</h4>
                 <div className="space-y-2">
                    {recentExpenses.slice(0, 3).map(tx => (
                        <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-900 rounded-lg text-slate-400"><Receipt size={14} /></div>
                                <div>
                                    <p className="text-sm font-bold text-white">{tx.description}</p>
                                    <p className="text-[10px] text-slate-500">{tx.category}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-rose-400">-${tx.amount}</span>
                                <button onClick={() => handleStockTrigger(tx.description, tx.amount)} title="Receive Stock Check" className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors"><PackageCheck size={14} /></button>
                            </div>
                        </div>
                    ))}
                 </div>
              </div>
            </div>

            {/* Help/Status Column */}
            <div className="space-y-6">
              <div className="glass rounded-[2rem] p-6 border border-white/10 shadow-lg bg-gradient-to-br from-white/5 to-transparent">
                <h4 className="text-sm font-bold text-white mb-4">Account Summary</h4>
                <div className="space-y-4">
                  {accounts.filter(a => ['till_float', 'business_bank', 'pending_bills'].includes(a.id)).map(acc => (
                    <div key={acc.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-white/5">
                      <span className="text-xs text-slate-400">{acc.name}</span>
                      <span className={`text-sm font-bold ${acc.type === 'LIABILITY' ? 'text-rose-400' : 'text-emerald-400'}`}>${acc.balance.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-[2rem] flex items-start gap-4">
                 <AlertCircle size={20} className="text-blue-400 shrink-0" />
                 <div className="space-y-1">
                   <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Expense Tip</p>
                   <p className="text-[10px] text-slate-500 leading-relaxed italic">
                     Use the "Receive into Inventory" checkbox for supplies. Use the "Receive Stock" button on recent transactions to link expenses to your inventory module after the fact.
                   </p>
                 </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'recent' && (
          <div className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="glass rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5">
                 <h2 className="text-xl font-bold text-white">Recent Activity & Stock Check</h2>
                 <p className="text-xs text-slate-500 mt-1">Verify expenses and confirm stock arrival.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Stock Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {recentExpenses.map(tx => (
                      <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-8 py-5 text-xs text-slate-400">{new Date(tx.date).toLocaleDateString()}</td>
                        <td className="px-8 py-5">
                          <p className="text-sm font-bold text-white">{tx.description}</p>
                          <span className="text-[10px] text-slate-500 uppercase">{tx.category}</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-sm font-bold text-rose-400">${tx.amount.toLocaleString()}</span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button onClick={() => handleStockTrigger(tx.description, tx.amount)} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-emerald-500 hover:text-white text-slate-400 text-xs font-bold rounded-xl transition-all border border-white/5">
                            <PackageCheck size={14} /> Receive Stock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="glass rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                 <div>
                   <h2 className="text-xl font-bold text-white">Pending Settlements</h2>
                   <p className="text-xs text-slate-500 mt-1">Liabilities needing liquidation.</p>
                 </div>
                 <div className="px-4 py-2 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/20 text-xs font-bold">
                    Total: ${pendingBills.reduce((sum, b) => sum + b.amount, 0).toLocaleString()}
                 </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pendingBills.map(bill => (
                      <tr key={bill.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-8 py-5 text-xs text-slate-400">{new Date(bill.date).toLocaleDateString()}</td>
                        <td className="px-8 py-5">
                          <p className="text-sm font-bold text-white">{bill.description}</p>
                          <span className="text-[10px] text-slate-500 uppercase">{bill.category}</span>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-sm font-bold text-rose-400">${bill.amount.toLocaleString()}</span>
                        </td>
                        <td className="px-8 py-5 text-right flex items-center justify-end gap-2">
                          <button onClick={() => handleStockTrigger(bill.description, bill.amount)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 rounded-xl transition-all" title="Verify Stock Received">
                             <PackageCheck size={18} />
                          </button>
                          <button onClick={() => setSettleModal(bill)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                            Settle Now
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'recurring' && (
          <div className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recurring.map(rec => (
                <div key={rec.id} className="glass rounded-[2rem] p-6 border border-white/10 shadow-lg space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                      <RefreshCcw size={20} />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/10">{rec.frequency}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{rec.name}</h3>
                    <p className="text-2xl font-black text-white mt-1">${rec.amount.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">{rec.category}</p>
                  </div>
                  <div className="pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 italic">
                    <span>Active since {new Date(rec.lastGenerated || 0).toLocaleDateString()}</span>
                    <button onClick={() => deleteDoc(doc(db, getFullPath('recurring_expenses'), rec.id))} className="text-rose-400 hover:text-rose-300"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {recurring.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-500 italic glass rounded-[2rem] border border-white/10">
                   No recurring expenses established yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {settleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSettleModal(null)} />
          <div className="glass w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
             <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
             <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400"><CheckCircle2 size={24} /></div>
                 <div>
                   <h2 className="text-2xl font-bold text-white">Settle Bill</h2>
                   <p className="text-slate-400 text-sm">Clear this payable debt</p>
                 </div>
               </div>
               <button onClick={() => setSettleModal(null)} className="text-slate-500 hover:text-white"><X size={24} /></button>
             </div>
             <div className="mb-8 p-4 bg-slate-900 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Bill Details</p>
                <p className="text-lg font-bold text-white">{settleModal.description}</p>
                <p className="text-2xl font-black text-emerald-400 mt-2">${settleModal.amount.toLocaleString()}</p>
             </div>
             <form onSubmit={handleSettleBill} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Payment Source</label>
                  <select name="source" required className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500/50 outline-none">
                    <option value="till_float">Till Cash (${accounts.find(a => a.id === 'till_float')?.balance})</option>
                    <option value="business_bank">Business Bank (${accounts.find(a => a.id === 'business_bank')?.balance})</option>
                  </select>
                </div>
                <button disabled={actionLoading} type="submit" className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 rounded-2xl text-white font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2">
                  {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />} Complete Settlement
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};