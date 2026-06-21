/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building, 
  ChevronDown, 
  Layers, 
  LogOut, 
  LayoutDashboard, 
  Coins, 
  Target, 
  Users, 
  Settings as SettingsIcon, 
  ScrollText, 
  Sparkles, 
  ExternalLink,
  PlusCircle,
  Hash,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  Globe,
  Bell,
  RefreshCw,
  LogIn,
  Link,
  Eye,
  Info,
  X
} from 'lucide-react';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { Campaigns } from './components/Campaigns';
import { Members } from './components/Members';
import { Audits } from './components/Audits';
import { Settings as SettingsComponent } from './components/Settings';
import { PublicTransparency } from './components/PublicTransparency';
import { NotificationCenter } from './components/NotificationCenter';
import { AuthCallback } from './components/AuthCallback';
import { EmailConfirmed } from './components/EmailConfirmed';
import { ResetPassword } from './components/ResetPassword';
import { UserProfile, Organization, UserRole } from './types';
import { supabase, configLoadedPromise } from './lib/supabase';

export default function App() {
  
  // Auth state
  const [token, setToken] = useState<string>(() => localStorage.getItem('ul_token') || sessionStorage.getItem('ul_token') || '');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>('Viewer');
  const [status, setStatus] = useState<'Active' | 'Suspended'>('Active');

  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'campaigns' | 'members' | 'audits' | 'settings'>('dashboard');
  const [publicPortalSlug, setPublicPortalSlug] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // Popstate state history routing
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    setCurrentPath(path);
  };

  // Lists state
  const [orgs, setOrgs] = useState<any[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [transactions, setTransactions] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [audits, setAudits] = useState([]);

  // Swapper modals
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [isJoinOrgOpen, setIsJoinOrgOpen] = useState(false);

  // Modals form state
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgCurrency, setNewOrgCurrency] = useState('INR');
  const [newOrgLogo, setNewOrgLogo] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Trigger state refreshes
  const [refreshToggle, setRefreshToggle] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  // -------------------------------------------------------------------
  // INITIAL MOUNT PARAMS ROUTING & INVITE LINK RESOLUTION
  // -------------------------------------------------------------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const portal = params.get('portal');
    if (portal) {
      setPublicPortalSlug(portal);
    }

    // Capture dynamic invite codes (e.g. /join?code=AUDITOR-XXXX or /?code=AUDITOR-XXXX)
    const urlCode = params.get('code') || params.get('join');
    if (urlCode) {
      const cleanCode = urlCode.toUpperCase().trim();
      setJoinCodeInput(cleanCode);
      sessionStorage.setItem('pending_join_code', cleanCode);
      setIsJoinOrgOpen(true);

      // Clean the URL parameters so they do not open on subsequent manual refreshes
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState(null, '', cleanUrl);
    }
  }, []);

  // Track session loading state to pop the pending join modal once authenticated
  useEffect(() => {
    if (token) {
      const pendingCode = sessionStorage.getItem('pending_join_code');
      if (pendingCode) {
        setJoinCodeInput(pendingCode);
        setIsJoinOrgOpen(true);
        sessionStorage.removeItem('pending_join_code');
      }
    }
  }, [token]);

  // Handle Supabase Auth Events: SIGNED_IN, PASSWORD_RECOVERY, USER_UPDATED, TOKEN_REFRESHED
  useEffect(() => {
    let sub: any = null;

    async function setupAuthChange() {
      try {
        await configLoadedPromise;
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log(`[SUPABASE AUTH EVENT] Detected event: ${event}`, session?.user?.id);
          
          if (event === 'SIGNED_IN') {
            if (session) {
              const activeToken = session.access_token;
              setToken(activeToken);
              localStorage.setItem('ul_token', activeToken);
              
              // Sync user profile state
              try {
                const res = await fetch('/api/auth/me', {
                  headers: { 'Authorization': `Bearer ${activeToken}` }
                });
                if (res.ok) {
                  const val = await res.json();
                  setUser(val.user);
                  setRole(val.role);
                  setStatus(val.status);
                }
              } catch (err) {
                console.error('[AUTH EVENT] Profile sync failed during SIGNED_IN:', err);
              }
            }
          } else if (event === 'PASSWORD_RECOVERY') {
            console.log('[SUPABASE AUTH EVENT] Password recovery mode active. Routing to reset.');
            navigateTo('/reset-password');
          } else if (event === 'USER_UPDATED') {
            console.log('[SUPABASE AUTH EVENT] User credentials updated successfully.');
          } else if (event === 'TOKEN_REFRESHED') {
            if (session) {
              const activeToken = session.access_token;
              setToken(activeToken);
              localStorage.setItem('ul_token', activeToken);
            }
          }
        });
        sub = data.subscription;
      } catch (err) {
        console.warn('[AUTH EVENTS] Failed to listen to Supabase state change:', err);
      }
    }

    setupAuthChange();

    return () => {
      if (sub) {
        try {
          sub.unsubscribe();
        } catch (e) {
          console.warn('[AUTH EVENTS] Unsubscription failed:', e);
        }
      }
    };
  }, []);

  // -------------------------------------------------------------------
  // SESSION RECOVERY ENGINES
  // -------------------------------------------------------------------
  const checkSession = async () => {
    try {
      await configLoadedPromise;
    } catch (e) {
      console.warn('[AUTH SESSION] Failed waiting for Supabase credentials configuration:', e);
    }

    let activeToken = token;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        activeToken = session.access_token;
        if (activeToken !== token) {
          setToken(activeToken);
          localStorage.setItem('ul_token', activeToken);
        }
      }
    } catch (e) {
      console.warn('[AUTH SESSION] Supabase session retrieval error:', e);
    }

    if (!activeToken) {
      setAuthChecking(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      if (res.ok) {
        const val = await res.json();
        setUser(val.user);
        setRole(val.role);
        setStatus(val.status);

        // Fetch User Orgs
        const orgRes = await fetch('/api/orgs', {
          headers: { 'Authorization': `Bearer ${activeToken}` }
        });
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          setOrgs(orgData.organizations || []);

          // Find current active org
          const activeOrgId = val.user.lastActiveOrgId;
          const found = orgData.organizations.find((o: any) => o.id === activeOrgId);
          if (found) {
            setCurrentOrg(found);
          } else if (orgData.organizations.length > 0) {
            setCurrentOrg(orgData.organizations[0]);
          }
        }
      } else {
        // Bad session, clear local config
        localStorage.removeItem('ul_token');
        sessionStorage.removeItem('ul_token');
        setToken('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, [token, refreshToggle]);

  // -------------------------------------------------------------------
  // DATA SNAPSHOT REFRESHERS
  // -------------------------------------------------------------------
  const loadLedgerData = async () => {
    if (!token || !currentOrg) return;

    try {
      // 1. Fetch transactions
      const txRes = await fetch('/api/transactions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.transactions || []);
      }

      // 2. Fetch campaigns
      const fcRes = await fetch('/api/campaigns', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (fcRes.ok) {
        const fcData = await fcRes.json();
        setCampaigns(fcData.campaigns || []);
      }

      // 3. Fetch audits log
      const adRes = await fetch('/api/audits', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (adRes.ok) {
        const adData = await adRes.json();
        setAudits(adData.audits || []);
      }
    } catch (err) {
      console.error('Error fetching snapshot from database', err);
    }
  };

  useEffect(() => {
    loadLedgerData();
  }, [token, currentOrg, refreshToggle]);

  // -------------------------------------------------------------------
  // MUTATIONS HANDLERS
  // -------------------------------------------------------------------
  const handleLoginSuccess = (newToken: string, newUser: UserProfile, newRole: UserRole) => {
    localStorage.setItem('ul_token', newToken);
    setToken(newToken);
    setUser(newUser);
    setRole(newRole);
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    try {
      if (user) {
        await fetch('/api/auth/log-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            action: 'logout',
            details: `User with email "${user.email}" completed signout.`
          })
        });
      }
    } catch (e) {
      console.warn('Logging signout event status failed:', e);
    }
    await supabase.auth.signOut();
    localStorage.removeItem('ul_token');
    sessionStorage.removeItem('ul_token');
    setToken('');
    setUser(null);
    setCurrentOrg(null);
  };

  const handleSwitchOrg = async (orgId: string) => {
    setIsSwitcherOpen(false);
    try {
      const res = await fetch('/api/orgs/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orgId })
      });
      if (res.ok) {
        setRefreshToggle(p => !p);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newOrgName,
          currency: newOrgCurrency,
          logoUrl: newOrgLogo || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIsCreateOrgOpen(false);
      setNewOrgName('');
      setNewOrgLogo('');
      setRefreshToggle(p => !p);
    } catch (err: any) {
      setCreateError(err.message);
    }
  };

  const handleJoinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setJoinSuccess(null);
    try {
      const res = await fetch('/api/orgs/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: joinCodeInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Join workspace request failed.');

      setJoinSuccess(data.message || 'Joined organization successfully!');
      setJoinCodeInput('');
      setTimeout(() => {
        setIsJoinOrgOpen(false);
        setJoinSuccess(null);
        setRefreshToggle(p => !p);
      }, 1500);
    } catch (err: any) {
      setJoinError(err.message);
    }
  };

  const handleApproveTransaction = async (txId: string, finalStatus: 'Approved' | 'Rejected') => {
    try {
      const res = await fetch('/api/transactions/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transactionId: txId, status: finalStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        return;
      }
      setRefreshToggle(p => !p);
    } catch (err) {
      console.error(err);
    }
  };

  // -------------------------------------------------------------------
  // MAIN ROUTE RENDERING
  // -------------------------------------------------------------------
  if (currentPath === '/auth/callback') {
    return (
      <AuthCallback 
        onNavigate={navigateTo} 
        onLoginSuccess={(newToken, newUser, newRole) => {
          localStorage.setItem('ul_token', newToken);
          setToken(newToken);
          setUser(newUser);
          setRole(newRole as UserRole);
        }} 
      />
    );
  }

  if (currentPath === '/email-confirmed') {
    return (
      <EmailConfirmed 
        onNavigate={navigateTo} 
        isLoggedIn={!!token} 
      />
    );
  }

  if (currentPath === '/reset-password') {
    return (
      <ResetPassword 
        onNavigate={navigateTo} 
        onLogout={() => {
          setToken('');
          setUser(null);
          setCurrentOrg(null);
        }} 
      />
    );
  }

  if (publicPortalSlug) {
    return (
      <PublicTransparency 
        slug={publicPortalSlug} 
        onClose={token ? () => setPublicPortalSlug(null) : undefined} 
      />
    );
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-brand-bg text-white flex flex-col items-center justify-center p-8">
        <span className="w-10 h-10 border-4 border-brand border-t-white rounded-full animate-spin mb-4" />
        <p className="font-mono text-xs tracking-widest text-[#A8CC00] uppercase font-bold">Checking Credentials clearance...</p>
      </div>
    );
  }

  if (!token) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  // Sidebar components links list
  const navLinks = [
    { id: 'dashboard', label: 'Overview Panel', icon: LayoutDashboard },
    { id: 'transactions', label: 'Ledger Registry', icon: Coins },
    { id: 'campaigns', label: 'Funds & Campaigns', icon: Target },
    { id: 'members', label: 'Roster Directory', icon: Users },
    { id: 'audits', label: 'Audit Trail logs', icon: ScrollText },
    { id: 'settings', label: 'Workspace Config', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#0F1115] text-white font-sans flex flex-col" id="app-viewport">
      
      {/* Upper Navigation Bar */}
      <header className="bg-brand-surface border-b border-brand-secondary/70 h-16 sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between" id="app-shell-header">
        
        {/* Left Switcher section */}
        <div className="flex items-center gap-4">
          <div className="relative" id="org-switcher-control">
            <button
              id="switch-workspace-btn"
              onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-bg hover:bg-brand-secondary border border-zinc-805 hover:border-zinc-700 transition-all text-left cursor-pointer"
            >
              {currentOrg ? (
                <>
                  <img
                    src={currentOrg.logoUrl || `https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=80`}
                    alt="Active Org"
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded object-cover border border-zinc-800 bg-zinc-800"
                  />
                  <div>
                    <span className="text-white text-xs font-semibold block leading-tight max-w-[130px] truncate">{currentOrg.name}</span>
                    <span className="text-[9px] font-mono text-brand font-bold tracking-wider leading-none block uppercase">{role}</span>
                  </div>
                </>
              ) : (
                <span className="text-xs font-mono text-zinc-500">Workspace Selection</span>
              )}
              <ChevronDown size={12} className="text-zinc-500 mt-0.5" />
            </button>

            {isSwitcherOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSwitcherOpen(false)} />
                
                <div className="absolute left-0 mt-2 w-64 bg-brand-surface border border-brand-secondary rounded-2xl shadow-xl shadow-black/80 z-50 p-2 space-y-1.5 animate-scale-up" id="switcher-panel">
                  <div className="px-3 py-1 bg-brand-bg font-mono text-[9px] text-zinc-500 rounded font-bold uppercase tracking-wider">
                    Associated Workspaces
                  </div>
                  
                  <div className="space-y-1 max-h-48 overflow-y-auto" id="switcher-items-list">
                    {orgs.map((o) => (
                      <button
                        id={`switch-org-${o.id}`}
                        key={o.id}
                        onClick={() => handleSwitchOrg(o.id)}
                        className={`w-full text-left p-2 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer ${o.id === currentOrg?.id ? 'bg-[#D6FF20]/5 border border-[#D6FF20]/20' : 'hover:bg-brand-secondary'}`}
                      >
                        <img
                          src={o.logoUrl}
                          alt="sw"
                          className="w-5 h-5 rounded object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-white text-xs font-semibold block truncate leading-tight">{o.name}</span>
                          <span className="text-[8px] font-mono tracking-wide text-zinc-400 block leading-none">{o.userRole} clearance</span>
                        </div>
                        {o.id === currentOrg?.id && <CheckCircle size={12} className="text-brand shrink-0" />}
                      </button>
                    ))}
                  </div>

                  <div className="bg-zinc-950 p-2 rounded-xl space-y-1" id="switcher-addorgs-actions">
                    <button
                      id="org-switcher-join"
                      onClick={() => { setIsSwitcherOpen(false); setIsJoinOrgOpen(true); }}
                      className="w-full text-left text-[11px] font-mono text-zinc-300 hover:text-brand flex items-center gap-1.5 py-1 px-1.5 cursor-pointer"
                    >
                      <Link size={10} />
                      <span>Join Workspace with Code</span>
                    </button>
                    <button
                      id="org-switcher-create"
                      onClick={() => { setIsSwitcherOpen(false); setIsCreateOrgOpen(true); }}
                      className="w-full text-left text-[11px] font-mono text-zinc-300 hover:text-brand flex items-center gap-1.5 py-1 px-1.5 cursor-pointer"
                    >
                      <PlusCircle size={10} />
                      <span>Register New Workspace</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Slogan details on desktop */}
          <div className="hidden lg:flex items-center gap-2 border-l border-brand-secondary pl-4 py-1">
            <span className="font-sans font-black tracking-tighter text-sm">UNION LEDGER</span>
            <span className="text-zinc-700 font-mono">•</span>
            <span className="text-[9px] text-[#A8CC00] font-mono uppercase tracking-widest font-black">SECURE AUDITING v2.4</span>
          </div>
        </div>

        {/* Right side : NotificationTray, public audits view triggers + Logouts */}
        <div className="flex items-center gap-3">
          
          {/* Quick Transparency preview */}
          {currentOrg && (
            <button
              id="header-transparency-portal-trigger"
              onClick={() => setPublicPortalSlug(currentOrg.slug)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#D6FF20]/10 hover:bg-[#D6FF20]/15 border border-[#D6FF20]/25 rounded-xl text-[10px] font-mono font-bold text-brand cursor-pointer"
              title="Preview public transparent layout"
            >
              <Globe size={11} className="animate-spin-slow" />
              <span>Public Audit board</span>
            </button>
          )}

          {/* Custom persistent Notification bells */}
          {token && (
            <NotificationCenter token={token} refreshToggle={refreshToggle} />
          )}

          {/* Profile details + Logouts */}
          {user && (
            <div className="flex items-center gap-2 border-l border-brand-secondary pl-3" id="header-user-badge">
              <img
                src={user.avatarUrl || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80`}
                alt="Profile avatar"
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full border border-zinc-800 bg-zinc-800"
              />
              <div className="hidden md:block text-left">
                <span className="text-white text-xs font-semibold block leading-tight">{user.name}</span>
                <span className="text-zinc-500 font-mono text-[9px] block leading-none">{user.email}</span>
              </div>
              
              <button
                id="do-logout-action"
                onClick={handleLogout}
                className="p-2 text-zinc-500 hover:text-[#D6FF20] transition-colors rounded-xl hover:bg-brand-secondary cursor-pointer border border-transparent hover:border-zinc-800 ml-1"
                title="Sign out of ledger session"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}

        </div>
      </header>      {/* Main Structural Frame contains Sidebar & Content wrapper */}
      <div className="flex-1 flex flex-col md:flex-row" id="app-shell-body">
        
        {/* Sidebar Frame */}
        <aside className="w-full md:w-64 bg-[#161A20] border-r border-white/10 p-4 shrink-0 flex flex-col justify-between" id="sidebar-navigator-bar">
          <div className="space-y-6">
            <div className="px-3">
              <span className="text-[10px] font-mono font-black text-[#D6FF20] uppercase tracking-widest block">
                MAIN NAVIGATION
              </span>
              <p className="text-[9px] text-[#A8CC00] font-mono leading-none mt-1">governance metrics</p>
            </div>

            {/* Nav anchors list mapper */}
            <nav className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = activeTab === link.id;
                return (
                  <button
                    id={`nav-${link.id}`}
                    key={link.id}
                    onClick={() => setActiveTab(link.id as any)}
                    className={`w-full flex items-center gap-2.5 py-2 px-3 rounded-md text-xs font-semibold uppercase tracking-wider transition-all text-left cursor-pointer ${
                      isActive 
                        ? 'bg-[#D6FF20]/10 text-[#D6FF20] font-bold border border-[#D6FF20]/20' 
                        : 'text-[#A1A1AA] hover:text-white hover:bg-[#1B2028]/60 border border-transparent'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-[#D6FF20]' : 'bg-transparent'}`} />
                    <Icon size={13} className={isActive ? 'text-[#D6FF20]' : ''} />
                    <span>{link.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer details */}
          <div className="hidden md:block p-3.5 bg-[#0F1115]/50 rounded-lg border border-white/5 mt-6 text-left space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#D6FF20]">
              <ShieldCheck size={11} />
              <span>STRICT RLS COMPLIANT</span>
            </div>
            <p className="text-[9px] text-zinc-500 leading-normal font-mono">
              Workspace isolations active. Operations timestamped cryptographically.
            </p>
          </div>
        </aside>

        {/* Content viewport area */}
        <main className="flex-1 bg-[#0F1115] flex flex-col overflow-hidden" id="main-content-viewport">
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            {!currentOrg ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#161A20] border border-white/5 rounded-lg">
                <Layers size={40} className="text-[#D6FF20] mb-3 animate-pulse" />
                <h3 className="text-base font-bold text-white leading-tight">Registry Context Missing</h3>
                <p className="text-xs text-zinc-400 max-w-sm mt-1 mb-4 leading-normal">
                  You do not belong to any active organizations. Join Malkangiri using join codes or register your customized community organization workspace to boot the ledger.
                </p>
                
                <div className="flex gap-2">
                  <button
                    id="empty-join-org"
                    onClick={() => setIsJoinOrgOpen(true)}
                    className="px-4 py-2 bg-[#D6FF20] text-[#0F1115] font-bold text-xs uppercase rounded hover:bg-[#C5F000] cursor-pointer transition-colors"
                  >
                    Join Workspace with Code
                  </button>
                  <button
                    id="empty-create-org"
                    onClick={() => setIsCreateOrgOpen(true)}
                    className="px-4 py-2 bg-[#1B2028] border border-white/10 hover:bg-zinc-800 text-white font-semibold text-xs rounded cursor-pointer transition-colors"
                  >
                    Register Organization
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Suspended user warning overlay */}
                {status === 'Suspended' && (
                  <div className="mb-6 bg-red-955/20 border border-red-900 text-rose-300 text-xs p-4 rounded-lg flex gap-3 items-center">
                    <Info size={18} className="text-rose-400 font-bold" />
                    <div>
                      <span className="font-bold block">🚨 Workspace Account Suspended</span>
                      <p className="text-[11px] text-rose-400">An administrator has suspended your credentials. Your access clearance is locked to Viewer (read-only) operations.</p>
                    </div>
                  </div>
                )}

              {/* Render dynamic tab modules */}
              <div className="animate-fade-in text-left">
                {activeTab === 'dashboard' && (
                  <Dashboard
                    transactions={transactions}
                    campaigns={campaigns}
                    audits={audits}
                    currency={currentOrg.currency}
                    role={status === 'Suspended' ? 'Viewer (Suspended)' : role}
                    onNavigate={setActiveTab}
                    onApproveTransaction={handleApproveTransaction}
                    onOpenPublicTransparency={() => setPublicPortalSlug(currentOrg.slug)}
                    orgSlug={currentOrg.slug}
                  />
                )}

                {activeTab === 'transactions' && (
                  <Transactions
                    transactions={transactions}
                    campaigns={campaigns}
                    currency={currentOrg.currency}
                    role={status === 'Suspended' ? 'Viewer' : role}
                    token={token}
                    onRefresh={() => setRefreshToggle(p => !p)}
                    onApproveTransaction={handleApproveTransaction}
                  />
                )}

                {activeTab === 'campaigns' && (
                  <Campaigns
                    campaigns={campaigns}
                    transactions={transactions}
                    currency={currentOrg.currency}
                    role={status === 'Suspended' ? 'Viewer' : role}
                    token={token}
                    onRefresh={() => setRefreshToggle(p => !p)}
                  />
                )}

                {activeTab === 'members' && (
                  <Members
                    token={token}
                    role={role}
                    orgName={currentOrg.name}
                    onRefresh={() => setRefreshToggle(p => !p)}
                  />
                )}

                {activeTab === 'audits' && (
                  <Audits token={token} />
                )}

                {activeTab === 'settings' && (
                  <SettingsComponent
                    token={token}
                    user={user}
                    role={role}
                    org={currentOrg}
                    onRefresh={() => setRefreshToggle(p => !p)}
                    onLogout={handleLogout}
                  />
                )}
              </div>
            </>
          )}
          </div>
          {currentOrg && (
            <footer className="h-10 bg-[#161A20] border-t border-white/10 flex items-center justify-between px-6 shrink-0 text-[10px] text-[#A1A1AA] font-mono tracking-tighter">
              <div className="flex gap-6">
                <span>NODE: ASIA-SOUTH-1</span>
                <span>DB: POSTGRES-RLS-ENFORCED</span>
                <span>TLS: 1.3 SECURE</span>
              </div>
              <div className="flex gap-4 font-bold uppercase">
                <span className="text-[#D6FF20]">TRANSPARENCY MODE: ACTIVE</span>
                <span className="opacity-50">CURRENCY: {currentOrg.currency}</span>
              </div>
            </footer>
          )}
        </main>

      </div>

      {/* -------------------------------------------------------------------
          MODALS INTEGRATION (CREATES & JOIN ORGS)
          ------------------------------------------------------------------- */}

      {/* Modal: Create Org */}
      {isCreateOrgOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in" id="create-org-modal">
          <div className="bg-[#161A20] border border-zinc-850 max-w-md w-full rounded-2xl overflow-hidden shadow-2xl relative text-left">
            <div className="p-5 bg-brand-secondary border-b border-zinc-850 flex justify-between items-center">
              <h3 className="font-sans font-bold text-sm text-white flex items-center gap-1">
                <Building size={15} className="text-brand" />
                <span>Register Workspace Organization</span>
              </h3>
              <button
                id="close-create-org-btn"
                onClick={() => setIsCreateOrgOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {createError && (
              <div className="m-4 bg-rose-950/40 border border-rose-900 text-rose-200 text-xs p-3 rounded-lg">
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateOrg} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">Group / Organization Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Malkangiri Labour Association"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">Base Valuation Currency</label>
                <select
                  value={newOrgCurrency}
                  onChange={(e) => setNewOrgCurrency(e.target.value)}
                  className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-zinc-400 focus:outline-none cursor-pointer"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED (د.إ)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-semibold">Branding logo image URL</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={newOrgLogo}
                  onChange={(e) => setNewOrgLogo(e.target.value)}
                  className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              <div className="p-3 bg-brand-secondary text-[10px] text-zinc-400 rounded-lg text-left leading-normal">
                ✔ As creator, your account profile will automatically be assigned Owner Admin clearance over this ledger.
              </div>

              <button
                id="submit-register-org-btn"
                type="submit"
                className="w-full py-3 bg-brand hover:bg-brand-hover text-brand-bg font-bold text-xs rounded-xl cursor-pointer hover:scale-[1.01] transition-all"
              >
                Register & Boot Organization Workspace
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Join Org */}
      {isJoinOrgOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in" id="join-org-modal">
          <div className="bg-[#161A20] border border-zinc-850 max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl relative text-left">
            <div className="p-5 bg-brand-secondary border-b border-zinc-850 flex justify-between items-center">
              <h3 className="font-sans font-bold text-sm text-white flex items-center gap-1.5">
                <Link size={14} className="text-brand" />
                <span>Join Workspace via Code</span>
              </h3>
              <button
                id="close-join-org-btn"
                onClick={() => setIsJoinOrgOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {joinError && (
              <div className="m-4 bg-rose-950/40 border border-rose-900 text-rose-200 text-xs p-3 rounded-lg flex items-center gap-1">
                <Info size={14} />
                <span>{joinError}</span>
              </div>
            )}

            {joinSuccess && (
              <div className="m-4 bg-emerald-950/40 border border-emerald-950 text-emerald-100 text-xs p-3 rounded-lg flex items-center gap-1">
                <CheckCircle size={14} />
                <span>{joinSuccess}</span>
              </div>
            )}

            <form onSubmit={handleJoinOrg} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">Workspace invite Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIEWER2026 or AUDITOR-X9Y1"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none font-mono text-center uppercase tracking-wider"
                />
              </div>

              <div className="text-[10px] text-zinc-500 leading-normal bg-zinc-950 p-2.5 rounded-xl border border-zinc-900 border-dashed">
                Type VIEWER2026, AUDITOR2026, TREASURER2026, or ADMIN2026 to immediately test the respective preloaded team clearances.
              </div>

              <button
                id="submit-join-org-btn"
                type="submit"
                className="w-full py-2.5 bg-brand hover:bg-brand-hover text-brand-bg font-bold text-xs rounded-xl cursor-pointer hover:scale-[1.01] transition-all"
              >
                Join Organization Workspace
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
