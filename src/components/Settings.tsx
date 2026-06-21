/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  User, 
  Settings as SettingsIcon, 
  Trash2, 
  ShieldAlert, 
  Coins, 
  Bell, 
  Check, 
  AlertTriangle,
  Info,
  Building,
  Upload,
  UserX,
  CreditCard
} from 'lucide-react';
import { UserProfile, Organization, CURRENCY_SYMBOLS, OrganizationCurrency, UserRole } from '../types';

interface SettingsProps {
  token: string;
  user: UserProfile;
  role: UserRole;
  org: Organization;
  onRefresh: () => void;
  onLogout: () => void;
}

export function Settings({ 
  token, 
  user, 
  role, 
  org, 
  onRefresh, 
  onLogout 
}: SettingsProps) {

  // Form Profile State
  const [profileName, setProfileName] = useState(user.name);
  const [profileAvatar, setProfileAvatar] = useState(user.avatarUrl || '');
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Form Org State
  const [orgName, setOrgName] = useState(org.name);
  const [orgLogo, setOrgLogo] = useState(org.logoUrl || '');
  const [orgCurrency, setOrgCurrency] = useState<OrganizationCurrency>(org.currency);
  const [orgSuccess, setOrgSuccess] = useState<string | null>(null);

  // Notification switches
  const [notifPreferences, setNotifPreferences] = useState({
    transactionEvents: true,
    memberActivities: true,
    campaignUpdates: true,
    whatsappAlerts: false
  });

  // Account Scrub State
  const [scrubPassword, setScrubPassword] = useState('');
  const [scrubConfirmText, setScrubConfirmText] = useState('');
  const [scrubError, setScrubError] = useState<string | null>(null);
  const [scrubSuccess, setScrubSuccess] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  // Currency select list
  const currenciesList: { code: OrganizationCurrency, name: string }[] = [
    { code: 'INR', name: 'INR (₹ - Indian Rupee)' },
    { code: 'USD', name: 'USD ($ - United States Dollar)' },
    { code: 'EUR', name: 'EUR (€ - Euro Currency)' },
    { code: 'GBP', name: 'GBP (£ - Great Britain Pound)' },
    { code: 'AED', name: 'AED (د.إ - UAE Dirham)' }
  ];

  // Submit profile edit
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    try {
      const res = await fetch('/api/auth/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: profileName, avatarUrl: profileAvatar })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setProfileSuccess('Profile credentials updated successfully. Context saved.');
      setTimeout(() => setProfileSuccess(null), 3000);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit Org Edit
  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgSuccess(null);
    try {
      const res = await fetch('/api/orgs/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: orgName, logoUrl: orgLogo, currency: orgCurrency })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setOrgSuccess('Organization settings successfully verified and saved.');
      setTimeout(() => setOrgSuccess(null), 3000);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete User Account Completely
  const handleScrubAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setScrubError(null);
    setScrubSuccess(null);

    if (scrubConfirmText !== 'DELETE ACCOUNT') {
      setScrubError('Typed confirmation mismatch. Please type "DELETE ACCOUNT" (all capitals) exactly.');
      return;
    }

    if (!window.confirm('WARNING: Account deletion is irreversible! All your workspaces memberships will be revoked immediately. Proceed?')) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: scrubPassword, textConfirmation: scrubConfirmText })
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        throw new Error(data.error || 'Challenge authentication failed.');
      }

      setScrubSuccess('Account scrubbed successfully. Redirecting you to entry.');
      setTimeout(() => {
        onLogout();
      }, 2000);
    } catch (err: any) {
      setLoading(false);
      setScrubError(err.message);
    }
  };

  return (
    <div className="space-y-6 text-left" id="settings-view-workspace">
      
      {/* Settings Header banner */}
      <div className="bg-brand-surface border border-brand-secondary p-5 rounded-2xl">
        <h2 className="text-lg font-sans font-bold text-white flex items-center gap-2">
          <SettingsIcon size={18} className="text-brand" />
          <span>Workspace Parameters & Settings</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Control individual credentials, select central workspace transaction currencies, and audit access permissions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="settings-subgrid-panel">
        
        {/* Left column (8 span) : User Profiles + Organisation Config */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section: Profile Settings */}
          <div className="bg-brand-surface border border-brand-secondary p-6 rounded-2xl" id="profile-settings-card">
            <h3 className="text-xs font-bold font-mono text-[#D6FF20] uppercase tracking-wider mb-2 flex items-center gap-2">
              <User size={14} />
              <span>User account Profile</span>
            </h3>
            
            <p className="text-zinc-500 text-[11px] mb-4">
              Alter your name representation, upload avatar graphics, or verify central registration dates.
            </p>

            {profileSuccess && (
              <div id="profile-success-alert" className="mb-4 bg-emerald-950/40 border border-emerald-900 text-emerald-200 text-xs p-3 rounded-lg flex items-center gap-1.5 animate-pulse">
                <Check size={14} />
                <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Account Full Name</label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Avatar image URL (Unsplash/Gravatar)</label>
                  <input
                    type="url"
                    value={profileAvatar}
                    onChange={(e) => setProfileAvatar(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center bg-brand-bg/40 border border-zinc-900 p-3 rounded-xl">
                <span className="text-[10px] font-mono text-zinc-500">Registered joining date: {new Date(user.joinedAt).toLocaleDateString()}</span>
                <button
                  id="profile-save-btn"
                  type="submit"
                  className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-bg font-bold text-xs rounded-lg cursor-pointer transition-all"
                >
                  Save Profile details
                </button>
              </div>
            </form>
          </div>

          {/* Section: Organization parameters (Visible to ADMIN ONLY) */}
          <div className="bg-brand-surface border border-brand-secondary p-6 rounded-2xl" id="org-settings-card">
            <h3 className="text-xs font-bold font-mono text-[#D6FF20] uppercase tracking-wider mb-2 flex items-center gap-2">
              <Building size={14} />
              <span>Organization Workspace Config</span>
            </h3>

            <p className="text-zinc-500 text-[11px] mb-4">
              Administrators can configure the title, branding image, and primary currency settings.
            </p>

            {role !== 'Admin' ? (
              <div className="p-4 bg-brand-bg/60 border border-zinc-805 rounded-xl text-center flex flex-col items-center justify-center gap-2">
                <Lock size={18} className="text-zinc-650" />
                <p className="text-zinc-500 text-[11px] font-mono font-bold leading-none">Administrative Clearance Locked</p>
                <p className="text-zinc-600 text-[10px]">Only workspace administrators can adjust central organization currencies.</p>
              </div>
            ) : (
              <form onSubmit={handleOrgSubmit} className="space-y-4">
                {orgSuccess && (
                  <div id="org-success-alert" className="mb-4 bg-emerald-950/40 border border-emerald-900 text-emerald-200 text-xs p-3 rounded-lg flex items-center gap-1.5 animate-pulse">
                    <Check size={14} />
                    <span>{orgSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Group Title / Org Name</label>
                    <input
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Primary operating Currency Code</label>
                    <select
                      value={orgCurrency}
                      onChange={(e) => setOrgCurrency(e.target.value as OrganizationCurrency)}
                      className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                    >
                      {currenciesList.map((cur) => (
                        <option key={cur.code} value={cur.code}>{cur.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-mono">Branding logo image URL</label>
                  <input
                    type="url"
                    value={orgLogo}
                    onChange={(e) => setOrgLogo(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none"
                  />
                </div>

                <div className="flex justify-between items-center bg-brand-bg/40 border border-zinc-900 p-3 rounded-xl">
                  <span className="text-[10px] font-mono text-zinc-500">Public transparency Slug: /transparency/{org.slug}</span>
                  <button
                    id="org-save-btn"
                    type="submit"
                    className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-bg font-bold text-xs rounded-lg cursor-pointer transition-all"
                  >
                    Save Workspace config
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

        {/* Right column (4 span) : Notifications Preferences + Account Deletions */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Notification preferences */}
          <div className="bg-brand-surface border border-brand-secondary p-5 rounded-2xl" id="notif-settings-card">
            <h3 className="text-xs font-bold font-mono text-[#D6FF20] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Bell size={14} />
              <span>Alert Preferences</span>
            </h3>

            <div className="space-y-3" id="notif-switches-group">
              <div className="flex justify-between items-start text-xs bg-brand-bg/30 p-2 border border-zinc-90 w-full rounded border-zinc-900 leading-normal">
                <div>
                  <span className="text-white font-semibold block">Proposed items logging</span>
                  <p className="text-[10px] text-zinc-500 block">Alerts for inbound incomes/expenses propositions.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPreferences.transactionEvents}
                  onChange={(e) => setNotifPreferences({ ...notifPreferences, transactionEvents: e.target.checked })}
                  className="w-4 h-4 text-brand bg-zinc-800 rounded border-zinc-700 focus:ring-brand cursor-pointer mt-1"
                />
              </div>

              <div className="flex justify-between items-start text-xs bg-brand-bg/30 p-2 border border-zinc-90 w-full rounded border-zinc-900 leading-normal">
                <div>
                  <span className="text-white font-semibold block">Invite Join Actions</span>
                  <p className="text-[10px] text-zinc-500 block">Digests when new users register via links.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPreferences.memberActivities}
                  onChange={(e) => setNotifPreferences({ ...notifPreferences, memberActivities: e.target.checked })}
                  className="w-4 h-4 text-brand bg-zinc-800 rounded border-zinc-700 focus:ring-brand cursor-pointer mt-1"
                />
              </div>

              <div className="flex justify-between items-start text-xs bg-brand-bg/30 p-2 border border-zinc-90 w-full rounded border-zinc-900 leading-normal">
                <div>
                  <span className="text-white font-semibold block">Real-time alerts</span>
                  <p className="text-[10px] text-zinc-500 block">Dynamic polling notifications refresh rate.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifPreferences.campaignUpdates}
                  onChange={(e) => setNotifPreferences({ ...notifPreferences, campaignUpdates: e.target.checked })}
                  className="w-4 h-4 text-brand bg-zinc-800 rounded border-zinc-700 focus:ring-brand cursor-pointer mt-1"
                />
              </div>
            </div>
          </div>

          {/* Account scrub panel */}
          <div className="bg-brand-surface border border-rose-950 p-5 rounded-2xl relative overflow-hidden" id="account-deletion-card">
            <h3 className="text-xs font-bold font-mono text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UserX size={14} />
              <span>Scrub profile Account</span>
            </h3>
            
            <p className="text-zinc-500 text-[10px] leading-normal mb-4">
              Permanent removal cleans all profile references and associations. Financial history is preserved as "Deleted User" to maintain legal auditing compliance.
            </p>

            {scrubError && (
              <div id="scrub-error-alert" className="mb-3 bg-rose-950/40 border border-rose-900 text-rose-200 text-[10px] p-2.5 rounded gap-1 flex items-center">
                <AlertTriangle size={12} className="text-rose-400" />
                <span>{scrubError}</span>
              </div>
            )}

            {scrubSuccess && (
              <div id="scrub-success-alert" className="mb-3 bg-emerald-950/40 border border-emerald-900 text-emerald-200 text-xs p-2.5 rounded gap-1 flex items-center">
                <Check size={12} />
                <span>{scrubSuccess}</span>
              </div>
            )}

            <form onSubmit={handleScrubAccount} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block font-semibold">ENTER PASSWORD</label>
                <input
                  type="password"
                  required
                  placeholder="Password challenge"
                  value={scrubPassword}
                  onChange={(e) => setScrubPassword(e.target.value)}
                  className="w-full bg-brand-bg/80 border border-zinc-850 focus:border-rose-900 rounded-lg p-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block font-semibold">TYPE: DELETE ACCOUNT</label>
                <input
                  type="text"
                  required
                  placeholder="DELETE ACCOUNT"
                  value={scrubConfirmText}
                  onChange={(e) => setScrubConfirmText(e.target.value)}
                  className="w-full bg-brand-bg/80 border border-zinc-850 focus:border-rose-900 rounded-lg p-2 text-xs font-mono text-white focus:outline-none"
                />
              </div>

              <button
                id="scrub-profile-btn"
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2 bg-rose-950/40 hover:bg-rose-950 text-rose-400 border border-rose-900/60 transition-colors font-bold rounded-lg text-xs cursor-pointer flex justify-center items-center gap-1.5"
              >
                {loading ? 'Scrubbing...' : 'Scrub Profile credentials'}
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>
  );
}
