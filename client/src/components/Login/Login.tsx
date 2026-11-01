import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, Zap, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import './Login.css';

export function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 });

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - card.left;
    const y = e.clientY - card.top;
    const centerX = card.width / 2;
    const centerY = card.height / 2;
    const rotX = -((y - centerY) / centerY) * 7;
    const rotY = ((x - centerX) / centerX) * 7;
    setRotate({ x: rotX, y: rotY });
    setSpotlight({ x: (x / card.width) * 100, y: (y / card.height) * 100 });
  };

  const handleCardMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
    setSpotlight({ x: 50, y: 50 });
  };

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
          navigate('/', { replace: true });
        } else {
          setError('Verification link dispatched. Check your inbox to activate.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let errorMsg = 'Authentication failed. Please verify credentials.';
      if (err?.message) errorMsg = err.message;
      else if (err?.error_description) errorMsg = err.error_description;
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="institutional-auth-wrapper">
      {/* Precision Ambient Background */}
      <div className="auth-ambient-glow" />
      <div className="auth-grid-overlay" />

      {/* Center Auth Console */}
      <motion.div
        className="auth-card-container"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* Double-Bezel Hardware Shell */}
        <div className="auth-double-bezel-shell">
          <motion.div
            className="auth-terminal-card"
            animate={{ rotateX: rotate.x, rotateY: rotate.y }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            onMouseMove={handleCardMouseMove}
            onMouseLeave={handleCardMouseLeave}
            style={{
              transformStyle: 'preserve-3d',
              perspective: 1000,
              ['--spotlight-x' as any]: `${spotlight.x}%`,
              ['--spotlight-y' as any]: `${spotlight.y}%`,
            }}
          >
            {/* Header & Brand Emblem */}
            <div className="auth-brand-header">
              <div className="vanguard-eyebrow-badge">
                <span className="dot cyan" style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4ff', boxShadow: '0 0 8px #00d4ff' }} />
                <span>INSTITUTIONAL PORTAL</span>
              </div>
              <div className="auth-emblem">
                <Zap size={22} strokeWidth={1.5} className="text-cyan-400" />
              </div>
              <div className="auth-brand-title">MMI TERMINAL</div>
              <div className="auth-brand-sub">
                {isForgotPassword
                  ? 'Account Recovery Protocol'
                  : isSignUp
                  ? 'Register for Institutional Market Telemetry'
                  : 'Algorithmic Breakouts & F&O Command Center'}
              </div>
            </div>

          {/* Segmented Mode Switcher */}
          {!isForgotPassword && (
            <div className="auth-segmented-nav">
              <button
                type="button"
                className={`auth-segment-btn ${!isSignUp ? 'active' : ''}`}
                onClick={() => {
                  setIsSignUp(false);
                  setError(null);
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-segment-btn ${isSignUp ? 'active' : ''}`}
                onClick={() => {
                  setIsSignUp(true);
                  setError(null);
                }}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Inline Feedback Alerts */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                className="auth-feedback-pill error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <AlertCircle size={15} className="shrink-0 text-rose-400" />
                <span>{error}</span>
              </motion.div>
            )}

            {resetSent && (
              <motion.div
                className="auth-feedback-pill success"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                <span>Password reset instructions sent to your email.</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Authentication Form */}
          <form onSubmit={handleEmailAuth} className="auth-form-body">
            <div className="auth-field-group">
              <label className="auth-field-label">Institutional Email</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon text-slate-400" />
                <input
                  type="email"
                  placeholder="name@firm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  required
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div className="auth-field-group">
                <div className="auth-field-label-row">
                  <label className="auth-field-label">Password</label>
                  <button
                    type="button"
                    className="auth-forgot-link"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError(null);
                      setResetSent(false);
                    }}
                  >
                    Forgot?
                  </button>
                </div>
                <div className="auth-input-wrapper">
                  <Lock size={16} className="auth-input-icon text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter security passphrase"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-input"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="auth-pw-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" className="auth-submit-btn group" disabled={loading}>
              <span className="auth-btn-label">
                {loading
                  ? 'Verifying...'
                  : isForgotPassword
                  ? 'Dispatch Reset Link'
                  : isSignUp
                  ? 'Start 14-Day Full Access Trial'
                  : 'Enter Trading Console'}
              </span>
              <div className="auth-btn-nest-icon">
                <ArrowRight size={15} strokeWidth={1.5} className="auth-arrow-icon" />
              </div>
            </button>
          </form>

          {/* Footer Sub-actions */}
          <div className="auth-card-footer">
            {isForgotPassword ? (
              <button
                type="button"
                className="auth-back-link"
                onClick={() => {
                  setIsForgotPassword(false);
                  setResetSent(false);
                }}
              >
                Return to Sign In
              </button>
            ) : (
              <div className="auth-trial-notice">
                <ShieldCheck size={14} strokeWidth={1.5} className="text-emerald-400 shrink-0" />
                <span>14-day zero-commitment access included with new registrations.</span>
              </div>
            )}
          </div>
        </motion.div>
        </div>

        {/* Credibility Telemetry Pills */}
        <div className="auth-telemetry-row">
          <div className="telemetry-pill">
            <span className="dot cyan" />
            <span>500+ NSE Equities</span>
          </div>
          <div className="telemetry-pill">
            <span className="dot emerald" />
            <span>F&O Smart Money Engine</span>
          </div>
          <div className="telemetry-pill">
            <span className="dot amber" />
            <span>Sub-second Audio Alerts</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
export default Login;
