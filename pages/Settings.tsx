
import React, { useState, useEffect } from 'react';
import { db, getFullPath } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Users, Plus, X, Search, UserPlus, Phone, Mail, Trash2, Loader2, Save } from 'lucide-react';
import { Customer } from '../types';

export const Settings: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'customers'>('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, getFullPath('customers')), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setCustomers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    setActionLoading(true);
    try {
      const id = `cust_${Date.now()}`;
      await setDoc(doc(db, getFullPath('customers'), id), {
        id,
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        totalDebt: 0,
        createdAt: Date.now()
      });
      setShowAddCustomer(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
             System Settings
          </h1>
          <p className="text-slate-400 mt-1">Configure business partners and entities.</p>
        </div>
      </div>

      <div className="flex bg-slate-900/50 p-1 rounded-2xl w-fit border border-white/5">
         <button 
           onClick={() => setActiveSubTab('customers')}
           className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'customers' ? 'bg-purple-500 text-white' : 'text-slate-400'}`}
         >
           Customer Management
         </button>
      </div>

      {activeSubTab === 'customers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                placeholder="Find customer..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
              />
            </div>
            <button onClick={() => setShowAddCustomer(true)} className="flex items-center justify-center gap-2 px-6 py-3 gradient-purple rounded-2xl text-white font-bold shadow-lg shadow-purple-500/20 active:scale-95 transition-all">
              <UserPlus size={20} /> Add New Customer
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCustomers.map(c => (
              <div key={c.id} className="glass rounded-[2rem] p-6 border border-white/10 shadow-lg relative group">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-lg">
                    {c.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{c.name}</h3>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Client ID: {c.id.slice(-4)}</p>
                  </div>
                </div>
                <div className="space-y-2 mb-6">
                  {c.phone && <p className="text-xs text-slate-400 flex items-center gap-2"><Phone size={12} /> {c.phone}</p>}
                  {c.email && <p className="text-xs text-slate-400 flex items-center gap-2"><Mail size={12} /> {c.email}</p>}
                </div>
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Credit</span>
                  <span className={`text-sm font-bold ${c.totalDebt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    ${c.totalDebt.toLocaleString()}
                  </span>
                </div>
                <button onClick={() => deleteDoc(doc(db, getFullPath('customers'), c.id))} className="absolute top-4 right-4 p-2 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {loading && <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin text-purple-500 mx-auto" size={32} /></div>}
          </div>
        </div>
      )}

      {showAddCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddCustomer(false)} />
          <div className="glass w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl font-bold text-white">Create Client Profile</h2>
               <button onClick={() => setShowAddCustomer(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
             </div>
             <form onSubmit={handleAddCustomer} className="space-y-6">
                <input name="name" required className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none" placeholder="Customer Name" />
                <input name="phone" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none" placeholder="Phone Number" />
                <input name="email" type="email" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none" placeholder="Email (Optional)" />
                <button disabled={actionLoading} type="submit" className="w-full py-5 gradient-purple rounded-3xl text-white font-bold shadow-xl shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                  {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />} Create Profile
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
