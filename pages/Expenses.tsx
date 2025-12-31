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
  orderBy,
  updateDoc
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
  RefreshCcw,
  Users,
  CalendarClock
} from 'lucide-react';
import { Transaction, ExpenseTemplate, RecurringExpense, Contact } from '../types';

export const Expenses: React.FC = () => {
  // 1. Get 'transactions' from the global context (Just like Money Lab)
  const { accounts, transferFunds, transactions } = useAccounts();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'log' | 'recent' | 'pending' | 'recurring'>('log');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Data State (We only need State for things NOT in the global context)
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Log Form State
  const [form, setForm] = useState({
    amount: '',
    contactId: '',
    manualDescription: '',
    category: 'Operations',
    fromAccountId: 'till_float',
    saveAsTemplate: false,
    isRecurring: false,
    receiveStock: false,
    frequency: 'MONTHLY' as any,
    dueDateOffset: 7
  });

  // Modal State
  const [settleContactId, setSettleContactId] = useState<string | null>(null);
  const [processRecurringModal, setProcessRecurringModal] = useState<RecurringExpense | null>(null);

  // --- FIXED: USE MEMO INSTEAD OF FIRESTORE QUERY ---
  
  // 1. Pending Bills: Filter directly from global transactions (Matches Money Lab logic)
  const pendingBills = useMemo(() => {
    return transactions.filter(t => 
      t.fromAccountId === 'pending_bills' && 
      !t.isSettled
    );
  }, [transactions]);

  // 2. Recent Expenses: Filter directly from global transactions
  const recentExpenses = useMemo(() => {
    return transactions
      .filter(t => 
        // Exclude system transfers, Shift opens/closes
        !['Transfer', 'Shift Close', 'Shift Open', 'Internal Transfer', 'Settlement'].includes(t.category) &&
        t.amount > 0 &&
        // Ensure we don't show Pending Bills in "Recent" until they are paid? 
        // Or show them? Usually recent log shows everything. 
        // Let's exclude strictly internal moves.
        t.fromAccountId !== 'pending_bills' 
      )
      .slice(0, 50); // Take top 50
  }, [transactions]);

  // Computed: Overdue Checks
  const overdueCount = useMemo(() => 
    pendingBills.filter(b => b.dueDate && Date.now() > b.dueDate).length, 
  [pendingBills]);

  const recurringDueCount = useMemo(() => 
    recurring.filter(r => r.nextDueDate && r.nextDueDate <= Date.now() + 86400000).length,
  [recurring]);

  useEffect(() => {
    let active = true;

    // 1. Fetch Templates (Keep local fetch or move to context if desired)
    const unsubTemplates = onSnapshot(collection(db, getFullPath('expense_templates')), (snap) => {
      if (active) setTemplates(snap.docs.map(d => ({ ...d.data(), id: d.id } as ExpenseTemplate)));
    });

    // 2. Fetch Recurring (Keep local fetch)
    const unsubRecurring = onSnapshot(collection(db, getFullPath('recurring_expenses')), (snap) => {
      if (active) setRecurring(snap.docs.map(d => ({ ...d.data(), id: d.id } as RecurringExpense)));
    });

    // 3. Fetch Contacts
    const unsubContacts = onSnapshot(collection(db, getFullPath('contacts')), (snap) => {
      if (active) {
        setContacts(snap.docs.map(d => ({ ...d.data(), id: d.id } as Contact)));
        setLoading(false); // Data is ready
      }
    });

    // REMOVED: unsubPending and unsubRecent (We use global context now)

    return () => {
      active = false;
      unsubTemplates();
      unsubRecurring();
      unsubContacts();
    };
  }, []);

  const handleStockTrigger = (desc: string, amount: number) => {
    alert(`📦 STOCK MODULE CONNECTION:\n\nCreating inventory record for:\nItem: ${desc}\nCost: $${amount}\n\n(Redirecting to Stock Reception...)`);
  };

  // Helper to find contact name
  const getContactName = (id?: string) => contacts.find(c => c.id === id)?.name || 'Unknown Vendor';

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || (!form.contactId && !form.manualDescription)) return;
    setActionLoading(true);

    try {
      const amountNum = Number(form.amount);
      const contact = contacts.find(c => c.id === form.contactId);
      const description = contact ? contact.name : form.manualDescription;
      
      const isIOU = form.fromAccountId === 'pending_bills';
      const dueDate = isIOU ? Date.now() + (form.dueDateOffset * 24 * 60 * 60 * 1000) : undefined;

      // 1. Execute Transfer (or log Liability)
      await transferFunds(
        form.fromAccountId,
        'operational_expenses',
        amountNum,
        description,
        form.category,
        {
          contactId: form.contactId,
          isSettled: !isIOU, // If pending, it's NOT settled
          dueDate: dueDate
        }
      );

      // 2. Save Template
      if (form.saveAsTemplate) {
        await addDoc(collection(db, getFullPath('expense_templates')), {
          name: description,
          amount: amountNum,
          category: form.category,
          fromAccountId: form.fromAccountId,
          description: description
        });
      }

      // 3. Create Recurring Reminder (Not auto-deduct)
      if (form.isRecurring) {
        await addDoc(collection(db, getFullPath('recurring_expenses')), {
          name: description,
          amount: amountNum, // Default amount
          frequency: form.frequency,
          fromAccountId: form.fromAccountId,
          category: form.category,
          description: description,
          contactId: form.contactId || null,
          isActive: true,
          nextDueDate: Date.now() + (30 * 24 * 60 * 60 * 1000) // Default next month
        });
      }

      // 4. Stock Trigger
      if (form.receiveStock) {
        handleStockTrigger(description, amountNum);
      } else {
        alert(isIOU ? "Bill logged as Pending Payment (IOU)" : "Expense logged successfully!");
      }

      // Reset
      setForm({
        ...form,
        amount: '',
        contactId: '',
        manualDescription: '',
        receiveStock: false,
        saveAsTemplate: false,
        isRecurring: false
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processRecurringModal) return;
    
    const formData = new FormData(e.target as HTMLFormElement);
    const amount = Number(formData.get('amount'));
    
    setActionLoading(true);
    try {
      // 1. Pay
      await transferFunds(
        processRecurringModal.fromAccountId,
        'operational_expenses',
        amount,
        processRecurringModal.description,
        processRecurringModal.category,
        { contactId: processRecurringModal.contactId }
      );

      // 2. Update Next Due Date
      const nextDate = new Date();
      if (processRecurringModal.frequency === 'MONTHLY') nextDate.setMonth(nextDate.getMonth() + 1);
      if (processRecurringModal.frequency === 'WEEKLY') nextDate.setDate(nextDate.getDate() + 7);
      
      await updateDoc(doc(db, getFullPath('recurring_expenses'), processRecurringModal.id), {
        nextDueDate: nextDate.getTime()
      });

      setProcessRecurringModal(null);
      alert("Recurring payment processed!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSettleGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleContactId) return;
    
    const formData = new FormData(e.target as HTMLFormElement);
    const source = formData.get('source') as string;
    const billsToSettle = pendingBills.filter(b => b.contactId === settleContactId);
    
    setActionLoading(true);
    try {
      // Settle each bill
      for (const bill of billsToSettle) {
        await transferFunds(
          source,
          'pending_bills', // Moving money OUT of pending (liability reduction)
          bill.amount,
          `Settlement: ${bill.description}`,
          'Debt Settlement'
        );
        // Mark original as settled
        await updateDoc(doc(db, getFullPath('transactions'), bill.id), { isSettled: true });
      }
      setSettleContactId(null);
      alert("All bills for this contact settled!");
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
      manualDescription: t.description,
      category: t.category,
      fromAccountId: t.fromAccountId
    });
  };

  const deleteTemplate = async (id: string) => {
    if (confirm("Delete this template?")) {
      await deleteDoc(doc(db, getFullPath('expense_templates'), id));
    }
  };

  if (loading) return <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-purple-400" size={40} /></div>;

  // Group Pending Bills by Contact
  const groupedPending = pendingBills.reduce((acc, bill) => {
    const key = bill.contactId || 'unknown';
    if (!acc[key]) acc[key] = { name: getContactName(bill.contactId), amount: 0, count: 0, bills: [] };
    acc[key].amount += bill.amount;
    acc[key].count += 1;
    acc[key].bills.push(bill);
    return acc;
  }, {} as Record<string, { name: string, amount: number, count: number, bills: Transaction[] }>);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Receipt className="text-rose-400" />
            Bills & Expenses
          </h1>
          <p className="text-slate-400">Log costs, manage payables, and track recurring bills.</p>
        </div>
        {(overdueCount > 0 || recurringDueCount > 0) && (
             <div className="flex gap-2">
                {overdueCount > 0 && <div className="px-4 py-2 bg-rose-500/20 text-rose-400 rounded-xl text-xs font-bold border border-rose-500/20 flex items-center gap-2 animate-pulse"><AlertCircle size={14}/> {overdueCount} Overdue Bills</div>}
                {recurringDueCount > 0 && <div className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl text-xs font-bold border border-purple-500/20 flex items-center gap-2"><CalendarClock size={14}/> {recurringDueCount} Due Recurring</div>}
             </div>
        )}
      </div>

      <div className="flex p-1.5 bg-slate-900/50 rounded-2xl w-fit border border-white/5 overflow-x-auto">
        <button onClick={() => setActiveTab('log')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'log' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Log Expense</button>
        <button onClick={() => setActiveTab('recent')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'recent' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Recent Activity</button>
        <button onClick={() => setActiveTab('pending')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'pending' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Pending (IOUs)</button>
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
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Vendor / Contact</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1 group">
                            <Users size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                            <select value={form.contactId} onChange={(e) => setForm({...form, contactId: e.target.value, manualDescription: ''})} className="w-full bg-slate-900 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none appearance-none">
                                <option value="">-- Select Contact --</option>
                                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    {/* Fallback for one-off vendors */}
                    {!form.contactId && (
                        <input value={form.manualDescription} onChange={(e) => setForm({...form, manualDescription: e.target.value})} placeholder="Or type One-Off Vendor Name..." className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-purple-500/50 outline-none mt-2" />
                    )}
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
                       {/* Only show 'Save Template' if not IOU */}
                       {form.fromAccountId !== 'pending_bills' && (
                         <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={form.saveAsTemplate} onChange={(e) => setForm({...form, saveAsTemplate: e.target.checked})} className="w-5 h-5 rounded-lg border-white/10 bg-slate-900 text-purple-500 focus:ring-0 focus:ring-offset-0 transition-all" />
                            <span className="text-xs text-slate-400 group-hover:text-white transition-colors">Save as Template</span>
                         </label>
                       )}
                       <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="checkbox" checked={form.isRecurring} onChange={(e) => setForm({...form, isRecurring: e.target.checked})} className="w-5 h-5 rounded-lg border-white/10 bg-slate-900 text-purple-500 focus:ring-0 focus:ring-offset-0 transition-all" />
                          <span className="text-xs text-slate-400 group-hover:text-white transition-colors">Create Reminder</span>
                       </label>
                    </div>
                  </div>

                  {form.fromAccountId === 'pending_bills' && (
                     <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                         <h4 className="text-xs font-bold text-rose-400 flex items-center gap-2 mb-1"><AlertCircle size={14} /> Payment Pending (IOU)</h4>
                         <p className="text-[10px] text-slate-400">This will not deduct money now. A 7-day reminder will be set.</p>
                     </div>
                  )}

                  <button disabled={actionLoading} type="submit" className="w-full py-5 gradient-purple rounded-3xl text-white font-bold shadow-xl shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                    {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Zap size={24} />} 
                    {form.fromAccountId === 'pending_bills' ? 'Record Payable Debt' : 'Log Expense'}
                  </button>
                </form>
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
            </div>
          </>
        )}

        {activeTab === 'recent' && (
          <div className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="glass rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5">
                 <h2 className="text-xl font-bold text-white">Recent Expenses</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
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
                            <PackageCheck size={14} /> Stock
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.keys(groupedPending).map(key => {
                    const group = groupedPending[key];
                    const isOverdue = group.bills.some(b => b.dueDate && Date.now() > b.dueDate);
                    return (
                        <div key={key} className={`glass rounded-[2rem] p-6 border ${isOverdue ? 'border-rose-500/50 shadow-rose-900/20' : 'border-white/10'} shadow-lg`}>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        {group.name}
                                        {isOverdue && <AlertCircle size={16} className="text-rose-500" />}
                                    </h3>
                                    <p className="text-xs text-slate-500">{group.count} Outstanding Bills</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black text-rose-400">${group.amount.toLocaleString()}</p>
                                    <button onClick={() => setSettleContactId(key === 'unknown' ? null : key)} className="mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20">
                                        Settle All
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {group.bills.map(b => (
                                    <div key={b.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-white/5">
                                        <div>
                                            <p className="text-xs text-white font-bold">{b.description}</p>
                                            <p className="text-[10px] text-slate-500">Due: {new Date(b.dueDate || 0).toLocaleDateString()}</p>
                                        </div>
                                        <span className="text-xs font-bold text-rose-400">${b.amount}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>
        )}

        {activeTab === 'recurring' && (
          <div className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recurring.map(rec => {
                  const isDue = rec.nextDueDate && rec.nextDueDate <= Date.now() + 86400000;
                  return (
                    <div key={rec.id} className={`glass rounded-[2rem] p-6 border ${isDue ? 'border-purple-500 shadow-purple-500/20' : 'border-white/10'} shadow-lg space-y-4`}>
                      <div className="flex justify-between items-start">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDue ? 'bg-purple-500 text-white animate-bounce' : 'bg-slate-800 text-slate-500'}`}>
                          <CalendarClock size={20} />
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{rec.frequency}</span>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{rec.name}</h3>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">Next Due: {new Date(rec.nextDueDate || Date.now()).toLocaleDateString()}</p>
                      </div>
                      <div className="pt-4 border-t border-white/5 flex gap-2">
                         <button onClick={() => setProcessRecurringModal(rec)} className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-purple-500/20">
                            Process Payment
                         </button>
                         <button onClick={() => deleteDoc(doc(db, getFullPath('recurring_expenses'), rec.id))} className="p-3 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-500 rounded-xl transition-all"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Settle Group */}
      {settleContactId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSettleContactId(null)} />
          <div className="glass w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
             <h2 className="text-xl font-bold text-white mb-6">Settle Account: {getContactName(settleContactId)}</h2>
             <form onSubmit={handleSettleGroup} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Pay From</label>
                  <select name="source" required className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white">
                    <option value="till_float">Till Cash</option>
                    <option value="business_bank">Business Bank</option>
                  </select>
                </div>
                <button disabled={actionLoading} type="submit" className="w-full py-4 bg-emerald-500 rounded-2xl text-white font-bold">
                  {actionLoading ? <Loader2 className="animate-spin" /> : 'Confirm Settlement'}
                </button>
             </form>
          </div>
        </div>
      )}

      {/* MODAL: Process Recurring */}
      {processRecurringModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setProcessRecurringModal(null)} />
          <div className="glass w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
             <h2 className="text-xl font-bold text-white mb-2">Process Recurring Bill</h2>
             <p className="text-slate-400 text-sm mb-6">Confirm the actual amount for this period.</p>
             
             <form onSubmit={handleProcessRecurring} className="space-y-6">
                <div className="p-4 bg-slate-900 rounded-2xl border border-white/5">
                   <p className="text-sm font-bold text-white">{processRecurringModal.name}</p>
                   <p className="text-xs text-slate-500 uppercase">{processRecurringModal.category}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Actual Amount Due</label>
                  <input name="amount" type="number" step="0.01" defaultValue={processRecurringModal.amount} className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white text-xl font-bold" />
                </div>

                <button disabled={actionLoading} type="submit" className="w-full py-4 bg-purple-500 rounded-2xl text-white font-bold">
                  {actionLoading ? <Loader2 className="animate-spin" /> : 'Confirm & Pay'}
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};