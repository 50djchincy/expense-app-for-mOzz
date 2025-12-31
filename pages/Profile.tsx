
import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { db, getFullPath } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { User, Shield, Key, Mail, Edit3, Save, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Profile: React.FC = () => {
  const { profile, updateUserPassword } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    setStatus(null);
    try {
      const userRef = doc(db, getFullPath('users'), profile.uid);
      await updateDoc(userRef, { displayName });
      setStatus({ type: 'success', message: 'Profile updated successfully' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;
    setLoading(true);
    setStatus(null);
    try {
      await updateUserPassword(newPassword);
      setNewPassword('');
      setStatus({ type: 'success', message: 'Password updated successfully' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">My Profile</h1>
          <p className="text-slate-400">Manage your account settings</p>
        </div>
        {profile?.role === 'ADMIN' && (
          <Link 
            to="/team" 
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/20 transition-all"
          >
            <Users size={18} />
            <span className="font-semibold text-sm">Manage Team</span>
          </Link>
        )}
      </div>

      {status && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 animate-slide-in ${
          status.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
        }`}>
          {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <p className="text-sm font-medium">{status.message}</p>
        </div>
      )}

      {/* Account Info Card */}
      <div className="glass rounded-[2rem] p-8 border border-white/10 space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
            <User size={120} />
        </div>

        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-3xl gradient-purple flex items-center justify-center text-3xl font-bold text-white shadow-xl">
            {profile?.displayName?.[0] || 'U'}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{profile?.displayName}</h2>
            <div className="flex items-center gap-2 text-slate-400 mt-1">
              <Mail size={14} />
              <span className="text-sm">{profile?.email}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-full mt-3">
              <Shield size={12} className="text-purple-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">{profile?.role}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          {/* Update Name Form */}
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Edit3 size={16} /> Basic Details
            </h3>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Full Name</label>
              <input 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
              />
            </div>
            <button 
              disabled={loading || displayName === profile?.displayName}
              className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Save size={18} /> Save Changes
            </button>
          </form>

          {/* Update Password Form */}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Key size={16} /> Security
            </h3>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">New Password</label>
              <input 
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
              />
            </div>
            <button 
              disabled={loading || !newPassword}
              className="w-full py-3 gradient-purple rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-30"
            >
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
