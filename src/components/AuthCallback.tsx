import React, { useEffect, useState } from 'react';
import { supabase, configLoadedPromise } from '../lib/supabase';
import { Loader2, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';

interface AuthCallbackProps {
  onNavigate: (path: string) => void;
  onLoginSuccess: (token: string, user: any, role: string) => void;
}

export function AuthCallback({ onNavigate, onLoginSuccess }: AuthCallbackProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your credentials clearance...');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function handleCallback() {
      try {
        console.log('[AUTH CALLBACK] Awaiting database setup & supabase configuration...');
        await configLoadedPromise;

        // Parse search params & hash
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        // Gather variables from either query or hash
        const code = params.get('code') || hashParams.get('code');
        const token = params.get('token') || hashParams.get('token');
        const type = params.get('type') || hashParams.get('type');
        
        const accessToken = hashParams.get('access_token') || params.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || params.get('refresh_token');
        const errorMsg = params.get('error_description') || params.get('error') || hashParams.get('error_description') || hashParams.get('error');

        console.log('[AUTH CALLBACK] Received params:', {
          hasCode: !!code,
          hasToken: !!token,
          type,
          hasAccessToken: !!accessToken,
          errorMsg
        });

        if (errorMsg) {
          throw new Error(errorMsg);
        }

        // 1. PKCE Auth Code flow support
        if (code) {
          setMessage('Exchanging authorization code for an active session...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          
          if (data && data.session) {
            const session = data.session;
            const detectedType = type || 'signup';
            
            // Handshake api/auth/me to sync databases
            await syncLocalSession(session.access_token, detectedType);
            return;
          }
        }

        // 2. Implicit Hash flow support (typical fallback for standard mail provider templates)
        if (accessToken) {
          setMessage('Applying secure access tokens to the local sandbox...');
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          });
          if (error) throw error;

          if (data && data.session) {
            const session = data.session;
            const detectedType = type || 'signup';
            
            await syncLocalSession(session.access_token, detectedType);
            return;
          }
        }

        // 3. Fallback: Check if we already have an active session in local storage or current client
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('[AUTH CALLBACK] Active session found in current context. Syncing...');
          await syncLocalSession(session.access_token, type || 'signup');
          return;
        }

        // If no code, token, or session exists
        throw new Error('No valid authentication token or session found.');

      } catch (err: any) {
        console.error('[AUTH CALLBACK ERROR]', err);
        if (active) {
          setStatus('error');
          setMessage('Authentication callback validation failed.');
          setErrorDetails(err.message || 'The token may be invalid, expired, or already used.');
        }
      }
    }

    async function syncLocalSession(accessToken: string, flowType: string) {
      try {
        const meRes = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!meRes.ok) {
          const meData = await meRes.json();
          throw new Error(meData.error || 'Failed to sync authentication profile with server ledger.');
        }

        const meData = await meRes.json();
        console.log('[AUTH CALLBACK] Connected successfully. Profile verified:', meData);

        // Store tokens
        localStorage.setItem('ul_token', accessToken);
        onLoginSuccess(accessToken, meData.user, meData.role);

        if (!active) return;
        setStatus('success');

        // Choose appropriate route landing
        if (flowType === 'recovery') {
          setMessage('Credentials cleared. Redirecting you to set a new password...');
          setTimeout(() => {
            onNavigate('/reset-password');
          }, 1500);
        } else {
          setMessage('Email clearance confirmed. Landing you safely at verification portal...');
          setTimeout(() => {
            onNavigate('/email-confirmed');
          }, 1500);
        }

      } catch (err: any) {
        console.error('[AUTH CALLBACK SYNC ERROR]', err);
        if (active) {
          setStatus('error');
          setMessage('Server Profile Handshake Failed.');
          setErrorDetails(err.message || 'Unable to cache organization role context.');
        }
      }
    }

    handleCallback();

    return () => {
      active = false;
    };
  }, [onNavigate, onLoginSuccess]);

  return (
    <div className="min-h-screen bg-[#0F1115] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(168,204,0,0.06),rgba(0,0,0,0))]" />
      
      <div className="max-w-md w-full bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl relative z-10 text-center space-y-6">
        
        <div className="flex justify-center">
          <div className="p-3 bg-zinc-800/40 border border-zinc-700/60 rounded-2xl relative">
            <Sparkles size={24} className="text-[#A8CC00] animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-white flex justify-center items-center gap-2">
            <span>Union Ledger Auth</span>
            <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded-full font-mono text-zinc-400 border border-zinc-700">Callback</span>
          </h1>
          <p className="text-zinc-400 text-sm">{message}</p>
        </div>

        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <Loader2 className="w-8 h-8 text-[#A8CC00] animate-spin" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Awaiting Verification Clearance</span>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <div className="p-2 bg-[#A8CC00]/10 rounded-full">
              <ShieldCheck className="w-8 h-8 text-[#A8CC00]" />
            </div>
            <span className="text-[10px] font-mono text-[#A8CC00] uppercase tracking-widest font-bold">Clearance Confirmed</span>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 py-2">
            <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-2xl flex items-start gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-red-200">Processing Interrupted</h4>
                <p className="text-xs text-red-405/80 mt-1">{errorDetails}</p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('/')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer"
            >
              Return to Landing Portal
            </button>
          </div>
        )}

        <div className="border-t border-zinc-800/80 pt-4 text-[10px] font-mono text-zinc-500 flex items-center justify-center gap-1.5 uppercase tracking-wider">
          <span>Union Ledger Secure Gateway</span>
        </div>

      </div>
    </div>
  );
}
