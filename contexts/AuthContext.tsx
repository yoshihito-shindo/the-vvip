import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, profileData: Partial<UserProfile>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const busyRef = React.useRef(false);

  const refreshProfile = async () => {
    const p = await authService.getMyProfile();
    setProfile(p);
    setIsAdmin(p?.is_admin ?? false);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const session = await authService.getSession();
        if (session?.user) {
          setUser(session.user);
          await refreshProfile();
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        setLoading(false);
      }
    };
    init();

    const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
      if (busyRef.current) return;
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    busyRef.current = true;
    try {
      const data = await authService.signIn(email, password);
      setUser(data.user);
      await refreshProfile();
    } finally {
      busyRef.current = false;
    }
  };

  const signUp = async (email: string, password: string, profileData: Partial<UserProfile>) => {
    busyRef.current = true;
    try {
      const data = await authService.signUp(email, password, profileData);
      setUser(data.user);
      await refreshProfile();
    } finally {
      busyRef.current = false;
    }
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signIn, signUp, signOut, refreshProfile, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
