import React, { useState, useEffect, useMemo } from 'react';
import { useAccounts } from '../AccountsContext';
import { useAuth } from '../AuthContext';
import { db, getFullPath } from '../firebase';
import { 
  collection, 
  query,
  onSnapshot, 
  where, 
  addDoc, 
  updateDoc, 
  doc, 
  orderBy, 
  limit,
  setDoc
} from 'firebase/firestore';
import { 
  Sun, 
  Moon, 
  Calculator, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Wallet,
  ArrowRight,
  TrendingDown,
  X,
  Loader2,
  ChevronRight,
  Zap,
  User,
  Banknote,
  CreditCard,
  FileText,
  ArrowUpCircle,
  Landmark // [NEW]: Added Icon for Bank
} from 'lucide-react';
import { Shift, Customer, Transaction } from '../types';

const CURRENCY_DENOMINATIONS = [
  { label: '5000', value: 5000 },
  { label: '2000', value: 2000 },
  { label: '1000', value: 1000 },
  { label: '500', value: 500 },
  { label: '200', value: 200 },
  { label: '100', value: 100 },
  { label: '50', value: 50 },
  { label: '20', value: 20 },
  { label: '10', value: 10 },
  { label: '5', value: 5 },
  { label: '1', value: 1 },
];

export const DailyOps: React.FC = () => {
  const { profile } = useAuth();
  const { accounts, transferFunds, loading: accountsLoading } = useAccounts();
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shiftExpenses, setShiftExpenses] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI States
  const [showDenomCalc, setShowDenomCalc] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showBankCashModal, setShowBankCashModal] = useState(false); // [NEW]: State for Bank Modal
  const [actionLoading, setActionLoading] = useState(false);

  // Closing Form States
  const [closeForm, setCloseForm] = useState({
    totalSales: 0,
    cardPayments: 0,
    creditBills: 0,
    creditBillCustomerId: '',
    hikingBarSales: 0,
    foreignCurrencyAmount: 0,
    foreignCurrencyNotes: '',
    actualCash: 0,
    notes: ''
  });

  // Denomination State
  const [denoms, setDenoms] = useState<Record<number, number>>({});

  useEffect(() => {
    const q = query(
      collection(db, getFullPath('shifts')),
      orderBy('openedAt', 'desc'),
      limit(1)
    );

    const unsubShift = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data() as Shift;
        setCurrentShift({ ...data, id: snap.docs[0].id });
      } else {
        setCurrentShift(null);
      }
      setLoading(false);
    });

    const unsubCustomers = onSnapshot(collection(db, getFullPath('customers')), (snap) => {
      setCustomers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer)));
    });

    return () => {
      unsubShift();
      unsubCustomers();
    };
  }, []);

  // Sync Shift Expenses
  useEffect(() => {
    if (currentShift && currentShift.status === 'OPEN') {
      const q = query(
        collection(db, getFullPath('transactions')),
        where('fromAccountId', '==', 'till_float')
      );
      
      const unsub = onSnapshot(q, (snap) => {
        const docs = snap.docs.map(d => d.data() as Transaction);
        // [UPDATED]: Filter now includes 'Transfer' and 'Capital' so banking cash counts as money leaving the drawer
        const filtered = docs.filter(tx => 
          (tx.category === 'Operations' || tx.category === 'Transfer' || tx.category === 'Capital') && 
          tx.date >= currentShift.openedAt
        );
        setShiftExpenses(filtered);
      });
      return () => unsub();
    }
  }, [currentShift]);

  const totalTillExpenses = useMemo(() => 
    shiftExpenses.reduce((sum, e) => sum + e.amount, 0), 
  [shiftExpenses]);

  const calculateExpectedCash = (): number => {
    if (!currentShift) return 0;
    const floatAmount = Number(currentShift.openingFloat) || 0;
    const totalSalesVal = Number(closeForm.totalSales) || 0;
    const cardPaymentsVal = Number(closeForm.cardPayments) || 0;
    const creditBillsVal = Number(closeForm.creditBills) || 0;
    const hikingBarSalesVal = Number(closeForm.hikingBarSales) || 0;
    const foreignCurrencyVal = Number(closeForm.foreignCurrencyAmount) || 0;
    const expensesVal = Number(totalTillExpenses) || 0;

    const cashSales = totalSalesVal - cardPaymentsVal - creditBillsVal - hikingBarSalesVal - foreignCurrencyVal;
    return floatAmount + cashSales - expensesVal;
  };

  const expectedCashValue = calculateExpectedCash();
  const actualCashValue = Number(closeForm.actualCash) || 0;
  const varianceValue = actualCashValue - expectedCashValue;

  const handleOpenShift = async () => {
    setActionLoading(true);
    try {
      const tillFloatAcc = accounts.find(a => a.id === 'till_float');
      const openingFloat = tillFloatAcc?.balance || 0;

      await addDoc(collection(db, getFullPath('shifts')), {
        status: 'OPEN',
        openedAt: Date.now(),
        openedBy: profile?.displayName || 'Unknown',
        openingFloat: openingFloat,
      });
    } catch (err: any) {
      alert(err.message || "Failed to open shift.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const amount = Number(formData.get('amount'));
    const sourceId = formData.get('sourceId') as string;

    if (!amount || amount <= 0) return;

    setActionLoading(true);
    try {
      await transferFunds(
        sourceId,
        'till_float',
        amount,
        'Register Cash Injection (Float Top-up)',
        'Capital'
      );
      setShowTopUpModal(false);
      alert(`Success: $${amount} added to Register Cash.`);
    } catch (err: any) {
      alert(err.message || "Top up failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // [NEW]: Handle Bank Cash Logic
  const handleBankCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const amount = Number(formData.get('amount'));
    const targetId = formData.get('targetId') as string;

    if (!amount || amount <= 0) return;

    setActionLoading(true);
    try {
      await transferFunds(
        'till_float',
        targetId,
        amount,
        'Register Cash Deposit (Bank Drop)',
        'Transfer' // Important: Category is Transfer
      );
      setShowBankCashModal(false);
      alert(`Success: $${amount} moved to Bank.`);
    } catch (err: any) {
      alert(err.message || "Banking failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;
    if (closeForm.creditBills > 0 && !closeForm.creditBillCustomerId) {
      alert("Please select a customer for the Credit Bills.");
      return;
    }
    setActionLoading(true);
    try {
      const totalSalesVal = Number(closeForm.totalSales) || 0;
      const cardPaymentsVal = Number(closeForm.cardPayments) || 0;
      const creditBillsVal = Number(closeForm.creditBills) || 0;
      const hikingBarSalesVal = Number(closeForm.hikingBarSales) || 0;
      const foreignCurrencyVal = Number(closeForm.foreignCurrencyAmount) || 0;

      const revenueSource = 'service_fee_income';

      // 1. Local Cash Portion -> Till Float
      const localCashSales = totalSalesVal - cardPaymentsVal - creditBillsVal - hikingBarSalesVal - foreignCurrencyVal;
      if (localCashSales > 0) {
        await transferFunds(revenueSource, 'till_float', localCashSales, 'Shift Cash Sales (Local)', 'Revenue');
      }

      // 2. Card Payments -> PENDING
      if (cardPaymentsVal > 0) {
        await transferFunds(revenueSource, 'mozzarella_card_payment', cardPaymentsVal, 'Shift Card Settlement', 'Revenue', { isSettled: false });
      }

      // 3. Hiking Bar -> Partner Receivable
      if (hikingBarSalesVal > 0) {
        const hbtxId = `hbtx_${Date.now()}`;
        await setDoc(doc(db, getFullPath('hiking_bar_txs'), hbtxId), {
          id: hbtxId,
          date: Date.now(),
          amount: hikingBarSalesVal,
          description: `Partner Sales: ${new Date().toLocaleDateString()}`,
          status: 'PENDING'
        });
        await transferFunds(revenueSource, 'hiking_bar_rec', hikingBarSalesVal, 'Partner Receivable Generation', 'Partner Revenue');
      }

      // 4. Credit Bills -> PENDING Customer Receivable
      if (creditBillsVal > 0) {
        const customer = customers.find(c => c.id === closeForm.creditBillCustomerId);
        await transferFunds(
          revenueSource, 
          'customer_receivables', 
          creditBillsVal, 
          `Client Credit: ${customer?.name}`, 
          'Customer Credit',
          { 
            customerId: closeForm.creditBillCustomerId,
            isSettled: false 
          }
        );
      }

      // 5. FX Reserve
      if (foreignCurrencyVal > 0) {
        await transferFunds(
          revenueSource, 
          'foreign_currency_reserve', 
          foreignCurrencyVal, 
          `FX Extraction: ${closeForm.foreignCurrencyNotes}`, 
          'Foreign Exchange',
          { notes: closeForm.foreignCurrencyNotes }
        );
      }

      // 6. Variance
      if (varianceValue !== 0) {
        const desc = varianceValue > 0 ? 'Cash Surplus' : 'Cash Shortage';
        if (varianceValue < 0) {
           await transferFunds('till_float', 'operational_expenses', Math.abs(varianceValue), desc, 'Variance');
        } else {
           await transferFunds(revenueSource, 'till_float', varianceValue, desc, 'Variance');
        }
      }

      // 7. Update Shift
      await updateDoc(doc(db, getFullPath('shifts'), currentShift.id), {
        status: 'CLOSED',
        closedAt: Date.now(),
        closedBy: profile?.displayName || 'Unknown',
        totalSales: totalSalesVal,
        cardPayments: cardPaymentsVal,
        creditBills: creditBillsVal,
        creditBillCustomerId: closeForm.creditBillCustomerId,
        hikingBarSales: hikingBarSalesVal,
        foreignCurrencyAmount: foreignCurrencyVal,
        foreignCurrencyNotes: closeForm.foreignCurrencyNotes,
        expectedCash: expectedCashValue,
        actualCash: actualCashValue,
        variance: varianceValue,
        notes: closeForm.notes
      });

      setCloseForm({
        totalSales: 0,
        cardPayments: 0,
        creditBills: 0,
        creditBillCustomerId: '',
        hikingBarSales: 0,
        foreignCurrencyAmount: 0,
        foreignCurrencyNotes: '',
        actualCash: 0,
        notes: ''
      });
      alert("Reconciliation complete. All funds moved to Lab accounts.");
    } catch (err: any) {
      alert(err.message || "Shift closure failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickExpense = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const amount = Number(formData.get('amount'));
    const description = String(formData.get('description'));
    
    setActionLoading(true);
    try {
        await transferFunds(
            'till_float',
            'operational_expenses',
            amount,
            `Shift Expense: ${description}`,
            'Operations'
        );
        setShowExpenseModal(false);
    } catch (err: any) {
        alert(err.message || "Expense logging failed.");
    } finally {
        setActionLoading(false);
    }
  };

  const updateActualCashFromDenoms = () => {
    const total = Object.entries(denoms).reduce((sum, [val, count]) => sum + (Number(val) * Number(count)), 0);
    setCloseForm(prev => ({ ...prev, actualCash: total }));
    setShowDenomCalc(false);
  };

  if (loading || accountsLoading) return <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-purple-500" size={40} /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-outfit font-bold text-white flex items-center gap-3">
            {currentShift?.status === 'OPEN' ? <Sun className="text-amber-400" /> : <Moon className="text-slate-500" />}
            Shift Flow
          </h1>
          <p className="text-slate-400 text-sm">Physical Register Reconciliation</p>
        </div>
        <div className="text-right glass px-6 py-3 rounded-2xl border border-white/5">
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Live Register Ledger</p>
           <p className="text-2xl font-black text-white leading-none">${(accounts.find(a => a.id === 'till_float')?.balance || 0).toLocaleString()}</p>
        </div>
      </div>

      {currentShift?.status !== 'OPEN' ? (
        <div className="glass rounded-[2.5rem] p-12 text-center space-y-8 border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 gradient-purple" />
          <div className="w-24 h-24 rounded-full gradient-purple mx-auto flex items-center justify-center shadow-xl mb-6">
            <Sun size={48} className="text-white" />
          </div>
          <h2 className="text-3xl font-outfit font-bold text-white">Initialize New Register</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => setShowTopUpModal(true)} disabled={actionLoading} className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all border border-white/10 text-sm">Top Up Float</button>
            <button onClick={handleOpenShift} disabled={actionLoading} className="w-full sm:w-auto px-12 py-4 gradient-purple text-white rounded-2xl font-bold shadow-lg shadow-purple-500/20 active:scale-95 flex items-center gap-2 text-sm">
              {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <Sun size={20} />} Open Register
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="glass rounded-[2rem] p-8 border border-white/10 space-y-8 shadow-xl relative overflow-hidden">
               <div className="absolute top-0 left-0 right-0 h-1 gradient-purple opacity-50" />
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                       <Zap size={10} className="text-purple-400" /> Total Gross Sales
                    </label>
                    <input 
                      type="number" value={closeForm.totalSales || ''}
                      onChange={(e) => setCloseForm({...closeForm, totalSales: Number(e.target.value)})}
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-4 text-white font-bold text-xl outline-none" placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                       <CreditCard size={10} className="text-blue-400" /> Card Port
                    </label>
                    <input 
                      type="number" value={closeForm.cardPayments || ''}
                      onChange={(e) => setCloseForm({...closeForm, cardPayments: Number(e.target.value)})}
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-4 text-white font-bold text-xl outline-none" placeholder="0.00"
                    />
                  </div>
               </div>

               <div className="p-6 bg-slate-900/30 rounded-3xl border border-white/5 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                         <FileText size={10} className="text-rose-400" /> Credit Bills (Amount)
                      </label>
                      <input 
                          type="number" value={closeForm.creditBills || ''}
                          onChange={(e) => setCloseForm({...closeForm, creditBills: Number(e.target.value)})}
                          className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-4 text-white font-bold text-xl outline-none" placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                         <User size={10} className="text-rose-400" /> Assigned Customer
                      </label>
                      <div className="relative">
                        <select 
                            value={closeForm.creditBillCustomerId}
                            onChange={(e) => setCloseForm({...closeForm, creditBillCustomerId: e.target.value})}
                            className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-4 text-sm text-white font-medium outline-none appearance-none cursor-pointer"
                        >
                            <option value="">Choose Customer...</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                          <ChevronRight size={16} className="rotate-90" />
                        </div>
                      </div>
                    </div>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                       <Banknote size={10} className="text-emerald-400" /> Hiking Bar Port
                    </label>
                    <input 
                      type="number" value={closeForm.hikingBarSales || ''}
                      onChange={(e) => setCloseForm({...closeForm, hikingBarSales: Number(e.target.value)})}
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-4 text-white font-bold text-xl outline-none" placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                       <Banknote size={10} className="text-blue-400" /> Foreign Currency Reserve
                    </label>
                    <div className="space-y-2">
                       <input 
                          type="number" value={closeForm.foreignCurrencyAmount || ''}
                          onChange={(e) => setCloseForm({...closeForm, foreignCurrencyAmount: Number(e.target.value)})}
                          className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white font-bold outline-none" placeholder="Total FC Value"
                       />
                       <input 
                         value={closeForm.foreignCurrencyNotes}
                         onChange={(e) => setCloseForm({...closeForm, foreignCurrencyNotes: e.target.value})}
                         className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-2 text-[10px] text-slate-400 outline-none" placeholder="Notes (e.g. 100 USD x 1)"
                       />
                    </div>
                  </div>
               </div>

               <div className="p-6 bg-slate-900 rounded-3xl border border-white/5 space-y-4">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Opening Float</span>
                    <span className="text-sm font-bold">${(currentShift?.openingFloat || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-rose-400">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Register Expenses (Till)</span>
                    <span className="text-sm font-bold">-${totalTillExpenses.toLocaleString()}</span>
                  </div>
                  <div className="h-[1px] bg-white/5" />
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Expected Cash (In Drawer)</span>
                    <span className="text-xl font-bold text-white tracking-tighter">${expectedCashValue.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between group cursor-pointer" onClick={() => setShowDenomCalc(true)}>
                    <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                      Verified Actual <Calculator size={12} className="text-purple-400" />
                    </span>
                    <span className="text-xl font-bold text-purple-400 flex items-center gap-2 tracking-tighter">
                      ${actualCashValue.toLocaleString()} <ChevronRight size={16} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Liquidity Variance</span>
                    <span className={`text-xl font-black ${Number(varianceValue) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {Number(varianceValue) >= 0 ? '+' : ''}{Number(varianceValue).toLocaleString()}
                    </span>
                  </div>
               </div>

               <button 
                  onClick={handleCloseShift} disabled={actionLoading}
                  className="w-full py-5 gradient-purple rounded-[1.5rem] text-white font-black shadow-xl shadow-purple-500/30 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
               >
                  {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Moon size={24} />} Close & Distribute Funds
               </button>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-[2rem] p-8 border border-white/10 shadow-lg bg-gradient-to-br from-white/5 to-transparent">
               <h4 className="text-lg font-outfit font-bold text-white mb-6 flex items-center gap-2"><Zap size={20} className="text-purple-400" /> Money Lab Mappings</h4>
               <div className="space-y-4">
                  {[
                    { port: 'Card', target: 'Mozzarella Card Payment', color: 'text-blue-400' },
                    { port: 'Credit', target: 'Bills Received (Customers)', color: 'text-rose-400' },
                    { port: 'Hiking Bar', target: 'Hiking Bar Receivable', color: 'text-emerald-400' },
                    { port: 'FC Reserve', target: 'Foreign Currency Reserve', color: 'text-amber-400' },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-white/5 text-[10px]">
                      <span className="font-bold uppercase tracking-wider text-slate-400">{m.port} Port</span>
                      <ArrowRight size={12} className="text-slate-700" />
                      <span className={`font-bold uppercase tracking-wider ${m.color}`}>{m.target}</span>
                    </div>
                  ))}
               </div>
               <div className="grid grid-cols-1 gap-4 mt-8">
                  {/* [NEW]: Bank Cash Button */}
                  <button onClick={() => setShowBankCashModal(true)} className="p-5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl flex items-center gap-4 transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shadow-lg"><Landmark size={24} /></div>
                    <div className="text-left">
                      <p className="font-bold text-white text-sm">Bank Cash</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Move Cash to Safe/Bank</p>
                    </div>
                  </button>

                  <button onClick={() => setShowExpenseModal(true)} className="p-5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl flex items-center gap-4 transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center shadow-lg"><TrendingDown size={24} /></div>
                    <div className="text-left">
                      <p className="font-bold text-white text-sm">Drop Register Cash</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Physical Expense Removal</p>
                    </div>
                  </button>
                  <button onClick={() => setShowDenomCalc(true)} className="p-5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl flex items-center gap-4 transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center shadow-lg"><Calculator size={24} /></div>
                    <div className="text-left">
                      <p className="font-bold text-white text-sm">Note Counter</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Count Physical Drawer</p>
                    </div>
                  </button>
                  <button onClick={() => setShowTopUpModal(true)} className="p-5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl flex items-center gap-4 transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shadow-lg"><ArrowUpCircle size={24} /></div>
                    <div className="text-left">
                      <p className="font-bold text-white text-sm">Top Up Register</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Inject Funds into Drawer</p>
                    </div>
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {showDenomCalc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowDenomCalc(false)} />
          <div className="glass w-full max-w-lg rounded-[2.5rem] p-8 relative animate-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl font-outfit font-bold text-white">Denomination Matrix</h2>
               <button onClick={() => setShowDenomCalc(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
             </div>
             <div className="space-y-2 max-h-[50vh] overflow-y-auto scrollbar-hide pr-2">
                {CURRENCY_DENOMINATIONS.map(d => (
                  <div key={d.value} className="flex items-center justify-between p-4 bg-slate-900 rounded-2xl border border-white/5">
                    <span className="font-black text-slate-400 w-12 tracking-tighter">{d.label}</span>
                    <input 
                        type="number" min="0" value={denoms[d.value] || ''}
                        onChange={(e) => setDenoms({...denoms, [d.value]: Number(e.target.value)})}
                        className="w-20 bg-black border border-white/5 rounded-xl px-2 py-2 text-center text-white font-bold"
                    />
                    <span className="w-24 text-right font-black text-white text-sm">${((denoms[d.value] || 0) * d.value).toLocaleString()}</span>
                  </div>
                ))}
             </div>
             <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                <p className="text-3xl font-black text-white">${Object.entries(denoms).reduce((sum, [val, count]) => sum + (Number(val) * Number(count)), 0).toLocaleString()}</p>
                <button onClick={updateActualCashFromDenoms} className="px-8 py-4 gradient-purple rounded-2xl text-white font-bold">Confirm Total</button>
             </div>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowExpenseModal(false)} />
          <div className="glass w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl font-outfit font-bold text-white">Register Cash Drop</h2>
               <button onClick={() => setShowExpenseModal(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
             </div>
             <form onSubmit={handleQuickExpense} className="space-y-6">
                <input name="amount" required type="number" step="0.01" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-5 text-3xl font-black text-white" placeholder="0.00" />
                <input name="description" required className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-4 text-white text-sm font-medium" placeholder="Reason for removal..." />
                <button disabled={actionLoading} className="w-full py-5 gradient-rose rounded-2xl text-white font-black">
                   {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <TrendingDown size={20} />} Execute Drop
                </button>
             </form>
          </div>
        </div>
      )}

      {showTopUpModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowTopUpModal(false)} />
          <div className="glass w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
             <div className="absolute top-0 left-0 right-0 h-1 gradient-purple" />
             <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ArrowUpCircle size={24} />
                  </div>
                  <h2 className="text-2xl font-outfit font-bold text-white">Top Up Float</h2>
               </div>
               <button onClick={() => setShowTopUpModal(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
             </div>
             
             <form onSubmit={handleTopUpSubmit} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Injection Source</label>
                   <select 
                      name="sourceId" required 
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-4 text-white outline-none appearance-none cursor-pointer"
                   >
                      {accounts.filter(a => a.id !== 'till_float' && a.type !== 'EXPENSE' && a.type !== 'REVENUE').map(acc => (
                         <option key={acc.id} value={acc.id}>
                            {acc.name} (${acc.balance.toLocaleString()})
                         </option>
                      ))}
                   </select>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Amount to Add</label>
                   <input 
                      name="amount" required type="number" step="0.01" 
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-5 text-4xl font-black text-white" 
                      placeholder="0.00" 
                   />
                </div>

                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                   <p className="text-[10px] text-emerald-400 leading-relaxed font-medium">
                     The selected amount will be transferred from the source account into the physical register (Till Float).
                   </p>
                </div>

                <button disabled={actionLoading} className="w-full py-5 gradient-purple rounded-2xl text-white font-black shadow-xl shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                   {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <ArrowUpCircle size={24} />} Confirm Injection
                </button>
             </form>
          </div>
        </div>
      )}

      {/* [NEW]: Bank Cash Modal */}
      {showBankCashModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowBankCashModal(false)} />
          <div className="glass w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
             <div className="absolute top-0 left-0 right-0 h-1 gradient-blue" /> {/* Blue theme for Banking */}
             <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Landmark size={24} />
                  </div>
                  <h2 className="text-2xl font-outfit font-bold text-white">Bank Cash</h2>
               </div>
               <button onClick={() => setShowBankCashModal(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
             </div>
             
             <form onSubmit={handleBankCashSubmit} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Destination</label>
                   <select 
                      name="targetId" required 
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-4 text-white outline-none appearance-none cursor-pointer"
                   >
                      <option value="business_bank">Business Bank</option>
                      {/* You can add other accounts here if needed, e.g. Staff Card */}
                      {accounts.find(a => a.id === 'staff_card') && <option value="staff_card">Staff Card</option>}
                   </select>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Amount to Bank</label>
                   <input 
                      name="amount" required type="number" step="0.01" 
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-5 text-4xl font-black text-white" 
                      placeholder="0.00" 
                   />
                </div>

                <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                   <p className="text-[10px] text-indigo-400 leading-relaxed font-medium">
                     Money will be moved from the Register (Till) to the selected account. This will decrease your Expected Cash in Drawer.
                   </p>
                </div>

                <button disabled={actionLoading} className="w-full py-5 gradient-blue rounded-2xl text-white font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                   {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <ArrowRight size={24} />} Confirm Transfer
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};