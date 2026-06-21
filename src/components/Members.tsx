/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Trash2, 
  ShieldAlert, 
  CheckCircle, 
  X, 
  Copy, 
  QrCode, 
  Lock, 
  UserCheck, 
  Clock, 
  Activity, 
  Link as LinkIcon, 
  RefreshCw,
  Search,
  Filter,
  AlertCircle
} from 'lucide-react';
import { OrganizationMember, InviteLink, UserRole } from '../types';

interface MembersProps {
  token: string;
  role: UserRole;
  orgName: string;
  onRefresh: () => void;
}

export function Members({ token, role, orgName, onRefresh }: MembersProps) {

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invites, setInvites] = useState<InviteLink[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | UserRole>('All');

  // Invites state form
  const [inviteRole, setInviteRole] = useState<UserRole>('Viewer');
  const [usageLimit, setUsageLimit] = useState('');
  const [daysValid, setDaysValid] = useState('7');
  const [error, setError] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);

  // Copied alerts
  const [copiedCodeCode, setCopiedCodeCode] = useState<string | null>(null);

  // QR Modal simulated
  const [qrOpen, setQrOpen] = useState(false);
  const [qrCodeVal, setQrCodeVal] = useState<string | null>(null);

  const fetchMembersAndInvites = async () => {
    try {
      const memRes = await fetch('/api/members', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (memRes.ok) {
        const memData = await memRes.json();
        setMembers(memData.members || []);
      }

      const invRes = await fetch('/api/orgs/invites', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvites(invData.invites || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMembersAndInvites();
  }, [token]);

  const handleCreateInviteCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessCode(null);

    try {
      const res = await fetch('/api/orgs/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          role: inviteRole,
          usageLimit: usageLimit ? parseInt(usageLimit) : null,
          daysValid: daysValid ? parseInt(daysValid) : null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to establish code.');

      setSuccessCode(data.invite.code);
      fetchMembersAndInvites();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRevokeInvite = async (code: string) => {
    try {
      const res = await fetch('/api/orgs/invites/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      });
      if (res.ok) {
        fetchMembersAndInvites();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateMember = async (memberId: string, updates: { role?: UserRole, status?: 'Active' | 'Suspended' }) => {
    try {
      const res = await fetch('/api/members/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ memberId, ...updates })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Update failed');
        return;
      }
      fetchMembersAndInvites();
      onRefresh(); // Refresh shell context to reflect role change immediately
    } catch (err) {
      console.error(err);
    }
  };

  const handleExpelMember = async (memberId: string) => {
    if (!window.confirm('Are you absolutely sure you wish to permanently expel this member from this workspace?')) return;
    try {
      const res = await fetch('/api/members/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ memberId })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error);
        return;
      }
      fetchMembersAndInvites();
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (code: string) => {
    // Generate full URL style callback
    const joinUrl = `${window.location.origin}/join?code=${code}`;
    navigator.clipboard.writeText(joinUrl);
    setCopiedCodeCode(code);
    setTimeout(() => setCopiedCodeCode(null), 2000);
  };

  // Filter roster
  const filteredMembers = members.filter(m => {
    const matchesSearch = m.userName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          m.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 text-left" id="membership-controls-dashboard">
      
      {/* Invite System Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="invite-building-grid">
        
        {/* Left Form: Building dynamic invites (span 5) */}
        <div className="lg:col-span-5 bg-brand-surface border border-brand-secondary p-6 rounded-2xl flex flex-col justify-between" id="invitation-generator-panel">
          <div>
            <h3 className="font-sans font-bold text-sm text-white mb-1">Create dynamic invite Link</h3>
            <p className="text-[11px] text-zinc-400 leading-normal">
              Establish customized links associated with pre-routed clearance roles. Restrict link usage lifespans or revoke them at any time.
            </p>

            {role !== 'Admin' ? (
              <div className="mt-4 p-4 bg-brand-bg/60 border border-zinc-800 rounded-xl text-center flex flex-col items-center justify-center gap-2">
                <Lock size={20} className="text-zinc-600" />
                <p className="text-[11px] text-zinc-500 font-mono">Administrative Clearance Required</p>
                <p className="text-[10px] text-zinc-600">Only workspace Admins hold authorization to write invitation links.</p>
              </div>
            ) : (
              <form onSubmit={handleCreateInviteCode} className="mt-4 space-y-4">
                {error && (
                  <div className="bg-red-955/40 border border-red-900 text-red-200 text-[10px] p-2.5 rounded flex items-center gap-1.5 leading-snug">
                    <AlertCircle size={12} className="text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                {successCode && (
                  <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-300 text-xs p-3 rounded-lg space-y-2">
                    <span className="font-semibold block">Invite generated successfully!</span>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        readOnly
                        value={successCode}
                        className="bg-brand-bg border border-zinc-805 text-[11px] font-mono p-1 rounded text-white flex-1 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(successCode)}
                        className="bg-brand text-brand-bg p-1 px-2 text-[10px] rounded font-mono font-bold cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                {/* Role selectivity */}
                <div className="grid grid-cols-2 gap-3" id="role-selects-checks">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Clearance Target</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as UserRole)}
                      className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2 text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="Viewer">Viewer (Read-Only)</option>
                      <option value="Auditor">Auditor (View Reports)</option>
                      <option value="Treasurer">Treasurer (Lead entry)</option>
                      <option value="Admin">Admin (Full Control)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Usages Limit</label>
                    <input
                      type="number"
                      placeholder="Infinite"
                      value={usageLimit}
                      onChange={(e) => setUsageLimit(e.target.value)}
                      className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Expiration limit in days */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Expiration lifespan</label>
                  <select
                    value={daysValid}
                    onChange={(e) => setDaysValid(e.target.value)}
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="1">1 Day</option>
                    <option value="7">7 Days (One Week)</option>
                    <option value="30">30 Days (One Month)</option>
                    <option value="">Never Expire</option>
                  </select>
                </div>

                <button
                  id="create-invite-submit-btn"
                  type="submit"
                  className="w-full py-2.5 bg-brand hover:bg-brand-hover text-brand-bg font-bold rounded-lg text-xs cursor-pointer transition-all hover:scale-[1.01]"
                >
                  Generate Role Clearance Invite
                </button>
              </form>
            )}
          </div>

          {/* Hardcoded Default Codes panel */}
          <div className="mt-4 pt-4 border-t border-brand-secondary/60 bg-brand-secondary/25 p-4 rounded-xl border-dashed">
            <span className="text-[10px] font-mono text-zinc-300 font-bold uppercase tracking-wider block mb-2">
              Hardcoded Sandbox codes
            </span>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-400">
              <div className="flex justify-between items-center bg-brand-bg p-1.5 px-2.5 rounded border border-zinc-900">
                <span>VIEWER2026</span>
                <span className="text-[8px] px-1 bg-zinc-850 rounded">Viewer</span>
              </div>
              <div className="flex justify-between items-center bg-brand-bg p-1.5 px-2.5 rounded border border-zinc-900">
                <span>AUDITOR2026</span>
                <span className="text-[8px] px-1 bg-zinc-850 rounded text-blue-400">Auditor</span>
              </div>
              <div className="flex justify-between items-center bg-brand-bg p-1.5 px-2.5 rounded border border-zinc-900">
                <span>TREASURER2026</span>
                <span className="text-[8px] px-1 bg-zinc-850 rounded text-yellow-400">Treas</span>
              </div>
              <div className="flex justify-between items-center bg-brand-bg p-1.5 px-2.5 rounded border border-zinc-900">
                <span>ADMIN2026</span>
                <span className="text-[8px] px-1 bg-zinc-850 rounded text-brand">Admin</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Invites log directories index (span 7) */}
        <div className="lg:col-span-7 bg-brand-surface border border-brand-secondary p-6 rounded-2xl flex flex-col justify-between" id="invitation-records-panel">
          <div>
            <h3 className="font-sans font-bold text-sm text-white mb-2">Workspace invites records</h3>
            <p className="text-[11px] text-zinc-400 leading-normal">
              Active tracks on all generated codes, cumulative clicks, uses, and expiration dates. Revoke links instantaneously if compromised.
            </p>

            <div className="mt-4 divide-y divide-zinc-850 max-h-72 overflow-y-auto pr-1" id="invite-records-list">
              {invites.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-1">
                  <LinkIcon size={24} className="text-zinc-650" />
                  <p className="text-[11px] italic font-mono">No custom invites generated yet</p>
                </div>
              ) : (
                invites.map((inv) => (
                  <div key={inv.id} className="py-3 flex items-center justify-between gap-4 text-xs" id={`invite-row-${inv.id}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white font-semibold bg-brand-bg px-2 py-0.5 rounded border border-zinc-900">{inv.code}</span>
                        <span className="px-1.5 py-0.2 bg-zinc-850 rounded text-[9px] font-mono text-zinc-400 uppercase tracking-wild">{inv.role}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        Usages: {inv.usageCount} / {inv.usageLimit || 'Infinite'} • Expires: {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        id={`qr-trigger-${inv.id}`}
                        onClick={() => { setQrCodeVal(inv.code); setQrOpen(true); }}
                        className="p-1 px-2.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded text-[10px] font-mono flex items-center gap-1 cursor-pointer"
                        title="Display QR code"
                      >
                        <QrCode size={11} />
                        <span>QR</span>
                      </button>

                      <button
                        id={`copy-trigger-${inv.id}`}
                        onClick={() => copyToClipboard(inv.code)}
                        className="p-1 px-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded text-[10px] font-mono flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={11} />
                        <span>{copiedCodeCode === inv.code ? 'Copied!' : 'Copy'}</span>
                      </button>

                      {role === 'Admin' && !inv.isRevoked && (
                        <button
                          id={`revoke-invite-${inv.id}`}
                          onClick={() => handleRevokeInvite(inv.code)}
                          className="p-1 px-2 bg-rose-950/20 hover:bg-rose-950 text-rose-400 rounded text-[10px] font-mono flex items-center gap-1 cursor-pointer"
                        >
                          <X size={10} />
                          <span>Revoke</span>
                        </button>
                      )}

                      {inv.isRevoked && (
                        <span className="text-zinc-650 font-mono text-[10px] italic py-1">Revoked</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="text-[10px] font-mono text-zinc-500 mt-4 text-left border-t border-zinc-900 pt-3">
            🎯 Invite codes route joining members automatically to the "{orgName}" central directory.
          </p>
        </div>

      </div>

      {/* Workspace Active Members Directory Page */}
      <div className="bg-brand-surface border border-brand-secondary p-6 rounded-2xl" id="active-members-workspace-directory">
        
        {/* Directory Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h3 className="font-sans font-bold text-sm text-white">Active Members directory</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Control workspace access clearances, roles, and administrative statuses.</p>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search member email, name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-brand-bg text-xs pl-8 pr-3 py-1.5 rounded-lg border border-zinc-850 hover:border-zinc-800 focus:outline-none focus:border-brand text-white w-full"
              />
            </div>

            <select
              id="member-role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-brand-bg border border-zinc-850 text-xs px-2.5 py-1.5 rounded-lg text-zinc-400 focus:outline-none"
            >
              <option value="All">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Treasurer">Treasurer</option>
              <option value="Auditor">Auditor</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>
        </div>

        {/* Directory List Container */}
        <div className="overflow-x-auto" id="members-list-table">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-850 text-zinc-500 font-mono text-[10px] tracking-widest uppercase">
                <th className="py-3 px-4">Member Person</th>
                <th className="py-3 px-3">Primary Email</th>
                <th className="py-3 px-3">Role Designation</th>
                <th className="py-3 px-3">Membership status</th>
                <th className="py-3 px-3">Registry date</th>
                {role === 'Admin' && <th className="py-3 px-4 text-right">Admin Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850 text-xs">
              {filteredMembers.map((m) => (
                <tr key={m.id} className="hover:bg-brand-secondary/15 transition-all" id={`member-item-${m.id}`}>
                  
                  {/* Avatar + Name */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={m.userAvatarUrl || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=60`}
                        alt={m.userName}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full border border-zinc-800 bg-zinc-800"
                      />
                      <span className="text-white font-semibold">{m.userName}</span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="py-4 px-3 text-zinc-400 font-mono text-[11px]">{m.userEmail}</td>

                  {/* Select Role */}
                  <td className="py-4 px-3">
                    {role === 'Admin' && m.role !== 'Admin' ? (
                      <select
                        id={`member-role-change-${m.id}`}
                        value={m.role}
                        onChange={(e) => handleUpdateMember(m.id, { role: e.target.value as UserRole })}
                        className="bg-brand-bg text-xs p-1 rounded border border-zinc-800 text-white focus:outline-none cursor-pointer"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Treasurer">Treasurer</option>
                        <option value="Auditor">Auditor</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="font-semibold text-zinc-300">{m.role}</span>
                    )}
                  </td>

                  {/* Status Toggle (Suspended/Active) */}
                  <td className="py-4 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                      m.status === 'Active' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' : 'bg-red-950/40 text-rose-400 border border-red-900/30'
                    }`}>
                      ● {m.status}
                    </span>
                  </td>

                  {/* Registry Date */}
                  <td className="py-4 px-3 text-zinc-500 font-mono text-[11px]">{new Date(m.joinedAt).toLocaleDateString()}</td>

                  {/* Admin Actions */}
                  {role === 'Admin' && (
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {m.role !== 'Admin' && (
                          <button
                            id={`suspend-btn-${m.id}`}
                            onClick={() => handleUpdateMember(m.id, { status: m.status === 'Active' ? 'Suspended' : 'Active' })}
                            className={`p-1 px-2 cursor-pointer font-mono text-[9px] rounded font-bold uppercase ${
                              m.status === 'Active' ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-emerald-950 text-emerald-400'
                            }`}
                          >
                            {m.status === 'Active' ? 'Suspend' : 'Reactivate'}
                          </button>
                        )}

                        {m.role !== 'Admin' && (
                          <button
                            id={`expel-btn-${m.id}`}
                            onClick={() => handleExpelMember(m.id)}
                            className="p-1 px-1.5 bg-rose-950/30 hover:bg-rose-950 text-rose-400 rounded cursor-pointer transition-colors"
                            title="Expel entirely"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* simulated QR popup code */}
      {qrOpen && qrCodeVal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in" id="qr-modal-preview">
          <div className="bg-brand-surface border border-brand-secondary max-w-xs w-full rounded-2xl overflow-hidden p-6 text-center animate-scale-up shadow-xl relative">
            <button
              id="close-qr-preview"
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              onClick={() => { setQrOpen(false); setQrCodeVal(null); }}
            >
              <X size={16} />
            </button>
            
            <h4 className="text-zinc-400 text-[10px] uppercase font-mono font-bold tracking-widest mb-1">
              Organization code registry URL
            </h4>
            
            <span className="text-white text-xs font-semibold block mb-4 truncate">{qrCodeVal}</span>

            {/* simulated styled high-contrast QR box */}
            <div className="w-44 h-44 bg-white p-3 rounded-xl mx-auto shadow flex flex-col justify-between items-center relative overflow-hidden mb-4">
              <div className="absolute top-0 left-0 bg-brand text-brand-bg text-[8px] font-mono leading-none p-1 font-bold">LEDGER</div>
              
              <div className="grid grid-cols-6 gap-2 w-full h-full p-2">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-sm ${(i % 3 === 0 || i % 7 === 1 || i < 6 || i > 30) ? 'bg-[#0F1115]' : 'bg-transparent'}`}
                  />
                ))}
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 leading-snug font-mono">
              Scan from mobile phone to join organization workspace.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
