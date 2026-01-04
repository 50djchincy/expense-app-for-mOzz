import React, { useState, useEffect } from 'react';
import { db, getFullPath } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { 
  Users, 
  Plus, 
  X, 
  Search, 
  UserPlus, 
  Phone, 
  Mail, 
  Trash2, 
  Loader2, 
  Save, 
  Briefcase, 
  Truck, 
  Store 
} from 'lucide-react';
import { Customer, Contact } from '../types';
import { useAuth } from '../AuthContext';

export const Settings: React.FC = () => {
  const { isSandbox } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'customers' | 'contacts'>('customers');
  
  // Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState('');

  const getSandboxData = <T,>(key: string, fallback: T): T => {
    const stored = localStorage.getItem(`mozz_sb_${key}`);
    return stored ? JSON.parse(stored) : fallback;
  };

  const setSandboxData = (key: string, data: any) => {
    localStorage.setItem(`mozz_sb_${key}`, JSON.stringify(data));
  };

  const SANDBOX_CUSTOMERS_KEY = 'customers';
  const SANDBOX_CONTACTS_KEY = 'contacts';

  useEffect(() => {
    if (isSandbox) {
      setCustomers(getSandboxData<Customer[]>(SANDBOX_CUSTOMERS_KEY, []));
      setContacts(getSandboxData<Contact[]>(SANDBOX_CONTACTS_KEY, []));
      setLoading(false);
      return;
    }

    // 1. Fetch Customers
    const qCust = query(collection(db, getFullPath('customers')), orderBy('createdAt', 'desc'));
    const unsubCust = onSnapshot(qCust, (snap) => {
      setCustomers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Customer)));
      setLoading(false);
    });

    // 2. Fetch Contacts (Vendors)
    const qCont = query(collection(db, getFullPath('contacts')), orderBy('name', 'asc'));
    const unsubCont = onSnapshot(qCont, (snap) => {
      setContacts(snap.docs.map(d => ({ ...d.data(), id: d.id } as Contact)));
    });

    return () => {
      unsubCust();
      unsubCont();
    };
  }, [isSandbox]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    setActionLoading(true);
    try {
      const id = `cust_${Date.now()}`;
      const newCustomer: Customer = {
        id,
        name: String(formData.get('name')),
        phone: String(formData.get('phone') || ''),
        email: String(formData.get('email') || ''),
        totalDebt: 0,
        createdAt: Date.now()
      };
      if (isSandbox) {
        const nextCustomers = [newCustomer, ...customers];
        setCustomers(nextCustomers);
        setSandboxData(SANDBOX_CUSTOMERS_KEY, nextCustomers);
      } else {
        await setDoc(doc(db, getFullPath('customers'), id), newCustomer);
      }
      setShowAddCustomer(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    setActionLoading(true);
    try {
      const id = `contact_${Date.now()}`;
      const newContact: Contact = {
        id,
        name: String(formData.get('name')),
        type: String(formData.get('type')),
        phone: String(formData.get('phone') || ''),
        defaultCategory: String(formData.get('defaultCategory') || ''),
        notes: String(formData.get('notes') || '')
      };
      if (isSandbox) {
        const nextContacts = [newContact, ...contacts];
        setContacts(nextContacts);
        setSandboxData(SANDBOX_CONTACTS_KEY, nextContacts);
      } else {
        await setDoc(doc(db, getFullPath('contacts'), id), newContact);
      }
      setShowAddContact(false);
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

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.defaultCategory?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
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
           onClick={() => { setActiveSubTab('customers'); setSearch(''); }}
           className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'customers' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
         >
           Customers (Credit)
         </button>
         <button 
           onClick={() => { setActiveSubTab('contacts'); setSearch(''); }}
           className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'contacts' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
         >
           Vendors & Suppliers
         </button>
      </div>

      {/* --- CUSTOMERS TAB --- */}
      {activeSubTab === 'customers' && (
        <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
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
                <button onClick={async () => {
                  if (isSandbox) {
                    const nextCustomers = customers.filter(customer => customer.id !== c.id);
                    setCustomers(nextCustomers);
                    setSandboxData(SANDBOX_CUSTOMERS_KEY, nextCustomers);
                    return;
                  }
                  await deleteDoc(doc(db, getFullPath('customers'), c.id));
                }} className="absolute top-4 right-4 p-2 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- VENDORS/CONTACTS TAB --- */}
      {activeSubTab === 'contacts' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
           <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                placeholder="Find vendor by name or category..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
              />
            </div>
            <button onClick={() => setShowAddContact(true)} className="flex items-center justify-center gap-2 px-6 py-3 gradient-purple rounded-2xl text-white font-bold shadow-lg shadow-purple-500/20 active:scale-95 transition-all">
              <Briefcase size={20} /> Add Vendor / Supplier
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContacts.map(c => (
              <div key={c.id} className="glass rounded-[2rem] p-6 border border-white/10 shadow-lg relative group">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                      c.type === 'SUPPLIER' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {c.type === 'SUPPLIER' ? <Truck size={20} /> : <Store size={20} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{c.name}</h3>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{c.type}</p>
                  </div>
                </div>
                <div className="space-y-3 mb-4">
                  {c.phone && <p className="text-xs text-slate-400 flex items-center gap-2"><Phone size={12} /> {c.phone}</p>}
                  {c.defaultCategory && (
                      <span className="inline-block px-2 py-1 bg-white/5 rounded-lg text-[10px] font-bold text-slate-400 border border-white/5">
                        Default: {c.defaultCategory}
                      </span>
                  )}
                  {c.notes && <p className="text-xs text-slate-500 italic">"{c.notes}"</p>}
                </div>
                <button onClick={async () => {
                  if (isSandbox) {
                    const nextContacts = contacts.filter(contact => contact.id !== c.id);
                    setContacts(nextContacts);
                    setSandboxData(SANDBOX_CONTACTS_KEY, nextContacts);
                    return;
                  }
                  await deleteDoc(doc(db, getFullPath('contacts'), c.id));
                }} className="absolute top-4 right-4 p-2 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {filteredContacts.length === 0 && !loading && (
                <div className="col-span-full py-12 text-center text-slate-500 italic">
                    No contacts found. Add a vendor to streamline expense logging.
                </div>
            )}
          </div>
        </div>
      )}

      {/* --- ADD CUSTOMER MODAL --- */}
      {showAddCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddCustomer(false)} />
          <div className="glass w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl font-bold text-white">Create Client Profile</h2>
               <button onClick={() => setShowAddCustomer(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
             </div>
             <form onSubmit={handleAddCustomer} className="space-y-6">
                <input name="name" required className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Customer Name" />
                <input name="phone" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Phone Number" />
                <input name="email" type="email" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Email (Optional)" />
                <button disabled={actionLoading} type="submit" className="w-full py-5 gradient-purple rounded-3xl text-white font-bold shadow-xl shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                  {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />} Create Profile
                </button>
             </form>
          </div>
        </div>
      )}

      {/* --- ADD VENDOR MODAL --- */}
      {showAddContact && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddContact(false)} />
          <div className="glass w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl font-bold text-white">Add Vendor / Supplier</h2>
               <button onClick={() => setShowAddContact(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
             </div>
             <form onSubmit={handleAddContact} className="space-y-6">
                <div className="space-y-4">
                    <input name="name" required className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Business Name / Contact Name" />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <select name="type" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50">
                            <option value="VENDOR">Vendor (General)</option>
                            <option value="SUPPLIER">Supplier (Stock)</option>
                            <option value="OTHER">Other</option>
                        </select>
                         <select name="defaultCategory" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50">
                            <option value="">No Default Cat</option>
                            <option value="Operations">Operations</option>
                            <option value="Supplies">Supplies</option>
                            <option value="Stock/Inventory">Stock/Inventory</option>
                            <option value="Utility">Utility</option>
                            <option value="Repair">Repair</option>
                        </select>
                    </div>

                    <input name="phone" className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="Phone Number (Optional)" />
                    <textarea name="notes" rows={2} className="w-full bg-slate-900 border border-white/5 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-purple-500/50 resize-none" placeholder="Notes (e.g. Delivers on Tuesdays)" />
                </div>
                
                <button disabled={actionLoading} type="submit" className="w-full py-5 gradient-purple rounded-3xl text-white font-bold shadow-xl shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                  {actionLoading ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />} Save Vendor
                </button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};
