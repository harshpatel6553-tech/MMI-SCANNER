import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

export function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setResetSent(true);
      } else if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        // If Supabase returns a session immediately, it means email confirmation is OFF
        if (data.session) {
          // Successfully logged in! React router will redirect via AuthContext automatically.
        } else {
          // If session is null, it means email confirmation is ON
          alert('Account created! Check your email for the confirmation link.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-card">
        <div className="login-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48" className="login-logo">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
          </svg>
          <h2>Market Minds Scanner</h2>
          <p>{isForgotPassword ? 'Reset your password' : 'Sign in to access real-time breakouts'}</p>
        </div>

        {error && <div className="login-error">{error}</div>}
        {resetSent && <div className="login-success" style={{background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', border: '1px solid rgba(34, 197, 94, 0.2)'}}>Password reset link sent! Check your email.</div>}

        <form onSubmit={handleEmailAuth} className="login-form">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {!isForgotPassword && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          )}
          <button type="submit" className="email-btn" disabled={loading}>
            {loading ? 'Processing...' : (isForgotPassword ? 'Send Reset Link' : (isSignUp ? 'Create Free Account' : 'Sign In'))}
          </button>
        </form>

        <div className="login-footer">
          {isForgotPassword ? (
            <button type="button" className="text-btn" onClick={() => { setIsForgotPassword(false); setResetSent(false); }}>
              Back to Sign In
            </button>
          ) : (
            <>
              <div>
                {isSignUp ? 'Already have an account?' : 'Need an account?'}
                <button type="button" className="text-btn" onClick={() => setIsSignUp(!isSignUp)}>
                  {isSignUp ? 'Sign In' : 'Start 14-Day Free Trial'}
                </button>
              </div>
              {!isSignUp && (
                <div style={{ marginTop: '0.75rem' }}>
                  <button type="button" className="text-btn" onClick={() => setIsForgotPassword(true)}>
                    Forgot Password?
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
