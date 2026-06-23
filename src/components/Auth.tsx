/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Key, Mail, User, Info, Check, LogIn, Sparkles, ArrowLeft, AlertTriangle } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { supabase, configLoadedPromise } from '../lib/supabase';

interface AuthProps {
  onLoginSuccess: (token: string, user: UserProfile, role: UserRole) => void;
  initialView?: 'login' | 'register' | 'forgot' | 'reset';
  onBackToLanding?: () => void;
}

export function Auth({ onLoginSuccess, initialView = 'login', onBackToLanding }: AuthProps) {
  const [view, setView] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialView);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  // Task 3: Clear any stale auth/profile cache on signup page load
  useEffect(() => {
    if (view === 'register') {
      console.log('[AUTH] Signup view loaded. Purging local tokens and logging out stale Supabase Auth sessions...');
      localStorage.removeItem('ul_token');
      sessionStorage.removeItem('ul_token');
      supabase.auth.signOut().then(() => {
        console.log('[AUTH] Stale sessions cleared successfully via Supabase signOut.');
      }).catch((err) => {
        console.warn('[AUTH] Error during signout clean phase:', err);
      });
    }
  }, [view]);
  
  // Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  // Reset password inputs
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // States
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Parse recovery state from URL on mount
  useEffect(() => {
    const hash = window.location.hash || '';
    const params = new URLSearchParams(window.location.search);
    
    if (hash.includes('type=recovery') || params.get('type') === 'recovery') {
      setView('reset');
      console.log('[AUTH] System detected password recovery URL. Prompting reset screen.');
    }
  }, []);

  // Utility to push server-side diagnostics logs
  const logDiagnosticEvent = async (userId: string, action: string, details: string) => {
    try {
      await fetch('/api/auth/log-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, details })
      });
    } catch (e) {
      console.warn('[AUTH DIAGNOSTICS] Network log flush failed:', e);
    }
  };

  // Live password strength indicator for resetting
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, text: 'Empty', color: 'bg-zinc-700' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score, text: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { score, text: 'Medium', color: 'bg-yellow-500' };
    return { score, text: 'Strong', color: 'bg-[#A8CC00]' };
  };

  const handleSignUpAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (view === 'register' && !name)) {
      setError('Please fill in all target input fields.');
      return;
    }
    setLoading(true);
    setError(null);
    setSignupSuccess(null);

    try {
      await configLoadedPromise;
    } catch (e) {
      console.warn('[AUTH] Awaiting config loaded promise failed, continuing:', e);
    }

    const cleanEmail = email.toLowerCase().trim();

    // Upfront client-side format checks for premium user responsiveness
    if (view === 'register') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        setError('Please enter a valid email address.');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password does not meet security requirements.');
        setLoading(false);
        return;
      }
    }

    try {
      if (view === 'login') {
        console.log(`[LOGIN] Initiating password challenge for "${cleanEmail}"...`);
        const { data, error: loginErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        });

        if (loginErr) {
          console.warn(`[LOGIN] Forbidden entry for "${cleanEmail}": ${loginErr.message}`);
          throw loginErr;
        }

        const session = data.session;
        if (!session) {
          throw new Error('Fatal: Unable to obtain authenticated session clearance.');
        }

        console.log(`[LOGIN] Secured session tokens for "${cleanEmail}". Syncing roles...`);
        
        // Fetch matching role configurations from the Express Server holding the caches
        const meRes = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const meData = await meRes.json();
        if (!meRes.ok) {
          throw new Error(meData.error || 'Authentication challenge failed or profile incomplete.');
        }

        await logDiagnosticEvent(session.user.id, 'login', `User "${cleanEmail}" logged in successfully via Supabase Auth.`);
        onLoginSuccess(session.access_token, meData.user, meData.role);

      } else {
        // Register Tab
        console.log(`[SIGNUP] Performing duplicate email registration check for "${cleanEmail}"...`);
        const checkRes = await fetch(`/api/auth/check-email?email=${encodeURIComponent(cleanEmail)}`);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          
          console.log(`[SIGNUP-DUPLICATE-CHECK-METRICS]:`);
          console.log(` - Frontend Cache Match: false (stale local lists not present)`);
          console.log(` - Backend Duplicate Verified: ${checkData.exists}`);
          console.log(` - Source Identifier: ${checkData.source || 'none'}`);

          if (checkData.exists) {
            console.warn(`[SIGNUP] Duplicate found. Detected from backend source: ${checkData.source || 'unknown'}`);
            setError('This email is already registered. Please sign in.');
            setLoading(false);
            return;
          }
        }

        console.log(`[SIGNUP] Authenticating registration with Supabase for "${cleanEmail}"...`);
        const { data, error: registerErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });

        // Debugging logs requested to inspect exact Supabase authentication responses
        console.log('[SIGNUP] signUp response data:', data);
        console.log('[SIGNUP] signUp response error:', registerErr);

        if (registerErr) {
          console.warn(`[SIGNUP-DUPLICATE-CHECK-METRICS] Registration exception: ${registerErr.message}`);
          console.warn(`[SIGNUP] Failed registration for "${cleanEmail}": ${registerErr.message}`);
          throw registerErr;
        }

        // Detect if email already exists when Prevent User Enumeration is active
        // in Supabase (which silently returns success with an empty identities list)
        const isExistingUser = data.user && data.user.identities && data.user.identities.length === 0;
        if (isExistingUser) {
          console.warn(`[SIGNUP-DUPLICATE-CHECK-METRICS] Duplicate detected from Supabase Auth silent identities validation (already registered).`);
          console.warn(`[SIGNUP] Email "${cleanEmail}" is already registered (silently detected via identities check).`);
          setError('This email is already registered. Please sign in.');
          setLoading(false);
          return;
        }

        const session = data.session;
        if (!session) {
          // If email confirmation is enabled, a session won't load immediately.
          // Switch to login tab and state the successful registration
          setView('login');
          setSignupSuccess('Account created successfully. Please verify your email.');
          return;
        }

        console.log(`[SIGNUP] Secured database entry for "${cleanEmail}" with Supabase UID ${session.user.id}.`);

        // Force a handshake call to /api/auth/me to provision profile cache
        const meRes = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const meData = await meRes.json();
        if (!meRes.ok) {
          throw new Error(meData.error || 'Authentication challenge failed or profile incomplete.');
        }

        await logDiagnosticEvent(session.user.id, 'signup', `User "${cleanEmail}" registered and verified successfully.`);
        onLoginSuccess(session.access_token, meData.user, meData.role);
      }
    } catch (err: any) {
      const errorMessage = err.message || '';
      const errStr = errorMessage.toLowerCase();

      if (view === 'register') {
        if (errStr.includes('already registered') || errStr.includes('already exists') || errStr.includes('unique_violation') || err.code === 'user_already_exists') {
          setError('This email is already registered. Please sign in.');
        } else if (errStr.includes('invalid email') || errStr.includes('email is invalid') || errStr.includes('email address')) {
          setError('Please enter a valid email address.');
        } else if (errStr.includes('password does not meet') || errStr.includes('password is too weak') || errStr.includes('should be at least') || errStr.includes('password should be') || errStr.includes('weak_password')) {
          setError('Password does not meet security requirements.');
        } else if (errStr.includes('too many attempts') || errStr.includes('rate limit') || errStr.includes('too many requests') || err.status === 429) {
          setError('Too many attempts. Please try again later.');
        } else if (errStr.includes('failed to fetch') || errStr.includes('network error') || errStr.includes('unable to connect') || errStr.includes('network')) {
          setError('Unable to connect. Please try again.');
        } else {
          setError(errorMessage || 'Validation failed. Please verify credentials.');
        }
      } else {
        // Login specific errors
        if (errStr.includes('invalid login credentials') || errStr.includes('invalid credentials') || errStr.includes('login_failed') || err.status === 400) {
          setError('Invalid email or password. Please verify credentials.');
        } else if (errStr.includes('too many attempts') || errStr.includes('rate limit') || errStr.includes('too many requests') || err.status === 429) {
          setError('Too many attempts. Please try again later.');
        } else if (errStr.includes('failed to fetch') || errStr.includes('network error') || errStr.includes('unable to connect') || errStr.includes('network')) {
          setError('Unable to connect. Please try again.');
        } else {
          setError(errorMessage || 'Validation failed. Please verify credentials.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide your email address.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      await configLoadedPromise;
    } catch (e) {
      console.warn('[AUTH] Awaiting config loaded promise failed, continuing:', e);
    }

    const cleanEmail = email.toLowerCase().trim();

    try {
      console.log(`[RECOVERY] Requesting password reset magic link for "${cleanEmail}"...`);
      
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/auth/callback`
      });

      // Always show success banner to prevent User Enumeration security exposures
      setForgotSuccess(true);
      
      // Log event cleanly on server
      await logDiagnosticEvent('recovery-service', 'password_reset_request', `Password reset link requested for email: "${cleanEmail}"`);

      if (resetErr) {
        console.warn(`[RECOVERY] Supabase reset request error (logged but hidden to avoid enumeration): ${resetErr.message}`);
      }
    } catch (err: any) {
      setError(err.message || 'Recovery request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('Please supply both password inputs.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords mismatch. Please confirm matching input characters.');
      return;
    }

    const strength = getPasswordStrength(newPassword);
    if (strength.score < 2) {
      setError('Proposed password is weak. Please meet character clearance.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await configLoadedPromise;
    } catch (e) {
      console.warn('[AUTH] Awaiting config loaded promise failed, continuing:', e);
    }

    try {
      console.log('[RECOVERY] Submitting new credentials payload to Supabase Auth...');
      
      const { data: userClearance, error: updateErr } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateErr) {
        throw updateErr;
      }

      setResetSuccess(true);
      const activeUser = userClearance?.user;
      
      await logDiagnosticEvent(
        activeUser?.id || 'system-recovery',
        'password_reset_completion',
        `User successfully synchronized their new password clearance.`
      );

      // Successfully updated, clean URL parameter hash fragment
      window.history.replaceState(null, '', window.location.pathname);

      // Sign out to clear temporary recovery context and force login
      await supabase.auth.signOut();

      setTimeout(() => {
        setResetSuccess(false);
        setView('login');
        setNewPassword('');
        setConfirmPassword('');
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Failed to update password context due to token reuse expiration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4" id="auth-screen">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Side: Editorial Banner */}
        <div className="md:col-span-5 flex flex-col justify-between bg-brand-surface border border-brand-secondary p-8 rounded-2xl relative overflow-hidden" id="auth-pitch-panel">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            {onBackToLanding && (
              <button 
                onClick={onBackToLanding}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-mono mb-6 transition-colors bg-brand-surface border border-brand-secondary/40 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-brand-bg select-none"
              >
                <ArrowLeft size={12} /> BACK TO LANDING
              </button>
            )}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-brand text-brand-bg flex items-center justify-center rounded-lg font-bold font-mono text-xl shadow-lg shadow-brand/20">
                U
              </div>
              <div>
                <span className="font-mono text-xs tracking-widest text-[#A8CC00] uppercase block">Platform</span>
                <span className="font-sans font-bold text-[#FFFFFF] text-lg tracking-tight">UNION LEDGER</span>
              </div>
            </div>
            
            <h1 className="text-3xl font-sans font-bold tracking-tight text-white mb-4 leading-tight animate-fade-in">
              Transparent <span className="text-brand">Financial Control</span> for high-trust groups.
            </h1>
            
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              Specifically created for labor unions, non-governmental organizations, student councils, and community associations to govern transactions with complete accountability, approvals, and immutable audit trails.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-md bg-brand/10 text-brand mt-0.5">
                  <Check size={14} />
                </div>
                <div>
                  <span className="text-white text-xs font-semibold block">Isolated Workspaces</span>
                  <p className="text-zinc-500 text-[11px]">Seamless switcher governing infinite member groups securely.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-md bg-brand/10 text-brand mt-0.5">
                  <Check size={14} />
                </div>
                <div>
                  <span className="text-white text-xs font-semibold block">Verifiable Audit Trails</span>
                  <p className="text-zinc-500 text-[11px]">Every proposed transaction, role change or export is logged.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-md bg-brand/10 text-brand mt-0.5">
                  <Check size={14} />
                </div>
                <div>
                  <span className="text-white text-xs font-semibold block">Public Audit Portals</span>
                  <p className="text-zinc-500 text-[11px]">Generate mobile-ready summaries and public transparency logs.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-brand-secondary flex items-center gap-2 mt-8 text-[11px] text-zinc-500 font-mono">
            <span>DEFAULT CURRENCY : INR (₹)</span>
            <span className="text-zinc-700">•</span>
            <span>SECURE LEDGER AUTH</span>
          </div>
        </div>

        {/* Right Side: Logins Interface */}
        <div className="md:col-span-7 flex flex-col justify-center space-y-6">
          
          {/* Main Auth Card */}
          <div className="bg-brand-surface border border-brand-secondary p-8 rounded-2xl shadow-xl shadow-black/40" id="auth-action-control">
            
            {/* View Selector Tabs */}
            {(view === 'login' || view === 'register') && (
              <div className="flex border-b border-brand-secondary mb-6">
                <button
                  id="login-tab-btn"
                  onClick={() => { setView('login'); setError(null); setSignupSuccess(null); }}
                  className={`flex-1 pb-3 text-center text-sm font-semibold transition-all ${view === 'login' ? 'text-brand border-b-2 border-brand font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Account Login
                </button>
                <button
                  id="register-tab-btn"
                  onClick={() => { setView('register'); setError(null); setSignupSuccess(null); }}
                  className={`flex-1 pb-3 text-center text-sm font-semibold transition-all ${view === 'register' ? 'text-brand border-b-2 border-brand font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Register Account
                </button>
              </div>
            )}

            {/* Title headers for Forgot and Reset Views */}
            {view === 'forgot' && (
              <div className="mb-6">
                <button 
                  onClick={() => { setView('login'); setError(null); }}
                  className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-xs font-mono mb-3 transition-colors"
                >
                  <ArrowLeft size={12} /> BACK TO LOGIN
                </button>
                <h2 className="text-xl font-bold text-white tracking-tight">Account Recovery</h2>
                <p className="text-zinc-500 text-xs mt-1">Submit your registered email address to receive recovery credentials.</p>
              </div>
            )}

            {view === 'reset' && (
              <div className="mb-6">
                <div className="flex items-center gap-1.5 text-[#A8CC00] text-xs font-mono mb-2">
                  <Sparkles size={12} /> VERIFIED RECOVERY SESSION
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Setup New Password</h2>
                <p className="text-zinc-500 text-xs mt-1">Clear your active session credentials by compiling a high-strength password.</p>
              </div>
            )}

            {/* Error Indicators */}
            {error && (
              <div className="mb-4 bg-red-950/40 border border-red-900 text-red-200 text-xs p-3 rounded-lg flex items-start gap-2 animate-pulse" id="auth-error-log">
                <Info size={14} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Registration Success Indicators */}
            {signupSuccess && (
              <div className="mb-4 bg-emerald-950/40 border border-emerald-900 text-emerald-200 text-xs p-3 rounded-lg flex items-start gap-2.5 animate-fade-in" id="signup-success-banner">
                <Check size={14} className="mt-0.5 text-emerald-500 flex-shrink-0" />
                <span>{signupSuccess}</span>
              </div>
            )}

            {/* Success Indicators */}
            {forgotSuccess && view === 'forgot' && (
              <div className="mb-4 bg-zinc-900 border border-brand/40 text-brand text-xs p-4 rounded-lg flex items-start gap-2.5" id="forgot-success-banner">
                <Check size={16} className="mt-0.5 text-brand flex-shrink-0" />
                <div>
                  <span className="font-bold block text-white mb-0.5">Recovery Dispatch Fired</span>
                  <p className="text-zinc-400">If your email is registered in our ledger clearance, an account recovery link will arrive shortly. Please check spam thresholds.</p>
                </div>
              </div>
            )}

            {resetSuccess && view === 'reset' && (
              <div className="mb-4 bg-[#A8CC00]/10 border border-[#A8CC00]/40 text-[#A8CC00] text-xs p-4 rounded-lg flex items-start gap-2.5" id="reset-success-banner">
                <Check size={16} className="mt-0.5 text-[#A8CC00] flex-shrink-0" />
                <div>
                  <span className="font-bold block text-white mb-0.5">Password Synchronized</span>
                  <p className="text-zinc-400">Your account clearance has been successfully updated. Redirecting to Entry Portal...</p>
                </div>
              </div>
            )}

            {/* Tab: Login & register views */}
            {(view === 'login' || view === 'register') && (
              <form onSubmit={handleSignUpAndLogin} className="space-y-4">
                {view === 'register' && (
                  <div className="space-y-1.5" id="register-field-name">
                    <label className="text-[11px] font-mono tracking-wider text-zinc-400 block">FULL NAME</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                      <input
                        type="text"
                        className="w-full bg-brand-bg border border-brand-secondary hover:border-zinc-700 focus:border-brand rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand/45 transition-all"
                        placeholder="e.g. Liam Sterling"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required={view === 'register'}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5" id="input-field-email">
                  <label className="text-[11px] font-mono tracking-wider text-zinc-400 block">EMAIL ADDRESS</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      type="email"
                      className="w-full bg-brand-bg border border-brand-secondary hover:border-zinc-700 focus:border-brand rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand/45 transition-all"
                      placeholder="you@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5 float-none" id="input-field-password">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-mono tracking-wider text-zinc-400 block">PASSWORD</label>
                    {view === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setView('forgot'); setError(null); setForgotSuccess(false); }}
                        className="text-[11px] font-mono text-[#A8CC00] hover:text-[#C4E200] transition-colors focus:outline-none"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      type="password"
                      className="w-full bg-brand-bg border border-brand-secondary hover:border-zinc-700 focus:border-brand rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand/45 transition-all"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  id="auth-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 bg-brand hover:bg-brand-hover text-brand-bg hover:scale-[1.01] transition-all font-semibold rounded-lg py-3 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-brand-bg border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn size={16} />
                      <span>{view === 'login' ? 'Portal Authentication Entry' : 'Boot Organization Workspace'}</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Tab: Forgot Password view */}
            {view === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5" id="forgot-field-email">
                  <label className="text-[11px] font-mono tracking-wider text-zinc-400 block">REGISTERED EMAIL</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      type="email"
                      className="w-full bg-brand-bg border border-brand-secondary hover:border-zinc-700 focus:border-brand rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand/45 transition-all"
                      placeholder="you@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  id="forgot-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 bg-brand hover:bg-brand-hover text-brand-bg transition-all font-semibold rounded-lg py-3 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-brand-bg border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Disptach Recovery Key</span>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => { setView('login'); setError(null); }}
                  className="w-full border border-brand-secondary hover:border-zinc-700 hover:bg-zinc-900 text-zinc-400 hover:text-white text-xs font-mono py-2.5 rounded-lg transition-all"
                >
                  Return to Portal Entry
                </button>
              </form>
            )}

            {/* Tab: Reset Password view */}
            {view === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5" id="reset-field-pwd">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-mono tracking-wider text-zinc-400 block">NEW PASSWORD</label>
                    <span className="text-[10px] font-mono text-zinc-500">
                      STRENGTH: <span className="font-bold text-white">{getPasswordStrength(newPassword).text}</span>
                    </span>
                  </div>
                  
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      type="password"
                      className="w-full bg-brand-bg border border-brand-secondary hover:border-zinc-700 focus:border-brand rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand/45 transition-all"
                      placeholder="Min. 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>

                  {/* Password strength bar */}
                  {newPassword && (
                    <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden mt-1 flex gap-0.5">
                      <div className={`h-full flex-1 transition-colors ${getPasswordStrength(newPassword).score >= 1 ? getPasswordStrength(newPassword).color : 'bg-zinc-850'}`} />
                      <div className={`h-full flex-1 transition-colors ${getPasswordStrength(newPassword).score >= 2 ? getPasswordStrength(newPassword).color : 'bg-zinc-850'}`} />
                      <div className={`h-full flex-1 transition-colors ${getPasswordStrength(newPassword).score >= 3 ? getPasswordStrength(newPassword).color : 'bg-zinc-850'}`} />
                      <div className={`h-full flex-1 transition-colors ${getPasswordStrength(newPassword).score >= 4 ? getPasswordStrength(newPassword).color : 'bg-zinc-850'}`} />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5" id="reset-field-pwd-confirm">
                  <label className="text-[11px] font-mono tracking-wider text-zinc-400 block">CONFIRM NEW PASSWORD</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      type="password"
                      className="w-full bg-brand-bg border border-brand-secondary hover:border-zinc-700 focus:border-brand rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand/45 transition-all"
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  id="reset-submit-btn"
                  type="submit"
                  disabled={loading || resetSuccess}
                  className="w-full mt-4 bg-[#A8CC00] hover:bg-[#BEE600] text-brand-bg transition-all font-semibold rounded-lg py-3 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-brand-bg border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Overwrite Ledger Password</span>
                  )}
                </button>
              </form>
            )}

          </div>

          {/* Secured platform credentials check */}
          <div className="text-center font-mono text-[10px] text-zinc-650">
            SYSTEM AUTHENTICATION CONTROL • END-TO-END TLS
          </div>

        </div>
      </div>
    </div>
  );
}
