import React from 'react';
import { MailCheck, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';

interface EmailConfirmedProps {
  onNavigate: (path: string) => void;
  isLoggedIn: boolean;
}

export function EmailConfirmed({ onNavigate, isLoggedIn }: EmailConfirmedProps) {
  return (
    <div className="min-h-screen bg-[#0F1115] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(168,204,0,0.06),rgba(0,0,0,0))]" />
      
      <div className="max-w-md w-full bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl relative z-10 text-center space-y-6">
        
        <div className="flex justify-center">
          <div className="p-4 bg-[#A8CC00]/10 border border-[#A8CC00]/30 rounded-full text-[#A8CC00] animate-bounce">
            <MailCheck size={32} />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-white">
            Email Confirmed!
          </h1>
          <p className="text-zinc-405 text-sm leading-relaxed max-w-sm mx-auto">
            Your credentials clearance has been checked and accepted. Your Union Ledger profile has been linked and validated.
          </p>
        </div>

        <div className="py-2 px-3 bg-zinc-800/30 rounded-2xl border border-zinc-800 flex items-center justify-center gap-2.5 max-w-xs mx-auto">
          <ShieldCheck size={14} className="text-[#A8CC00]" />
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold">Ledger Security Active</span>
        </div>

        <div className="space-y-3 pt-4">
          {isLoggedIn ? (
            <button
              onClick={() => onNavigate('/')}
              className="w-full bg-[#A8CC00] text-black hover:bg-[#bce600] font-black text-sm tracking-wide py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#A8CC00]/10"
            >
              <span>Continue to Dashboard</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => onNavigate('/')}
              className="w-full bg-[#A8CC00] text-black hover:bg-[#bce600] font-black text-sm tracking-wide py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#A8CC00]/10"
            >
              <span>Sign In to Your Workspace</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>

        <div className="border-t border-zinc-800/80 pt-4 text-[9px] font-mono text-zinc-500 uppercase tracking-wider flex items-center justify-center gap-1">
          <HelpCircle size={10} />
          <span>Need help? Contact support@unionledger.com</span>
        </div>

      </div>
    </div>
  );
}
