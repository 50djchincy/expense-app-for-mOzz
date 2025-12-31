
import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Receipt, 
  History, 
  Users, 
  Settings as SettingsIcon, 
  LogOut, 
  Menu,
  X,
  User as UserIcon,
  Sun,
  FlaskConical,
  Mountain,
  Heart,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useAccounts } from '../AccountsContext';

const NavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Sun, label: 'Shift Flow', path: '/daily-ops' },
  { icon: FlaskConical, label: 'Money Lab', path: '/money-lab' },
  { icon: Mountain, label: 'Hiking Bar', path: '/hiking-bar' },
  { icon: Users, label: 'Staff Hub', path: '/staff' },
  { icon: Receipt, label: 'Expenses', path: '/expenses' },
  { icon: History, label: 'Ledger', path: '/history' },
  { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  { icon: Users, label: 'Team', path: '/team', roles: ['ADMIN'] },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, logout, isSandbox } = useAuth();
  const { resetSandbox } = useAccounts();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  const filteredNav = NavItems.filter(item => 
    !item.roles || (profile && item.roles.includes(profile.role))
  );

  return (
    <div className={`h-screen flex bg-[#12121e] text-slate-200 overflow-hidden ${isSandbox ? 'border-t-4 border-amber-500/30' : ''}`}>
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 glass border-r border-white/5 h-full relative z-20">
        <div className="p-6 flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-purple flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Receipt className="text-white" size={20} />
            </div>
            <span className="font-outfit font-bold text-xl tracking-tight text-white">Mozzarella</span>
          </div>
          {isSandbox && (
            <div className="mt-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Sandbox Mode</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto scrollbar-hide">
          {filteredNav.map((item, idx) => (
            <NavLink
              key={item.path + idx}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300
                ${isActive 
                  ? 'gradient-purple text-white shadow-lg' 
                  : 'hover:bg-white/5 text-slate-400 hover:text-white'
                }
              `}
            >
              <item.icon size={20} strokeWidth={2.5} />
              <span className="font-medium text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-4">
          {isSandbox && (
             <button 
               onClick={() => confirm('Clear sandbox data and restart?') && resetSandbox()}
               className="w-full flex items-center gap-3 px-4 py-3 text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/10 rounded-2xl transition-all text-xs font-bold uppercase tracking-wider"
             >
               <RotateCcw size={16} />
               Reset Sandbox
             </button>
          )}
          <Link to="/profile" className="flex items-center gap-3 px-2 group">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold group-hover:border-purple-500/50 transition-colors">
              {profile?.displayName?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-white group-hover:text-purple-400 transition-colors">{profile?.displayName}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">{profile?.role}</p>
            </div>
          </Link>
          <button 
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-2xl transition-colors text-sm"
          >
            <LogOut size={18} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="lg:hidden flex items-center justify-between p-4 glass border-b border-white/5 sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-purple flex items-center justify-center shadow shadow-purple-500/20">
              <Receipt className="text-white" size={16} />
            </div>
            <span className="font-outfit font-bold text-lg text-white">Mozzarella</span>
          </div>
          <div className="flex items-center gap-3">
            {isSandbox && <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase">Demo</span>}
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-xl">
              <Menu size={24} className="text-slate-300" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto main-scroll-area">
          <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full pb-24 lg:pb-8">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/5 px-2 py-2 flex justify-around items-center z-50 overflow-x-auto scrollbar-hide">
        {filteredNav.map((item, idx) => (
          <NavLink
            key={item.path + idx}
            to={item.path}
            className={({ isActive }) => `
              flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[60px]
              ${isActive ? 'text-purple-400' : 'text-slate-500'}
            `}
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-purple-500/10' : ''}`}>
                   <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-tighter whitespace-nowrap">{item.label.split(' ')[0]}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Mobile Drawer */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsSidebarOpen(false)} />
          <aside className="absolute top-0 right-0 w-72 h-full bg-[#12121e] shadow-2xl flex flex-col p-6 animate-slide-in">
            <div className="flex justify-between items-center mb-8">
              <span className="font-outfit font-bold text-xl text-white">Menu</span>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400">
                <X size={24} />
              </button>
            </div>
            <nav className="flex-1 space-y-2">
              {filteredNav.map((item, idx) => (
                <NavLink
                  key={item.path + idx}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-4 py-3 rounded-2xl transition-all
                    ${isActive ? 'gradient-purple text-white shadow-lg' : 'text-slate-400 hover:text-white'}
                  `}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <button 
              onClick={() => { logout(); setIsSidebarOpen(false); }}
              className="mt-auto flex items-center gap-3 px-4 py-3 text-rose-400 bg-rose-500/10 rounded-2xl font-bold"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </aside>
        </div>
      )}
    </div>
  );
};
