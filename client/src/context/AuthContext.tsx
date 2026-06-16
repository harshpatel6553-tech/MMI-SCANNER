import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

interface UserProfile {
  id: string;
  email: string;
  trial_start_date: string;
  subscription_status: string;
  is_admin: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  trialDaysLeft: number;
  isTrialExpired: boolean;
  isRecoveringPassword: boolean;
  setIsRecoveringPassword: (val: boolean) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);

  useEffect(() => {
    // Check URL hash for recovery token (foolproof fallback)
    if (window.location.hash.includes('type=recovery')) {
      setIsRecoveringPassword(true);
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveringPassword(true);
      }
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      // Small delay to allow the database trigger to create the profile if it's a brand new signup
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If profile not found immediately, retry once after 1s (trigger might take a moment)
        setTimeout(async () => {
          const { data: retryData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          setProfile(retryData);
          setLoading(false);
        }, 1000);
      } else {
        setProfile(data);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Calculate Trial Status
  let trialDaysLeft = 0;
  let isTrialExpired = false;

  if (profile) {
    const trialStart = new Date(profile.trial_start_date).getTime();
    const now = new Date().getTime();
    const daysElapsed = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
    trialDaysLeft = Math.max(0, 14 - daysElapsed);
    
    if (trialDaysLeft === 0 && profile.subscription_status !== 'active') {
      isTrialExpired = true;
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, trialDaysLeft, isTrialExpired, isRecoveringPassword, setIsRecoveringPassword, signOut }}>
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
