import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import './Login.css';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
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
          <p>Sign in to access real-time breakouts</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <button className="google-btn" onClick={handleGoogleLogin} disabled={loading}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#EA4335" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
            <path fill="#4285F4" d="M21.971,10.239H12.545v3.821h5.445c-0.173,0.562-0.449,1.101-0.824,1.579l3.081,3.082C21.737,16.89,23.011,13.738,21.971,10.239z" />
            <path fill="#FBBC05" d="M6.512,14.627C6.303,13.805,6.18,12.923,6.18,12c0-0.923,0.123-1.805,0.332-2.627L3.431,6.559C2.527,8.204,2,10.038,2,12s0.527,3.796,1.431,5.441L6.512,14.627z" />
            <path fill="#34A853" d="M12.545,22c2.594,0,4.958-0.988,6.716-2.589l-3.081-3.082c-1.026,0.672-2.284,1.066-3.635,1.066c-2.798,0-4.733-1.657-5.445-3.972l-3.081,2.814C6.54,19.336,9.278,22,12.545,22z" />
          </svg>
          Continue with Google
        </button>

        <div className="login-divider">
          <span>OR</span>
        </div>

        <form onSubmit={handleEmailAuth} className="login-form">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" className="email-btn" disabled={loading}>
            {loading ? 'Processing...' : (isSignUp ? 'Create Free Account' : 'Sign In')}
          </button>
        </form>

        <div className="login-footer">
          {isSignUp ? 'Already have an account?' : 'Need an account?'}
          <button type="button" className="text-btn" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? 'Sign In' : 'Start 14-Day Free Trial'}
          </button>
        </div>
      </div>
    </div>
  );
}
