import React, { useState } from 'react';
import { useAccounts } from '../AccountsContext';
import { Transaction } from '../types';
import { 
  History as HistoryIcon, 
  Search, 
  Calendar, 
  Tag, 
  Loader2,
  ArrowRight,
  PackageCheck
} from 'lucide-react';

export const History: React.FC = () => {
  const { accounts, transactions, loading } = useAccounts();
  const [search, setSearch] = useState('');

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || id;

  const handleReceiveStock = (tx: Transaction) => {
    // Connects to Stock Module for historical entries
    alert(`📦 STOCK RECOVERY:\n\nConnecting historical transaction to inventory:\n"${tx.description}"\n\n(Redirecting to Stock Module...)`);
  };

  const filteredTxs = transactions.filter(tx => 
    tx.description.toLowerCase().includes(search.toLowerCase()) ||
    tx.category.toLowerCase().includes(search.toLowerCase()) ||
    getAccountName(tx.fromAccountId).toLowerCase().includes(search.toLowerCase()) ||
    getAccountName(tx.toAccountId).toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-purple-500" size={40} />
        <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Accessing Vault Records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <HistoryIcon className="text-purple-400" />
            Master Ledger
          </h1>
          <p className="text-slate-400 mt-1">Immutable record of all financial laboratory activities.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            placeholder="Filter system history..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all placeholder:text-slate-700"
          />
        </div>
      </div>

      <div className="glass rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 left-0 right-0 h-1 gradient-purple opacity-30" />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Molecular Movement</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Categorization</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Value</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Inv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTxs.map((tx) => {
                const isOutflow = tx.toAccountId === 'operational_expenses' || tx.toAccountId === 'payroll_expenses';
                const isInflow = tx.fromAccountId === 'service_fee_income';
                
                return (
                  <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar size={12} className="text-slate-700" />
                        <span className="text-[10px] font-bold whitespace-nowrap">
                          {new Date(tx.date).toLocaleDateString()}
                          <span className="mx-2 text-slate-800">|</span>
                          {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-300 uppercase tracking-tight">{getAccountName(tx.fromAccountId)}</span>
                        </div>
                        <div className="p-1.5 bg-slate-900 rounded-lg border border-white/5 group-hover:scale-110 transition-transform">
                          <ArrowRight size={10} className="text-slate-600" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-white uppercase tracking-tight">{getAccountName(tx.toAccountId)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-full text-slate-400 border border-white/5">
                        <Tag size={10} className="text-purple-500" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">{tx.category}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-xs text-slate-400 font-medium max-w-xs truncate group-hover:text-white transition-colors">{tx.description}</p>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`text-sm font-black tracking-tight ${
                          isInflow ? 'text-emerald-400' : isOutflow ? 'text-rose-400' : 'text-purple-400'
                        }`}>
                          {isInflow ? '+' : isOutflow ? '-' : ''}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => handleReceiveStock(tx)}
                        className="p-2 bg-slate-800 hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 rounded-xl transition-all"
                        title="Receive Stock"
                      >
                         <PackageCheck size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};