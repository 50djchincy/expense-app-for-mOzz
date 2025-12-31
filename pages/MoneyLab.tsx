import React, { useState, useEffect, useMemo } from 'react';
import { useAccounts } from '../AccountsContext';
import { db, getFullPath } from '../firebase';
import { collection, query, limit, onSnapshot, orderBy, writeBatch, doc } from 'firebase/firestore';
import { 
  FlaskConical, 
  Wallet, 
  Building, 
  CreditCard, 
  Handshake, 
  SmartphoneNfc, 
  FileText,
  TrendingDown,
  ArrowRightLeft,
  Info,
  Loader2,
  X,
  Zap,
  Activity,
  CheckSquare,
  Square,
  GanttChartSquare,
  RefreshCw,
  User,
  History,
  Copy,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Search
} from 'lucide-react';
import { Shift, Transaction, Customer, Account } from '../types';

const ICON_MAP: Record<string, any> = {
  Wallet,
  Building,
  CreditCard,
  Handshake,
  SmartphoneNfc,
  FileText,
  TrendingDown,
  Zap
};

export const MoneyLab: React.FC = () => {
  const { accounts, transactions, transferFunds, updateEntity, loading, isSandbox } = useAccounts();
  
  // Modals State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReconModal, setShowReconModal] = useState(false);
  const [showClientDebtModal, setShowClientDebtModal] = useState(false);
  
  // Account Detail View State
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const [transferLoading, setTransferLoading] = useState(false);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Card Reconciliation State
  const [reconAccount, setReconAccount] = useState<'mozzarella_card_payment' | 'hiking_bar_card_payment'>('mozzarella_card_payment');
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [netBankReceived, setNetBankReceived] = useState<string>('');

  // Client Debt State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedDebtTxIds, setSelectedDebtTxIds] = useState<Set<string>>(new Set());
  const [debtSettleSource, setDebtSettleSource] = useState<string>('business_bank');

  useEffect(() => {
    const q = query(
      collection(db, getFullPath('shifts')),
      orderBy('openedAt', 'desc'),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setCurrentShift({ ...snap.docs[0].data(), id: snap.docs[0].id } as Shift);
      }
    });

    const unsubCust = onSnapshot(collection(db, getFullPath('customers')), (snap) => {
      setCustomers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer)));
    });

    return () => { unsub(); unsubCust(); };
  }, []);

  // Filter pending transactions for card recon
  const pendingTxs = useMemo(() => {
    return transactions.filter(tx => 
      tx.toAccountId === reconAccount && 
      tx.isSettled === false
    );
  }, [transactions, reconAccount]);

  // Filter pending debt transactions
  const pendingDebtTxs = useMemo(() => {
    return transactions.filter(tx => 
      tx.toAccountId === 'customer_receivables' && 
      tx.isSettled === false
    );
  }, [transactions]);

  // Group debt by customer for the selector
  const debtByCustomer = useMemo(() => {
    const map: Record<string, { count: number, total: number }> = {};
    pendingDebtTxs.forEach(tx => {
      if (tx.customerId) {
        if (!map[tx.customerId]) map[tx.customerId] = { count: 0, total: 0 };
        map[tx.customerId].count++;
        map[tx.customerId].total += tx.amount;
      }
    });
    return map;
  }, [pendingDebtTxs]);

  const selectedTotal = useMemo(() => {
    return Array.from(selectedTxIds).reduce((sum, id) => {
      const tx = pendingTxs.find(t => t.id === id);
      return sum + (tx?.amount || 0);
    }, 0);
  }, [selectedTxIds, pendingTxs]);

  const selectedDebtTotal = useMemo(() => {
    return Array.from(selectedDebtTxIds).reduce((sum, id) => {
      const tx = pendingDebtTxs.find(t => t.id === id);
      return sum + (tx?.amount || 0);
    }, 0);
  }, [selectedDebtTxIds, pendingDebtTxs]);

  const netReceivedVal = parseFloat(netBankReceived) || 0;
  const bankFees = Math.max(0, selectedTotal - netReceivedVal);
  const feePercentage = selectedTotal > 0 ? (bankFees / selectedTotal) * 100 : 0;

  const handleInternalTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const fromId = formData.get('from') as string;
    const toId = formData.get('to') as string;
    const amount = Number(formData.get('amount'));
    const description = formData.get('description') as string;

    if (fromId === toId) {
      alert("Source and destination accounts must be different.");
      return;
    }

    setTransferLoading(true);
    try {
      await transferFunds(fromId, toId, amount, description, 'Internal Transfer');
      setShowTransferModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleFinalizeReconciliation = async () => {
    if (selectedTxIds.size === 0) return;
    if (netReceivedVal <= 0) {
      alert("Please enter the net amount received in the bank.");
      return;
    }

    setTransferLoading(true);
    try {
      // 1. New Settlement Transaction: Account -> Bank
      await transferFunds(
        reconAccount,
        'business_bank',
        netReceivedVal,
        `Bank Settlement: ${reconAccount === 'mozzarella_card_payment' ? 'Mozzarella' : 'Hiking Bar'} Batch`,
        'Settlement',
        { isSettled: true }
      );

      // 2. Log Fees as Expense
      if (bankFees > 0) {
        await transferFunds(
          reconAccount,
          'operational_expenses',
          bankFees,
          `Card Fees: ${feePercentage.toFixed(2)}%`,
          'Bank Charges',
          { isSettled: true }
        );
      }

      // 3. Mark historical transactions as finalized
      if (isSandbox) {
        for (const id of Array.from(selectedTxIds)) {
          await updateEntity('transactions', id, { isSettled: true });
        }
      } else {
        const batch = writeBatch(db);
        selectedTxIds.forEach(id => {
          batch.update(doc(db, getFullPath('transactions'), id), { isSettled: true });
        });
        await batch.commit();
      }

      // 4. Final state reset and CLOSE window
      setSelectedTxIds(new Set());
      setNetBankReceived('');
      setShowReconModal(false);
      alert("Card batch finalized and funds moved to bank.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleFinalizeDebtSettlement = async () => {
    if (selectedDebtTxIds.size === 0) return;
    setTransferLoading(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      
      // 1. Move funds from Debt Receivable -> Chosen Asset
      await transferFunds(
        'customer_receivables',
        debtSettleSource,
        selectedDebtTotal,
        `Client Debt Collection: ${customer?.name}`,
        'Client Settlement',
        { 
          customerId: selectedCustomerId,
          isSettled: true 
        }
      );

      // 2. Mark old debts as settled
      if (isSandbox) {
        for (const id of Array.from(selectedDebtTxIds)) {
          await updateEntity('transactions', id, { isSettled: true });
        }
      } else {
        const batch = writeBatch(db);
        selectedDebtTxIds.forEach(id => {
          batch.update(doc(db, getFullPath('transactions'), id), { isSettled: true });
        });
        await batch.commit();
      }

      // 3. Final state reset and CLOSE window
      setSelectedDebtTxIds(new Set());
      setSelectedCustomerId(null);
      setShowClientDebtModal(false);
      alert("Customer credit finalized. Cash moved to asset account.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const generateStatementText = () => {
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return;
    const txs = pendingDebtTxs.filter(tx => tx.customerId === selectedCustomerId);
    
    let text = `📋 MOZZARELLA BILLING STATEMENT\n`;
    text += `Client: ${customer.name}\n`;
    text += `Date: ${new Date().toLocaleDateString()}\n`;
    text += `-------------------------------\n`;
    txs.forEach(tx => {
      text += `• ${new Date(tx.date).toLocaleDateString()}: $${tx.amount.toLocaleString()} (${tx.description})\n`;
    });
    text += `-------------------------------\n`;
    text += `TOTAL OUTSTANDING: $${debtByCustomer[selectedCustomerId!]?.total.toLocaleString()}\n\n`;
    text += `Please settle via transfer or cash. Thank you!`;

    navigator.clipboard.writeText(text);
    alert("Statement copied to clipboard!");
  };

  const toggleTxSelection = (id: string) => {
    const next = new Set(selectedTxIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTxIds(next);
  };

  const toggleDebtSelection = (id: string) => {
    const next = new Set(selectedDebtTxIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDebtTxIds(next);
  };

  // Stats
  const totalAssets = accounts
    .filter(a => a.type === 'ASSET' || a.type === 'RECEIVABLE')
    .reduce((sum, a) => sum + a.balance, 0);
  
  const totalLiabilities = accounts
    .filter(a => a.type === 'LIABILITY')
    .reduce((sum, a) => sum + a.balance, 0);

  const netLiquidity = totalAssets - totalLiabilities;

  if (loading) return <div className="flex flex-col items-center justify-center py-20 gap-4"><Loader2 className="animate-spin text-purple-500" size={40} /><p className="text-slate-500">Opening the vault...</p></div>;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FlaskConical className="text-purple-400" />
            Money Lab
          </h1>
          <p className="text-slate-400 mt-1">Manage core liquidity and internal fund movements.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowClientDebtModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-2xl font-bold border border-emerald-500/10 active:scale-95 transition-all shadow-neumorphic"
          >
            <User size={20} />
            Client Debt
          </button>
          <button 
            onClick={() => setShowReconModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-2xl font-bold border border-blue-500/10 active:scale-95 transition-all shadow-neumorphic"
          >
            <GanttChartSquare size={20} />
            Card Recon
          </button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="glass rounded-[2.5rem] p-8 md:p-12 border border-white/10 shadow-2xl relative overflow-hidden bg-gradient-to-br from-purple-500/5 to-transparent">
        <div className="absolute top-0 right-0 p-12 opacity-5">
          <FlaskConical size={200} />
        </div>
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Net Liquidity</p>
            <p className="text-5xl font-black text-white tracking-tighter">${netLiquidity.toLocaleString()}</p>
            <div className="flex items-center gap-2 pt-2">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 uppercase tracking-wider">Live Treasury</span>
            </div>
          </div>
          <div className="space-y-1 md:border-l md:border-white/5 md:pl-12">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Available Assets</p>
            <p className="text-3xl font-bold text-emerald-400">${totalAssets.toLocaleString()}</p>
          </div>
          <div className="space-y-1 md:border-l md:border-white/5 md:pl-12">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Payables</p>
            <p className="text-3xl font-bold text-rose-400">${totalLiabilities.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Account Categories */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 px-2">
            <TrendingDown className="text-emerald-400 rotate-180" size={20} />
            Assets & Receivables
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {accounts.filter(a => a.type === 'ASSET' || a.type === 'RECEIVABLE').map(acc => (
              <AccountCard 
                key={acc.id} 
                account={acc} 
                onClick={() => setSelectedAccount(acc)}
                isShiftOpen={acc.id === 'till_float' && currentShift?.status === 'OPEN'} 
              />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 px-2">
            <TrendingDown className="text-rose-400" size={20} />
            Payables & Reserves
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {accounts.filter(a => a.type === 'LIABILITY' || a.type === 'EXPENSE').map(acc => (
              <AccountCard 
                key={acc.id} 
                account={acc} 
                onClick={() => setSelectedAccount(acc)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Account Details / Ledger Modal */}
      {selectedAccount && (
        <AccountLedgerModal 
          account={selectedAccount} 
          transactions={transactions} 
          onClose={() => setSelectedAccount(null)} 
        />
      )}

      {/* Card Recon Modal */}
      {showReconModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowReconModal(false)} />
          <div className="glass w-full max-w-4xl rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <GanttChartSquare size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Card Reconciliation</h2>
                  <p className="text-slate-400 text-sm">Finalize pending card batches</p>
                </div>
              </div>
              <button onClick={() => setShowReconModal(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
               <div className="lg:col-span-2 flex flex-col overflow-hidden">
                  <div className="flex gap-2 mb-4">
                     {['mozzarella_card_payment', 'hiking_bar_card_payment'].map(acc => (
                       <button 
                         key={acc}
                         onClick={() => { setReconAccount(acc as any); setSelectedTxIds(new Set()); }}
                         className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${reconAccount === acc ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-slate-500 border-white/5'}`}
                       >
                         {acc.replace('_', ' ')}
                       </button>
                     ))}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                     {pendingTxs.map(tx => (
                       <div key={tx.id} onClick={() => toggleTxSelection(tx.id)} className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${selectedTxIds.has(tx.id) ? 'bg-blue-500/10 border-blue-500/40' : 'bg-slate-900 border-white/5 hover:border-white/10'}`}>
                         <div className="flex items-center gap-4">
                            {selectedTxIds.has(tx.id) ? <CheckSquare className="text-blue-400" size={18} /> : <Square className="text-slate-700" size={18} />}
                            <div><p className="text-xs font-bold text-white">{tx.description}</p><p className="text-[10px] text-slate-500 mt-0.5">{new Date(tx.date).toLocaleDateString()}</p></div>
                         </div>
                         <p className="text-sm font-black text-white">${tx.amount.toLocaleString()}</p>
                       </div>
                     ))}
                  </div>
               </div>
               <div className="space-y-6">
                  <div className="p-6 bg-slate-900 rounded-3xl border border-white/5 space-y-4 shadow-xl">
                     <div className="flex justify-between text-slate-400 text-[10px] font-bold uppercase"><span>Gross Selected</span><span className="text-white">${selectedTotal.toLocaleString()}</span></div>
                     <input type="number" step="0.01" value={netBankReceived} onChange={(e) => setNetBankReceived(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black text-white focus:ring-2 focus:ring-blue-500/50 outline-none" placeholder="Net Bank Received" />
                     <div className="pt-2 flex justify-between text-[10px] font-bold text-rose-400 uppercase"><span>Fees Applied</span><span>-${bankFees.toFixed(2)} ({feePercentage.toFixed(2)}%)</span></div>
                  </div>
                  <button disabled={transferLoading || selectedTxIds.size === 0} onClick={handleFinalizeReconciliation} className="w-full py-5 gradient-blue rounded-2xl text-white font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                    {transferLoading ? <Loader2 className="animate-spin" size={24} /> : <Zap size={24} />} Finalize Settlement
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Client Debt Portal Modal */}
      {showClientDebtModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowClientDebtModal(false)} />
          <div className="glass w-full max-w-4xl rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
             <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400"><User size={24} /></div>
                 <div><h2 className="text-2xl font-bold text-white">Client Credit Portal</h2><p className="text-slate-400 text-sm">Collect outstanding shift bills</p></div>
               </div>
               <button onClick={() => setShowClientDebtModal(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
                <div className="lg:col-span-1 flex flex-col overflow-hidden">
                   <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 ml-1">Choose Debtor</h3>
                   <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                      {customers.filter(c => debtByCustomer[c.id]).map(c => (
                        <button key={c.id} onClick={() => { setSelectedCustomerId(c.id); setSelectedDebtTxIds(new Set()); }} className={`w-full p-4 rounded-2xl border text-left transition-all ${selectedCustomerId === c.id ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-900 border-white/5 hover:border-white/10'}`}>
                           <p className="text-sm font-bold text-white">{c.name}</p>
                           <div className="flex justify-between mt-1 text-[10px]"><span className="text-slate-500">{debtByCustomer[c.id].count} Bills</span><span className="text-emerald-400 font-black">${debtByCustomer[c.id].total.toLocaleString()}</span></div>
                        </button>
                      ))}
                   </div>
                </div>
                <div className="lg:col-span-2 flex flex-col overflow-hidden">
                   {selectedCustomerId ? (
                     <div className="flex flex-col h-full animate-in fade-in">
                        <div className="flex justify-between mb-4"><h3 className="text-[10px] font-bold text-slate-500 uppercase ml-1">Select Bills to Finalize</h3><button onClick={generateStatementText} className="flex gap-2 px-3 py-1.5 bg-white/5 rounded-xl text-[10px] font-bold text-slate-300 hover:bg-white/10 border border-white/5"><Copy size={12} /> Share Statement</button></div>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide mb-6">
                           {pendingDebtTxs.filter(tx => tx.customerId === selectedCustomerId).map(tx => (
                             <div key={tx.id} onClick={() => toggleDebtSelection(tx.id)} className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${selectedDebtTxIds.has(tx.id) ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-900 border-white/5 hover:border-white/10'}`}>
                                <div className="flex items-center gap-4">{selectedDebtTxIds.has(tx.id) ? <CheckSquare className="text-emerald-400" size={18} /> : <Square className="text-slate-700" size={18} />}<div><p className="text-xs font-bold text-white">{new Date(tx.date).toLocaleDateString()}</p><p className="text-[10px] text-slate-500 mt-0.5">{tx.description}</p></div></div>
                                <p className="text-sm font-black text-white">${tx.amount.toLocaleString()}</p>
                             </div>
                           ))}
                        </div>
                        <div className="p-6 bg-slate-900 rounded-3xl border border-white/5 space-y-6">
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Deposit To</label><select value={debtSettleSource} onChange={(e) => setDebtSettleSource(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none"><option value="business_bank">Business Bank</option><option value="till_float">Till Cash</option></select></div>
                              <div className="text-right"><p className="text-[10px] font-bold text-slate-500 uppercase">Selected Total</p><p className="text-3xl font-black text-white">${selectedDebtTotal.toLocaleString()}</p></div>
                           </div>
                           <button disabled={transferLoading || selectedDebtTxIds.size === 0} onClick={handleFinalizeDebtSettlement} className="w-full py-5 gradient-purple rounded-2xl text-white font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">{transferLoading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />} Execute Collection</button>
                        </div>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center justify-center h-full opacity-30 text-slate-500"><History size={48} className="mb-4" /><p className="text-sm font-bold uppercase">Select a debtor to begin collection</p></div>
                   )}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Internal Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowTransferModal(false)} />
          <div className="glass w-full max-w-lg rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400"><ArrowRightLeft size={24} /></div><div><h2 className="text-2xl font-bold text-white">Internal Transfer</h2><p className="text-slate-400 text-sm">Move funds between lab accounts</p></div></div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleInternalTransfer} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Source</label><select name="from" required className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none">{accounts.map(a => <option key={a.id} value={a.id}>{a.name} (${a.balance})</option>)}</select></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Dest</label><select name="to" required className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none">{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              </div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Amount</label><input name="amount" type="number" step="0.01" required placeholder="0.00" className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-4 text-2xl font-bold text-white outline-none" /></div>
              <div className="space-y-2"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Reason</label><input name="description" required placeholder="Description..." className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none" /></div>
              <button type="submit" disabled={transferLoading} className="w-full py-5 gradient-purple rounded-2xl text-white font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">{transferLoading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRightLeft size={20} />} Execute Transfer</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// Sub-Component: Account Card (Clickable)
// ------------------------------------------------------------------

const AccountCard = ({ account, isShiftOpen, onClick }: { account: Account, isShiftOpen?: boolean, onClick?: () => void }) => {
  const Icon = ICON_MAP[account.icon] || FlaskConical;
  const isPendingAccount = account.id.includes('card_payment') || account.id === 'customer_receivables';
  
  return (
    <button 
      onClick={onClick}
      className={`w-full text-left glass rounded-[2rem] p-6 border transition-all group flex items-center justify-between shadow-lg relative overflow-hidden ${
      isShiftOpen ? 'border-amber-500/30 bg-amber-500/5' : 
      isPendingAccount ? 'border-dashed border-white/20 bg-white/5' : 'border-white/10'
    } hover:border-white/20 hover:bg-white/5 hover:scale-[1.01] active:scale-[0.99]`}
    >
      <div className="flex items-center gap-5 relative z-10">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-110 ${
          isShiftOpen ? 'bg-amber-500 text-white' : 'bg-slate-800 border-white/5'
        }`}>
          <Icon className={`${isShiftOpen ? 'text-white' : 'text-slate-400 group-hover:text-purple-400'}`} size={24} />
        </div>
        <div>
          <h3 className="font-bold text-white text-lg group-hover:text-purple-300 transition-colors">{account.name}</h3>
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-1 ${
            account.type === 'LIABILITY' ? 'text-rose-500' : 
            account.type === 'RECEIVABLE' ? 'text-blue-500' : 
            isPendingAccount ? 'text-slate-400 animate-pulse' : 'text-slate-600'
          }`}>
            {account.type} {isShiftOpen && "• ACTIVE SHIFT"} {isPendingAccount && "• PENDING AUDIT"}
          </p>
        </div>
      </div>
      <div className="text-right relative z-10">
        <p className="text-2xl font-black text-white tracking-tighter">${account.balance.toLocaleString()}</p>
        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 mt-1">
          {isShiftOpen ? <Activity size={10} className="text-amber-500" /> : isPendingAccount ? <RefreshCw size={10} className="text-blue-400" /> : <Info size={10} />}
          <span>{isShiftOpen ? 'Shift Unreconciled' : isPendingAccount ? 'Unsettled Ledger' : 'Ledger Verified'}</span>
        </div>
      </div>
      
      {/* Subtle hover gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </button>
  );
};

// ------------------------------------------------------------------
// Sub-Component: Account Ledger Modal (The Details View)
// ------------------------------------------------------------------

const AccountLedgerModal = ({ account, transactions, onClose }: { account: Account, transactions: Transaction[], onClose: () => void }) => {
  const Icon = ICON_MAP[account.icon] || FlaskConical;
  const [searchTerm, setSearchTerm] = useState('');

  // Get transactions for this account
  const accountTxs = useMemo(() => {
    return transactions.filter(tx => tx.fromAccountId === account.id || tx.toAccountId === account.id);
  }, [transactions, account.id]);

  // Filter by search
  const filteredTxs = useMemo(() => {
    if (!searchTerm) return accountTxs;
    const term = searchTerm.toLowerCase();
    return accountTxs.filter(tx => 
      tx.description.toLowerCase().includes(term) || 
      tx.amount.toString().includes(term) ||
      tx.category.toLowerCase().includes(term)
    );
  }, [accountTxs, searchTerm]);

  // Calculate Stats
  const stats = useMemo(() => {
    return accountTxs.reduce((acc, tx) => {
       if (tx.toAccountId === account.id) {
         acc.in += tx.amount;
       } else {
         acc.out += tx.amount;
       }
       return acc;
    }, { in: 0, out: 0 });
  }, [accountTxs, account.id]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="glass w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] overflow-hidden border border-white/10">
        
        {/* Header */}
        <div className="p-8 pb-4 border-b border-white/5 bg-slate-900/50">
           <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                 <div className="w-16 h-16 rounded-3xl bg-slate-800 border border-white/5 flex items-center justify-center text-white shadow-xl">
                    <Icon size={32} />
                 </div>
                 <div>
                    <h2 className="text-2xl font-bold text-white">{account.name}</h2>
                    <p className="text-sm text-slate-400 font-medium">Ledger & Statistics</p>
                 </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                 <X size={24} />
              </button>
           </div>

           {/* Quick Stats Row */}
           <div className="grid grid-cols-3 gap-4 mt-8">
              <div className="p-4 bg-slate-900 rounded-2xl border border-white/5">
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Current Balance</p>
                 <p className="text-2xl font-black text-white mt-1">${account.balance.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                 <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1"><ArrowDownLeft size={12} /> Total In</p>
                 <p className="text-xl font-black text-emerald-400 mt-1">+${stats.in.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10">
                 <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1"><ArrowUpRight size={12} /> Total Out</p>
                 <p className="text-xl font-black text-rose-400 mt-1">-${stats.out.toLocaleString()}</p>
              </div>
           </div>
        </div>

        {/* Ledger */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-900/30">
           {/* Search Bar */}
           <div className="px-8 py-4 border-b border-white/5">
              <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                 <input 
                   type="text" 
                   placeholder="Search ledger..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full bg-slate-900 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm text-white focus:ring-1 focus:ring-purple-500/50 outline-none placeholder:text-slate-600"
                 />
              </div>
           </div>

           {/* Transaction List */}
           <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredTxs.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <History size={40} className="mb-3 opacity-20" />
                    <p className="text-sm font-medium">No transactions found</p>
                 </div>
              ) : (
                 filteredTxs.map(tx => {
                    const isIncome = tx.toAccountId === account.id;
                    return (
                       <div key={tx.id} className="group p-4 rounded-2xl bg-slate-900/50 hover:bg-slate-900 border border-white/5 hover:border-white/10 transition-all flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {isIncome ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                             </div>
                             <div>
                                <p className="text-sm font-bold text-white group-hover:text-purple-200 transition-colors">{tx.description}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                   <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded uppercase">{tx.category}</span>
                                   <span className="text-[10px] text-slate-600 flex items-center gap-1"><Calendar size={10} /> {new Date(tx.date).toLocaleDateString()}</span>
                                </div>
                             </div>
                          </div>
                          <p className={`text-lg font-black tracking-tighter ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                             {isIncome ? '+' : '-'}${tx.amount.toLocaleString()}
                          </p>
                       </div>
                    );
                 })
              )}
           </div>
        </div>

      </div>
    </div>
  );
};