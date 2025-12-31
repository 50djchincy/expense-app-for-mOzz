
import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { initializeApp, deleteApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, getFullPath, auth } from '../firebase';
import { UserProfile, UserRole } from '../types';
import { 
  Users, 
  Mail, 
  Shield, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Loader2, 
  Search, 
  UserPlus, 
  Plus,
  Lock,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../AuthContext';

// Firebase config for secondary app initialization
const firebaseConfig = {
  apiKey: "AIzaSyDeLW60g4WeLwMsC_kn1WR1fZtlsuytePQ",
  authDomain: "mystockrestnewblue.firebaseapp.com",
  projectId: "mystockrestnewblue",
  storageBucket: "mystockrestnewblue.firebasestorage.app",
  messagingSenderId: "187297215146",
  appId: "1:187297215146:web:e236e9a8bacc06a3f316d3"
};

export const AdminUsers: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ role: UserRole, displayName: string }>({ role: 'STAFF', displayName: '' });
  
  // Create State
  const [createForm, setCreateForm] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'STAFF' as UserRole
  });
  const [createError, setCreateError] = useState('');

  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, getFullPath('users')));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(d => ({ ...d.data() } as UserProfile));
      setUsers(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    
    let secondaryApp;
    try {
      // 1. Initialize a secondary app to create the user without logging out the admin
      const appName = `SecondaryApp_${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      
      // 2. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        createForm.email, 
        createForm.password
      );
      
      const newUid = userCredential.user.uid;

      // 3. Create the profile in Firestore
      const newUserProfile: UserProfile = {
        uid: newUid,
        email: createForm.email,
        displayName: createForm.displayName,
        role: createForm.role,
        createdAt: Date.now()
      };
      
      await setDoc(doc(db, getFullPath('users'), newUid), newUserProfile);
      
      // 4. Cleanup
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
      
      // Reset form and close
      setCreateForm({ displayName: '', email: '', password: '', role: 'STAFF' });
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setCreateError(err.message || "Failed to create user. Ensure email is unique and password is at least 6 characters.");
      if (secondaryApp) await deleteApp(secondaryApp);
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (user: UserProfile) => {
    setEditingId(user.uid);
    setEditForm({ role: user.role, displayName: user.displayName });
  };

  const handleSaveEdit = async (uid: string) => {
    try {
      const userRef = doc(db, getFullPath('users'), uid);
      await updateDoc(userRef, { 
        role: editForm.role,
        displayName: editForm.displayName 
      });
      setEditingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (uid: string) => {
    if (uid === profile?.uid) {
        alert("You cannot delete yourself!");
        return;
    }
    if (confirm("Are you sure you want to delete this user? They will lose access immediately.")) {
      await deleteDoc(doc(db, getFullPath('users'), uid));
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-purple-500" size={40} />
            <p className="text-slate-500">Loading team directory...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Team Management</h1>
          <p className="text-slate-400">Manage access and roles for all staff</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              placeholder="Search team..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-purple-500/50 outline-none"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 gradient-purple rounded-2xl text-white font-bold shadow-lg shadow-purple-500/20 active:scale-95 transition-all"
          >
            <Plus size={20} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      <div className="glass rounded-[2rem] border border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-inner">
                        {user.displayName[0]}
                      </div>
                      <div className="min-w-0">
                        {editingId === user.uid ? (
                          <input 
                            value={editForm.displayName}
                            onChange={(e) => setEditForm({...editForm, displayName: e.target.value})}
                            className="bg-slate-900 border border-purple-500/50 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                          />
                        ) : (
                          <p className="font-semibold text-white truncate">{user.displayName}</p>
                        )}
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail size={10} /> {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {editingId === user.uid ? (
                      <select 
                        value={editForm.role}
                        onChange={(e) => setEditForm({...editForm, role: e.target.value as UserRole})}
                        className="bg-slate-900 border border-purple-500/50 rounded-lg px-2 py-1 text-sm text-white focus:outline-none cursor-pointer"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="STAFF">STAFF</option>
                      </select>
                    ) : (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${
                        user.role === 'ADMIN' ? 'bg-purple-500/10 text-purple-400' : 
                        user.role === 'MANAGER' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-400'
                      }`}>
                        <Shield size={10} />
                        <span className="text-[10px] font-bold uppercase tracking-tight">{user.role}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {editingId === user.uid ? (
                        <>
                          <button 
                            onClick={() => handleSaveEdit(user.uid)}
                            className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-all"
                          >
                            <Check size={16} />
                          </button>
                          <button 
                            onClick={() => setEditingId(null)}
                            className="p-2 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500/20 transition-all"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleEdit(user)}
                            className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all"
                            title="Edit User"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(user.uid)}
                            className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-lg transition-all"
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-slate-500 italic">
                    No matching team members found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#000]/80 backdrop-blur-md" onClick={() => !creating && setIsModalOpen(false)} />
          <div className="glass w-full max-w-lg rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 gradient-purple" />
            
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <UserPlus size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Add Member</h2>
                  <p className="text-slate-400 text-sm">Create a new restaurant account</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors"
                disabled={creating}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    required
                    value={createForm.displayName}
                    onChange={(e) => setCreateForm({...createForm, displayName: e.target.value})}
                    placeholder="John Doe"
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all placeholder:text-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Role</label>
                  <select 
                    value={createForm.role}
                    onChange={(e) => setCreateForm({...createForm, role: e.target.value as UserRole})}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all cursor-pointer"
                  >
                    <option value="STAFF">Staff</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors" size={18} />
                  <input 
                    required
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({...createForm, email: e.target.value})}
                    placeholder="email@example.com"
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all placeholder:text-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Initial Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-purple-400 transition-colors" size={18} />
                  <input 
                    required
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all placeholder:text-slate-700"
                  />
                </div>
                <p className="text-[10px] text-slate-600 ml-1 italic">Must be at least 6 characters.</p>
              </div>

              {createError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs flex items-center gap-3 animate-shake">
                  <AlertCircle size={16} className="shrink-0" />
                  <p>{createError}</p>
                </div>
              )}

              <button 
                type="submit"
                disabled={creating}
                className="w-full gradient-purple py-4 rounded-2xl text-white font-bold shadow-xl shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={20} />
                    <span>Create Member Account</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      
      <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-start gap-4">
        <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg shrink-0">
            <Shield size={20} />
        </div>
        <div>
            <h4 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Permission Policies</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Admins have full visibility and control. Managers can view reports and logs but cannot manage team members. Staff accounts are limited to operational data entry. All actions are logged for audit purposes.
            </p>
        </div>
      </div>
    </div>
  );
};
