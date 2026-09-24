import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
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
  
  // Lamp toggle state
  const [isOn, setIsOn] = useState(false);

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
        
        if (data.session) {
          // Logged in
        } else {
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
      console.error("Auth error:", err);
      let errorMsg = 'An error occurred during authentication';
      if (err?.message) errorMsg = err.message;
      else if (err?.error_description) errorMsg = err.error_description;
      else if (err?.msg) errorMsg = err.msg;
      else if (typeof err === 'object') errorMsg = Object.keys(err).length === 0 ? "Server error: Check your Supabase configuration." : JSON.stringify(err);
      else errorMsg = String(err);
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const toggleLamp = () => {
    setIsOn(!isOn);
    if (!isOn) setError(null);
  };

  return (
    <div className={`lamp-login-wrapper ${isOn ? 'is-on' : 'is-off'}`}>
      
      {/* Hanging Lamp Assembly */}
      <div className="lamp-assembly">
        <div className="lamp-wire"></div>
        <div className="lamp-shade"></div>
        
        {/* The glowing bulb inside the shade */}
        <motion.div 
          className="lamp-bulb"
          animate={{ opacity: isOn ? 1 : 0.2, backgroundColor: isOn ? '#fbbf24' : '#4b5563' }}
          transition={{ duration: 0.3 }}
        />

        {/* Light Beam */}
        <motion.div 
          className="light-beam"
          initial={{ opacity: 0 }}
          animate={{ opacity: isOn ? 1 : 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {/* Interactive Pull String */}
        <motion.div 
          className="pull-string-container"
          onClick={toggleLamp}
          whileTap={{ y: 25 }}
          transition={{ type: "spring", stiffness: 300, damping: 10 }}
        >
          <div className="string-line"></div>
          <div className="string-handle"></div>
        </motion.div>
      </div>

      {/* Intro Text (Visible only when off) */}
      <AnimatePresence>
        {!isOn && (
          <motion.div 
            className="turn-on-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            PULL THE STRING TO LOGIN
          </motion.div>
        )}
      </AnimatePresence>

      {/* Login Form Container */}
      <AnimatePresence>
        {isOn && (
          <motion.div 
            className="login-container relative z-10"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="login-card glass-card lamp-illuminated-card">
              <div className="login-header">
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
