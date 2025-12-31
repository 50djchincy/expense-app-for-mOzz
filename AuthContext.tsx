
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  User,
  signInAnonymously,
  updatePassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import { auth, db, getFullPath } from './firebase';
import { UserProfile, UserRole } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isSandbox: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  enterSandbox: () => void;
  logout: () => Promise<void>;
  updateUserPassword: (newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSandbox, setIsSandbox] = useState(() => localStorage.getItem('mozz_sandbox_active') === 'true');

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Initial auth error", e);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (isSandbox) {
        setProfile({
          uid: 'sandbox_user',
          email: 'sandbox@mozzarella.io',
          displayName: 'Sandbox Admin',
          role: 'ADMIN',
          createdAt: Date.now()
        });
        setLoading(false);
        return;
      }

      if (firebaseUser && !firebaseUser.isAnonymous) {
        const docRef = doc(db, getFullPath('users'), firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          const usersRef = collection(db, getFullPath('users'));
          const q = query(usersRef, limit(1));
          const usersSnap = await getDocs(q);
          
          const role: UserRole = usersSnap.empty ? 'ADMIN' : 'STAFF';
          
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Restaurant Staff',
            role: role,
            createdAt: Date.now()
          };
          await setDoc(docRef, newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSandbox]);

  const signIn = async (email: string, pass: string) => {
    setIsSandbox(false);
    localStorage.removeItem('mozz_sandbox_active');
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const enterSandbox = () => {
    setIsSandbox(true);
    localStorage.setItem('mozz_sandbox_active', 'true');
    // Profile will be set in the useEffect
  };

  const logout = async () => {
    if (isSandbox) {
      setIsSandbox(false);
      localStorage.removeItem('mozz_sandbox_active');
      window.location.reload();
      return;
    }
    await signOut(auth);
  };

  const updateUserPassword = async (newPass: string) => {
    if (auth.currentUser && !isSandbox) {
      await updatePassword(auth.currentUser, newPass);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isSandbox, signIn, enterSandbox, logout, updateUserPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
