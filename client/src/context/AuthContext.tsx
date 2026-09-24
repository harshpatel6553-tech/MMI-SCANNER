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
            
          const userEmail = (user?.email || '').toLowerCase();
          const isWhitelistedAdmin = [
            'hp4302033@gmail.com',
            'harshpatel6553@gmail.com',
            'dhruvilpatel017@gmail.com',
            'karanpatel.kp16@gmail.com',
            'drakula6553@gmail.com'
          ].includes(userEmail);

          if (retryError || !retryData) {
            const newProfile = {
              id: userId,
              email: user?.email || '',
              subscription_status: isWhitelistedAdmin ? 'active' : 'trialing',
              trial_start_date: new Date().toISOString(),
              is_admin: isWhitelistedAdmin
            };
            
            await supabase.from('profiles').insert([newProfile]);
            setProfile(newProfile);
          } else {
            setProfile({
              ...retryData,
              is_admin: isWhitelistedAdmin || !!retryData.is_admin,
              subscription_status: isWhitelistedAdmin ? 'active' : retryData.subscription_status
            });
          }
          setLoading(false);
        }, 1000);
      } else {
        const userEmail = (user?.email || data.email || '').toLowerCase();
        const isWhitelistedAdmin = [
          'hp4302033@gmail.com',
          'harshpatel6553@gmail.com',
          'dhruvilpatel017@gmail.com',
          'karanpatel.kp16@gmail.com',
          'drakula6553@gmail.com'
        ].includes(userEmail);

        setProfile({
          ...data,
          is_admin: isWhitelistedAdmin || !!data.is_admin,
          subscription_status: isWhitelistedAdmin ? 'active' : data.subscription_status
        });
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error during signOut:', err);
    } finally {
      setUser(null);
      setProfile(null);
    }
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
