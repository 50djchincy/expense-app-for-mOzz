
import React, { useState, useEffect } from 'react';
import { useAccounts } from '../AccountsContext';
import { useAuth } from '../AuthContext';
import { db, getFullPath } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  orderBy,
  writeBatch,
  increment,
  deleteDoc
} from 'firebase/firestore';
import { 
  Mountain, 
  Handshake, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Loader2, 
  Plus, 
  Calendar, 
  Dices,
  Info,
  ChevronRight,
  Calculator,
  Wallet,
  SmartphoneNfc,
  Zap,
  CupSoda
} from 'lucide-react';
import { HikingBarTransaction } from '../types';

export const HikingBar: React.FC = () => {
  const { profile } = useAuth();
  const { accounts, transferFunds, loading: accountsLoading } = useAccounts();
  const [transactions, setTransactions] = useState<HikingBarTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Settlement Modal State
  const [settleTx, setSettleTx] = useState<HikingBarTransaction | null>(null);
  const [settlement, setSettlement] = useState({
    cash: 0,
    card: 0,
    serviceCharge: 0,
    contra: 0
  });

  const receivableAccount = accounts.find(a => a.id === 'hiking_bar_rec');
  const debtOwed = receivableAccount?.balance || 0;

  useEffect(() => {
    // Note: Sorting handled client-side in the snapshot listener to avoid composite index requirement
    const q = query(
      collection(db, getFullPath('hiking_bar_txs')),
      where('status', '==', 'PENDING')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id } as HikingBarTransaction));
      // Client-side sort
      data.sort((a, b) => b.date - a.date);
      setTransactions(data);
      setLoading(false);
    }, (err) => {
      console.error("Hiking Bar Sync Error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Pre-calculate allocated total and difference for the settlement modal to avoid RHS arithmetic errors
  const totalAllocated = settlement.cash + settlement.card + settlement.serviceCharge + settlement.contra;
  const settleAmountVal = settleTx?.amount || 0;
  const settlementDiff = settleAmountVal - totalAllocated;

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTx) return;

    // Use pre-calculated allocated total for validation
    if (Math.abs(totalAllocated - settleTx.amount) > 0.01) {
      alert(`The total settlement ($${totalAllocated.toFixed(2)}) must exactly match the transaction amount ($${settleTx.amount.toFixed(2)}).`);
      return;
    }

    setActionLoading(true);
    try {
      // 1. Reconcile in Money Lab
      if (settlement.cash > 0) {
        await transferFunds('hiking_bar_rec', 'till_float', settlement.cash, `Hiking Bar Cash Settlement: ${settleTx.description}`, 'Partner Settlement');
      }

      if (settlement.card > 0) {
        await transferFunds('hiking_bar_rec', 'hiking_bar_card_payment', settlement.card, `Hiking Bar Card Settlement: ${settleTx.description}`, 'Partner Settlement', { isSettled: false });
      }

      if (settlement.serviceCharge > 0) {
        await transferFunds('hiking_bar_rec', 'service_fee_income', settlement.serviceCharge, `Hiking Bar Service Fee: ${settleTx.description}`, 'Partner Fee');
      }

      if (settlement.contra > 0) {
        await transferFunds('hiking_bar_rec', 'operational_expenses', settlement.contra, `Hiking Bar Contra/Drinks: ${settleTx.description}`, 'Contra Settlement');
      }

      // 2. Mark Transaction as Reconciled
      await updateDoc(doc(db, getFullPath('hiking_bar_txs'), settleTx.id), {
        status: 'RECONCILED',
        reconciledAt: Date.now(),
        reconciledBy: profile?.displayName || 'Unknown',
        settlementData: { ...settlement }
      });

      setSettleTx(null);
      setSettlement({ cash: 0, card: 0, serviceCharge: 0, contra: 0 });
      alert("Transaction successfully reconciled!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const addMockTransaction = async () => {
    setActionLoading(true);
    try {
      const amount = Number(prompt("Enter Mock Transaction Amount:", "100"));
      if (!amount) return;

      const txData = {
        date: Date.now(),
        amount: amount,
        description: `Hiking Bar Sales - ${new Date().toLocaleDateString()}`,
        status: 'PENDING'
      };

      await addDoc(collection(db, getFullPath('hiking_bar_txs')), txData);
      await transferFunds('service_fee_income', 'hiking_bar_rec', amount, `Generated Mock Receivable: ${txData.description}`, 'Receivable Generation');
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || accountsLoading) return <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-purple-400" size={40} /></div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Mountain className="text-blue-400" />
            Hiking Bar Partner
          </h1>
          <p className="text-slate-400">Reconcile debt settlements and contra deductions.</p>
        </div>
        <button 
          onClick={addMockTransaction}
          disabled={actionLoading}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-300 font-bold border border-white/5 active:scale-95 transition-all"
        >
          <Plus size={18} />
          Create Mock Entry
        </button>
      </div>

      {/* Debt Summary */}
      <div className="glass rounded-[2.5rem] p-8 md:p-12 border border-white/10 shadow-2xl relative overflow-hidden bg-gradient-to-br from-blue-500/10 to-transparent">
        <div className="absolute top-0 right-0 p-12 opacity-5">
           <Handshake size={200} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hiking Bar Debt Balance</p>
              <p className="text-6xl font-black text-white tracking-tighter">
                ${debtOwed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-2 pt-2">
                 <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20 uppercase">Awaiting Settlement</span>
                 <span className="text-[10px] text-slate-500 italic">• Updated {new Date().toLocaleTimeString()}</span>
              </div>
           </div>
           <div className="hidden md:flex gap-4">
              <div className="p-6 bg-white/5 rounded-3xl border border-white/5 text-center min-w-[120px]">
                 <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Pending Txs</p>
                 <p className="text-2xl font-bold text-white">{transactions.length}</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Reconciliation List */}
        <div className="lg:col-span-3 space-y-6">
           <div className="flex items-center justify-between px-2">
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
               <ArrowRightLeft className="text-purple-400" size={20} />
               Reconciliation Queue
             </h2>
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{transactions.length} Unsettled Entries</span>
           </div>

           <div className="space-y-4">
             {transactions.map(tx => (
               <div key={tx.id} className="glass rounded-[2rem] p-6 border border-white/10 hover:border-blue-500/30 transition-all group flex items-center justify-between">
                  <div className="flex items-center gap-5">
                     <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center border border-white/5">
                        <Calendar size={20} className="text-slate-500" />
                     </div>
                     <div>
                        <p className="text-sm font-bold text-white">{tx.description}</p>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">{new Date(tx.date).toLocaleDateString()}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-8">
                     <div className="text-right">
                        <p className="text-xl font-black text-white">${tx.amount.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500 uppercase mt-0.5">Amount Owed</p>
                     </div>
                     <button 
                        onClick={() => setSettleTx(tx)}
                        className="p-3 bg-blue-500 hover:bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                     >
                        <ChevronRight size={20} />
                     </button>
                  </div>
               </div>
             ))}
             {transactions.length === 0 && (
               <div className="p-12 text-center glass rounded-[2rem] border border-white/10 border-dashed">
                  <Dices className="text-slate-600 mx-auto mb-4" size={40} />
                  <p className="text-slate-500 italic">No pending Hiking Bar transactions to reconcile.</p>
               </div>
             )}
           </div>
        </div>

        {/* Info Column */}
        <div className="lg:col-span-2 space-y-6">
           <div className="glass rounded-[2rem] p-8 border border-white/10 shadow-lg bg-gradient-to-br from-white/5 to-transparent space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                 <Info size={20} className="text-blue-400" /> Reconciliation Rules
              </h3>
              <ul className="space-y-4">
                 {[
                   { icon: Wallet, label: "Cash Received", text: "Moves funds from partner debt into our Till Float." },
                   { icon: SmartphoneNfc, label: "Card Payments", text: "Tracks sales settled through card machines." },
                   { icon: Zap, label: "Service Charge", text: "Fee deducted from the total as Mozzarella revenue." },
                   { icon: CupSoda, label: "Contra / Drinks", text: "Reduces debt by accounting for staff consumables." }
                 ].map((rule, i) => (
                   <li key={i} className="flex gap-4">
                      <div className="p-2 bg-slate-800 rounded-lg text-slate-400 shrink-0">
                         <rule.icon size={16} />
                      </div>
                      <div>
                         <p className="text-xs font-bold text-slate-200">{rule.label}</p>
                         <p className="text-[10px] text-slate-500 mt-0.5">{rule.text}</p>
                      </div>
                   </li>
                 ))}
              </ul>
           </div>

           <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] flex items-start gap-4">
              <AlertCircle size={24} className="text-emerald-400 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Financial Integrity</p>
                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                  Settling transactions atomically updates the partner receivable and distributes the capital to the respective asset/income accounts.
                </p>
              </div>
           </div>
        </div>
      </div>

      {/* Settlement Modal */}
      {settleTx && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !actionLoading && setSettleTx(null)} />
           <div className="glass w-full max-w-xl rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                       <Calculator size={28} />
                    </div>
                    <div>
                       <h2 className="text-2xl font-bold text-white">Settle Transaction</h2>
                       <p className="text-slate-400 text-sm">{settleTx.description}</p>
                    </div>
                 </div>
                 <button onClick={() => setSettleTx(null)} className="text-slate-500 hover:text-white disabled:opacity-50" disabled={actionLoading}>
                    <X size={24} />
                 </button>
              </div>

              <div className="mb-8 p-6 bg-blue-500/10 rounded-3xl border border-blue-500/20 flex items-center justify-between">
                 <p className="text-sm font-bold text-blue-300">Total to Reconcile</p>
                 <p className="text-3xl font-black text-white">${settleAmountVal.toFixed(2)}</p>
              </div>

              <form onSubmit={handleSettle} className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                          <Wallet size={10} /> Cash Received
                       </label>
                       <input 
                          type="number" step="0.01" value={settlement.cash || ''} 
                          onChange={(e) => setSettlement({...settlement, cash: Number(e.target.value)})}
                          className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                          placeholder="0.00"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                          <SmartphoneNfc size={10} /> Card Payment
                       </label>
                       <input 
                          type="number" step="0.01" value={settlement.card || ''} 
                          onChange={(e) => setSettlement({...settlement, card: Number(e.target.value)})}
                          className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                          placeholder="0.00"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-rose-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                          <Zap size={10} /> Service Charge
                       </label>
                       <input 
                          type="number" step="0.01" value={settlement.serviceCharge || ''} 
                          onChange={(e) => setSettlement({...settlement, serviceCharge: Number(e.target.value)})}
                          className="w-full bg-slate-900 border border-rose-500/20 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-rose-500/50 outline-none"
                          placeholder="0.00"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-purple-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                          <CupSoda size={10} /> Contra / Drinks
                       </label>
                       <input 
                          type="number" step="0.01" value={settlement.contra || ''} 
                          onChange={(e) => setSettlement({...settlement, contra: Number(e.target.value)})}
                          className="w-full bg-slate-900 border border-purple-500/20 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
                          placeholder="0.00"
                       />
                    </div>
                 </div>

                 <div className="p-6 bg-slate-900 rounded-3xl border border-white/5 flex items-center justify-between">
                    <div>
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Allocated</p>
                       <p className={`text-2xl font-bold ${
                          Math.abs(totalAllocated - settleAmountVal) < 0.01 
                          ? 'text-emerald-400' : 'text-rose-400'
                       }`}>
                          ${totalAllocated.toFixed(2)}
                       </p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Difference</p>
                       <p className="text-sm font-mono text-white">
                          ${settlementDiff.toFixed(2)}
                       </p>
                    </div>
                 </div>

                 <button 
                    disabled={actionLoading}
                    type="submit"
                    className="w-full py-5 gradient-purple rounded-[1.5rem] text-white font-bold shadow-xl shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                 >
                    {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
                    Complete Reconciliation
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};
