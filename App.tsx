
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { AccountsProvider } from './AccountsContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { AdminUsers } from './pages/AdminUsers';
import { DailyOps } from './pages/DailyOps';
import { History } from './pages/History';
import { MoneyLab } from './pages/MoneyLab';
import { Expenses } from './pages/Expenses';
import { HikingBar } from './pages/HikingBar';
import { Staff } from './pages/Staff';
import { Settings } from './pages/Settings';
import { Loader2 } from 'lucide-react';
import { UserRole } from './types';

const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isSandbox } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#12121e] flex flex-col items-center justify-center gap-4 text-center p-6">
        <div className="w-16 h-16 rounded-2xl gradient-purple flex items-center justify-center shadow-xl shadow-purple-500/20 mb-4">
          <Loader2 className="animate-spin text-white" size={32} />
        </div>
        <p className="text-slate-400 animate-pulse font-medium tracking-wide uppercase text-[10px]">Initializing Secure Environment</p>
      </div>
    );
  }

  // Allow access if in Sandbox Mode OR if a real user is signed in
  if (!isSandbox && (!user || user.isAnonymous)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const RoleGuard: React.FC<{ children: React.ReactNode, allowedRoles: UserRole[] }> = ({ children, allowedRoles }) => {
  const { profile, loading } = useAuth();
  
  if (loading) return null;
  if (!profile || !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { user, isSandbox } = useAuth();
  const isAuthenticated = isSandbox || (user && !user.isAnonymous);

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} 
        />
        
        <Route path="/" element={
          <AuthGuard>
            <AccountsProvider>
              <Layout>
                <Dashboard />
              </Layout>
            </AccountsProvider>
          </AuthGuard>
        } />

        <Route path="/daily-ops" element={
          <AuthGuard>
            <AccountsProvider>
              <Layout>
                <DailyOps />
              </Layout>
            </AccountsProvider>
          </AuthGuard>
        } />

        <Route path="/money-lab" element={
          <AuthGuard>
            <AccountsProvider>
              <Layout>
                <MoneyLab />
              </Layout>
            </AccountsProvider>
          </AuthGuard>
        } />

        <Route path="/hiking-bar" element={
          <AuthGuard>
            <AccountsProvider>
              <Layout>
                <HikingBar />
              </Layout>
            </AccountsProvider>
          </AuthGuard>
        } />

        <Route path="/staff" element={
          <AuthGuard>
            <AccountsProvider>
              <Layout>
                <Staff />
              </Layout>
            </AccountsProvider>
          </AuthGuard>
        } />

        <Route path="/expenses" element={
          <AuthGuard>
            <AccountsProvider>
              <Layout>
                <Expenses />
              </Layout>
            </AccountsProvider>
          </AuthGuard>
        } />

        <Route path="/history" element={
          <AuthGuard>
            <AccountsProvider>
              <Layout>
                <History />
              </Layout>
            </AccountsProvider>
          </AuthGuard>
        } />

        <Route path="/profile" element={
          <AuthGuard>
            <AccountsProvider>
              <Layout>
                <Profile />
              </Layout>
            </AccountsProvider>
          </AuthGuard>
        } />

        <Route path="/settings" element={
          <AuthGuard>
            <AccountsProvider>
              <Layout>
                <Settings />
              </Layout>
            </AccountsProvider>
          </AuthGuard>
        } />

        <Route path="/team" element={
          <AuthGuard>
            <RoleGuard allowedRoles={['ADMIN']}>
              <AccountsProvider>
                <Layout>
                  <AdminUsers />
                </Layout>
              </AccountsProvider>
            </RoleGuard>
          </AuthGuard>
        } />

        <Route path="*" element={
          <AuthGuard>
            <AccountsProvider>
              <Layout>
                <div className="p-12 text-center text-slate-500">
                  <p className="text-xl font-medium">Module Coming Soon</p>
                  <p className="text-sm mt-2">This feature is currently under active development.</p>
                </div>
              </Layout>
            </AccountsProvider>
          </AuthGuard>
        } />
      </Routes>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
