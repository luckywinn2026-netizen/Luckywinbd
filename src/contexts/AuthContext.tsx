import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { username: string | null; phone: string | null; avatar_url: string | null; refer_code: string | null; user_code: string | null } | null;
  loading: boolean;
  signUp: (email: string, password: string, username?: string, referCode?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  showAuthModal: boolean;
  setShowAuthModal: (v: boolean) => void;
  authTab: 'login' | 'signup';
  setAuthTab: (t: 'login' | 'signup') => void;
  openAuth: (tab: 'login' | 'signup') => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');

  const openAuth = (tab: 'login' | 'signup') => {
    setAuthTab(tab);
    setShowAuthModal(true);
  };

  useEffect(() => {
    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer profile fetch to avoid deadlock
        setTimeout(() => fetchProfile(session.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('username, phone, avatar_url, refer_code, user_code')
      .eq('user_id', userId)
      .single();
    if (data) setProfile(data);
  };

  const signUp = async (email: string, password: string, username?: string, referCode?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { username: username || email.split('@')[0], phone: email.replace('@luckywin.app', '') },
      },
    });
    if (error) return { error: error.message };
    if (referCode && data.user) {
      const { error: linkError, data: linkResult } = await (supabase as any).rpc('link_referral_by_code', {
        p_refer_code: referCode,
      });

      if (linkError) {
        return { error: linkError.message };
      }

      if (linkResult && linkResult.success === false) {
        return { error: linkResult.error || 'Failed to link referral code' };
      }
    }
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      signUp, signIn, signOut,
      showAuthModal, setShowAuthModal,
      authTab, setAuthTab, openAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
