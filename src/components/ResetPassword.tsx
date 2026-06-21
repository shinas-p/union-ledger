import React, { useState } from 'react';
import { supabase, configLoadedPromise } from '../lib/supabase';
import { Key, Eye, EyeOff, Check, X, Shield, Loader2, RefreshCw } from 'lucide-react';

interface ResetPasswordProps {
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export function ResetPassword({ onNavigate, onLogout }: ResetPasswordProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Live password strength indicator
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

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('Please provide values for both password input fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify that the passwords are identical.');
      return;
    }

    if (strength.score < 2) {
      setError('Proposed password is weak. Please include letters, numbers, and symbols.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await configLoadedPromise;
      console.log('[RESET PASSWORD] Directing password update query to Supabase Auth...');
      
      const { data, error: updateErr } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateErr) {
        throw updateErr;
      }

      console.log('[RESET PASSWORD] Password updated successfully for user:', data.user?.email);
      setSuccess(true);
      
      // Clear token states locally to force re-verification upon next navigation
      localStorage.removeItem('ul_token');
      sessionStorage.removeItem('ul_token');
      onLogout();

      setTimeout(() => {
        onNavigate('/');
      }, 3000);

    } catch (err: any) {
      console.error('[RESET PASSWORD ERROR]', err);
      setError(err.message || 'Failed to update credentials. Please try requesting a new recovery link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      
      {/* Ambient backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(168,204,0,0.06),rgba(0,0,0,0))]" />
      
      <div className="max-w-md w-full bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 bg-zinc-800/40 border border-zinc-700/60 rounded-2xl">
              <Key size={24} className="text-[#A8CC00]" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-4">Reset Ledger Password</h1>
          <p className="text-zinc-400 text-xs leading-relaxed max-w-sm mx-auto">
            Choose a strong, complex credential password to authorize access to your organizations and financial audits.
          </p>
        </div>

        {success ? (
          <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center space-y-4 animate-fade-in">
            <div className="flex justify-center">
              <div className="w-10 h-10 bg-[#A8CC00]/10 rounded-full flex items-center justify-center text-[#A8CC00]">
                <Check size={20} />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-white text-md">Credential Updated!</h3>
              <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">
                Your new security password is live. Redirecting you to the landing portal to sign in...
              </p>
            </div>
            <div className="flex justify-center">
              <Loader2 className="w-5 h-5 text-[#A8CC00] animate-spin" />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {error && (
              <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
                <X size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-mono text-zinc-450 uppercase tracking-wider font-bold block">
                New Security Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-zinc-800/40 border border-zinc-700 hover:border-zinc-600 focus:border-[#A8CC00] focus:ring-1 focus:ring-[#A8CC00] rounded-xl px-3.5 py-2.5 text-sm transition-all text-white outline-none pl-10 pr-10"
                />
                <Key size={14} className="absolute left-3.5 top-3.5 text-zinc-500" />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-3 text-zinc-500 hover:text-white cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Strength display */}
              {newPassword && (
                <div className="space-y-1.5 pt-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500 font-mono uppercase">Strength Clearance:</span>
                    <span className="font-bold border border-zinc-700/60 bg-zinc-800/40 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
                      {strength.text}
                    </span>
                  </div>
                  <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${strength.color}`} 
                      style={{ width: `${(strength.score / 4) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-450 uppercase tracking-wider font-bold block">
                Confirm Security Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-zinc-800/40 border border-zinc-700 hover:border-zinc-600 focus:border-[#A8CC00] focus:ring-1 focus:ring-[#A8CC00] rounded-xl px-3.5 py-2.5 text-sm transition-all text-white outline-none pl-10"
                />
                <Key size={14} className="absolute left-3.5 top-3.5 text-zinc-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#A8CC00] text-black hover:bg-[#bce600] disabled:bg-zinc-800 disabled:text-zinc-500 font-black text-sm tracking-wide py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#A8CC00]/10 mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Configuring clearance...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Update & Set Password</span>
                </>
              )}
            </button>

          </form>
        )}

        <div className="border-t border-zinc-800/80 pt-4 text-[10px] font-mono text-zinc-500 uppercase tracking-wider flex items-center justify-center gap-1">
          <Shield size={11} className="text-zinc-500/70" />
          <span>FIPS 140-2 Compliant Gateway</span>
        </div>

      </div>
    </div>
  );
}
