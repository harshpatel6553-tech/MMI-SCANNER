import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

export interface UserProfile {
  id: string;
  email: string;
  trial_start_date: string;
  subscription_status: string;
  is_admin: boolean;
}

const ADMIN_IDENTIFIERS = new Set([
  'hp4302033@gmail.com',
  'harshpatel6553@gmail.com',
  'dhruvilpatel017@gmail.com',
  'karanpatel.kp16@gmail.com',
  'drakula6553@gmail.com',
  'harsh',
  'harsh patel',
  'admin',
  'drakula',
  'dhruvil',
  'karan',
]);

const VALID_ADMIN_PASSKEYS = new Set([
  'mmiadmin',
  'harsh6553',
  'admin123',
  'marketminds'
]);

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  trialDaysLeft: number;
  isTrialExpired: boolean;
  isRecoveringPassword: boolean;
  setIsRecoveringPassword: (val: boolean) => void;
  signOut: () => Promise<void>;
  authorizeAdmin: (passkey: string) => boolean;
  revokeAdmin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [supabaseProfile, setSupabaseProfile] = useState<UserProfile | null>(null);
  const [localName, setLocalName] = useState<string>(() => localStorage.getItem('mmi_user_name') || '');
  const [isAdminAuthorized, setIsAdminAuthorized] = useState<boolean>(() => localStorage.getItem('mmi_admin_authorized') === 'true');
  const [loading, setLoading] = useState(true);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);

  // Sync with local name changes
  useEffect(() => {
    const handleNameChange = (e: any) => {
      const newName = e?.detail?.name || localStorage.getItem('mmi_user_name') || '';
      setLocalName(newName);
    };

    window.addEventListener('mmi:name_changed', handleNameChange);
    return () => window.removeEventListener('mmi:name_changed', handleNameChange);
  }, []);

  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) {
      setIsRecoveringPassword(true);
    }

    // Get initial Supabase session if available
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveringPassword(true);
      }
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setSupabaseProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const userEmail = (email || '').toLowerCase();
      const isWhitelistedAdmin = ADMIN_IDENTIFIERS.has(userEmail);

      if (data) {
        setSupabaseProfile({
          ...data,
          is_admin: isWhitelistedAdmin || !!data.is_admin,
          subscription_status: 'active',
        });
      } else {
        setSupabaseProfile({
          id: userId,
          email: email || '',
          subscription_status: 'active',
          trial_start_date: new Date().toISOString(),
          is_admin: isWhitelistedAdmin,
        });
      }
    } catch {
      // Ignore error and proceed
    } finally {
      setLoading(false);
    }
  };

  const authorizeAdmin = useCallback((passkey: string): boolean => {
    const cleanKey = passkey.trim().toLowerCase();
    if (VALID_ADMIN_PASSKEYS.has(cleanKey)) {
      localStorage.setItem('mmi_admin_authorized', 'true');
      setIsAdminAuthorized(true);
      window.dispatchEvent(new CustomEvent('mmi:admin_authorized', { detail: { authorized: true } }));
      return true;
    }
    return false;
  }, []);

  const revokeAdmin = useCallback(() => {
    localStorage.removeItem('mmi_admin_authorized');
    setIsAdminAuthorized(false);
    window.dispatchEvent(new CustomEvent('mmi:admin_authorized', { detail: { authorized: false } }));
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    } finally {
      localStorage.removeItem('mmi_user_name');
      localStorage.removeItem('mmi_admin_authorized');
      localStorage.removeItem('mmi-user-avatar');
      setLocalName('');
      setIsAdminAuthorized(false);
      setSupabaseUser(null);
      setSupabaseProfile(null);
      window.dispatchEvent(new CustomEvent('mmi:name_changed', { detail: { name: '' } }));
    }
  };

  // Construct effective user & profile
  const displayName = (supabaseUser?.email || localName || 'Trader').trim();
  const isNamedAdmin = ADMIN_IDENTIFIERS.has(displayName.toLowerCase());
  const effectiveIsAdmin = isAdminAuthorized || isNamedAdmin || supabaseProfile?.is_admin === true;

  const effectiveUser: User = (supabaseUser || {
    id: `trader_${displayName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    email: displayName,
    app_metadata: {},
    user_metadata: { name: displayName },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  }) as unknown as User;

  const effectiveProfile: UserProfile = supabaseProfile || {
    id: effectiveUser.id,
    email: displayName,
    trial_start_date: new Date().toISOString(),
    subscription_status: 'active',
    is_admin: effectiveIsAdmin,
  };

  // Open access: No paywalls, never expired
  const trialDaysLeft = 999;
  const isTrialExpired = false;

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        profile: { ...effectiveProfile, is_admin: effectiveIsAdmin },
        loading,
        trialDaysLeft,
        isTrialExpired,
        isRecoveringPassword,
        setIsRecoveringPassword,
        signOut,
        authorizeAdmin,
        revokeAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
