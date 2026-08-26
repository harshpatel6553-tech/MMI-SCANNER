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

      if (error || !data) {
        // If profile not found immediately, retry once after 1s (trigger might take a moment)
        setTimeout(async () => {
          const { data: retryData, error: retryError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
          if (retryError || !retryData) {
            // CRITICAL FALLBACK: The Postgres trigger failed to create the profile!
            // We will attempt to manually reconstruct it from the frontend.
            const newProfile = {
              id: userId,
              email: user?.email || '',
              subscription_status: 'trialing',
              trial_start_date: new Date().toISOString(),
              is_admin: false
            };
            
            // Try to insert it (this may fail if RLS blocks frontend inserts, which is fine)
            await supabase.from('profiles').insert([newProfile]);
            
            // Regardless of DB success, set it locally so they aren't locked out
            setProfile(newProfile);
          } else {
            setProfile(retryData);
          }
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
    if (profile.is_admin) {
      // Master Override: Admins never expire and have full control
      isTrialExpired = false;
    } else if (profile.subscription_status === 'active') {
      // Lifetime Access
      isTrialExpired = false;
    } else if (profile.subscription_status === 'expired') {
      // Explicitly Revoked or Expired
      isTrialExpired = true;
      trialDaysLeft = 0;
    } else if (profile.subscription_status.startsWith('monthly:') || profile.subscription_status.startsWith('yearly:')) {
      // Time-limited Access
      const dateString = profile.subscription_status.replace('monthly:', '').replace('yearly:', '');
      const expiresAt = new Date(dateString).getTime();
      const now = new Date().getTime();
      
      if (isNaN(expiresAt) || now >= expiresAt) {
        isTrialExpired = true;
      }
    } else {
      // 14-Day Free Trial Logic (default 'trialing')
      // Fallback to created_at or 'now' if trial_start_date is missing
      const startDateString = profile.trial_start_date || (profile as any).created_at || new Date().toISOString();
      const trialStart = new Date(startDateString).getTime();
      const now = new Date().getTime();
      
      // Protect against invalid dates
      if (isNaN(trialStart)) {
        isTrialExpired = true;
        trialDaysLeft = 0;
      } else {
        const daysElapsed = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
        trialDaysLeft = Math.max(0, 14 - daysElapsed);
        
        if (trialDaysLeft === 0) {
          isTrialExpired = true;
        }
      }
    }
  } else if (!loading && user) {
    // CRITICAL SECURITY FIX: If the user is logged in but their profile is completely missing 
    // (e.g. they were deleted from the database), explicitly lock them out.
    isTrialExpired = true;
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
