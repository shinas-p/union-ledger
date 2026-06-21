/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Target, 
  Plus, 
  Check, 
  Trash, 
  Link, 
  Coins, 
  ShieldCheck, 
  X, 
  AlertCircle, 
  Calendar, 
  Percent, 
  TrendingUp, 
  HelpCircle,
  PiggyBank
} from 'lucide-react';
import { Campaign, Transaction, CURRENCY_SYMBOLS, OrganizationCurrency, UserRole } from '../types';

interface CampaignsProps {
  campaigns: Campaign[];
  transactions: Transaction[];
  currency: OrganizationCurrency;
  role: UserRole;
  token: string;
  onRefresh: () => void;
}

export function Campaigns({ 
  campaigns, 
  transactions, 
  currency, 
  role,
  token,
  onRefresh
}: CampaignsProps) {

  const symbol = CURRENCY_SYMBOLS[currency] || '₹';

  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goalAmount: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'Active' as 'Active' | 'Completed' | 'Draft' | 'Paused'
  });

  const getCampaignRaised = (campId: string) => {
    // Only approved income items linked to campaign counts!
    return transactions
      .filter(t => t.campaignId === campId && t.status === 'Approved' && t.type === 'Income')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title || !formData.goalAmount || !formData.startDate || !formData.endDate) {
      setError('Please fill in all core campaign fields.');
      return;
    }

    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to establish campaign.');

      setIsNewCampaignOpen(false);
      setFormData({
        title: '',
        description: '',
        goalAmount: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        status: 'Active'
      });
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStatusChange = async (campId: string, status: string) => {
    try {
      const response = await fetch('/api/campaigns/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: campId, status })
      });
      if (response.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6" id="fund-campaigns-section">
      
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-brand-surface border border-brand-secondary p-5 rounded-2xl">
        <div>
          <h2 className="text-lg font-sans font-bold text-white">Public campaigns & Fundraising Drives</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Initiate, modify, and audit fundraising campaigns. Track actual goal progress with absolute transparency.
          </p>
        </div>

        {(role === 'Admin' || role === 'Treasurer') && (
          <button
            id="open-campaign-modal-btn"
            onClick={() => setIsNewCampaignOpen(true)}
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-bg font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-all hover:scale-[1.01]"
          >
            <Plus size={14} />
            <span>Launch campaign Drive</span>
          </button>
        )}
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-brand-surface border border-brand-secondary p-12 text-center rounded-2xl flex flex-col items-center justify-center gap-2">
          <PiggyBank size={36} className="text-zinc-600" />
          <h3 className="text-white text-sm font-semibold">No active campaigns logged</h3>
          <p className="text-xs text-zinc-500 max-w-sm">
            Launch fundraising goals to accumulate member donations, micro-grants, or external CSR funding.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="campaigns-rendered-grid">
          {campaigns.map((camp) => {
            const raised = getCampaignRaised(camp.id);
            const percent = Math.min(100, Math.round((raised / camp.goalAmount) * 100));
            const remaining = Math.max(0, camp.goalAmount - raised);

            // Filter income transactions belonging to this campaign
            const linkedDonations = transactions.filter(t => t.campaignId === camp.id && t.type === 'Income' && t.status === 'Approved');

            return (
              <div 
                key={camp.id} 
                className="bg-brand-surface border border-brand-secondary rounded-2xl p-6 flex flex-col justify-between hover:border-zinc-700 transition-all text-left relative overflow-hidden"
                id={`campaign-card-${camp.id}`}
              >
                {/* Status Badge */}
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-sans font-bold text-white tracking-tight leading-tight">{camp.title}</h3>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 mt-1 block">
                      Begins: {camp.startDate} • Due: {camp.endDate}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 focus-within:outline-none">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                      camp.status === 'Active' ? 'bg-emerald-950/40 text-emerald-400' :
                      camp.status === 'Completed' ? 'bg-indigo-950/40 text-indigo-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      {camp.status}
                    </span>

                    {/* Quick Toggle (Admins/Treasurers) */}
                    {(role === 'Admin' || role === 'Treasurer') && (
                      <select
                        id={`campaign-status-switch-${camp.id}`}
                        value={camp.status}
                        onChange={(e) => handleStatusChange(camp.id, e.target.value)}
                        className="bg-brand-bg text-[10px] font-mono p-1 rounded border border-zinc-800 focus:outline-none focus:border-brand cursor-pointer text-zinc-400"
                      >
                        <option value="Active">Active</option>
                        <option value="Completed">Completed</option>
                        <option value="Paused">Paused</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-zinc-400 text-xs leading-normal mb-5">{camp.description}</p>

                {/* Progress Indicators */}
                <div className="space-y-2 mb-6" id={`progress-block-${camp.id}`}>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-500">Fund Goal Met Progress:</span>
                    <span className="text-brand font-semibold">{percent}% ({symbol}{raised.toLocaleString()} raised)</span>
                  </div>
                  
                  {/* Progress bar scale */}
                  <div className="w-full bg-brand-bg h-2.5 rounded-full overflow-hidden border border-zinc-850">
                    <div 
                      className="bg-brand h-full rounded-full transition-all duration-500" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] font-mono text-zinc-400 pt-1">
                    <span>Remaining goal: {symbol}{remaining.toLocaleString()}</span>
                    <span>Target: {symbol}{camp.goalAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* Linked transparent donations logs */}
                <div className="border-t border-brand-secondary/60 pt-4" id={`linked-donations-${camp.id}`}>
                  <span className="text-[10px] font-mono text-zinc-400 block mb-2 uppercase tracking-wider">
                    Recent Contributor logs ({linkedDonations.length})
                  </span>

                  {linkedDonations.length === 0 ? (
                    <span className="text-[10px] font-sans text-zinc-600 block italic py-2">No campaign donations recorded yet</span>
                  ) : (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {linkedDonations.slice(0, 4).map((d) => (
                        <div key={d.id} className="flex justify-between items-center text-[11px] bg-brand-bg/40 p-2 rounded border border-zinc-900 leading-none">
                          <div className="flex items-center gap-1.5">
                            <Coins size={10} className="text-brand" />
                            <span className="text-white font-medium truncate max-w-[120px]">{d.title}</span>
                          </div>
                          <span className="font-mono text-emerald-400 font-semibold">{symbol}{d.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Campaign establishment modal */}
      {isNewCampaignOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in" id="new-campaign-modal">
          <div className="bg-brand-surface border border-brand-secondary max-w-md w-full rounded-2xl overflow-hidden shadow-2xl relative text-left">
            <div className="p-5 bg-brand-secondary border-b border-zinc-850 flex justify-between items-center">
              <h3 className="font-sans font-bold text-sm text-white">Establish fundraising Goal</h3>
              <button
                id="close-new-campaign-btn"
                onClick={() => setIsNewCampaignOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="m-4 bg-red-950/40 border border-red-900 text-red-200 text-xs p-3 rounded-lg flex items-center gap-1.5">
                <AlertCircle size={14} className="text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="p-5 space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Drive Slogan / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Malkangiri Regional Library Upgrades"
                  value={formData.title}
                  onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              {/* Goal & Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-mono">Target goal ({symbol})</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 150000"
                    value={formData.goalAmount}
                    onChange={(e) => setFormData(p => ({ ...p, goalAmount: e.target.value }))}
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Core State</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(p => ({ ...p, status: e.target.value as any }))}
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Active">Active (Public Contribution Available)</option>
                    <option value="Draft">Draft (Internal Blueprint)</option>
                    <option value="Paused">Paused (Suspended Temporarily)</option>
                  </select>
                </div>
              </div>

              {/* Start & Ends Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block text-xs">Calendar Begins</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-amber-50 focus:outline-none"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block text-xs">Calendar Ends</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-amber-50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block text-xs">Narrative Description / Campaign Appeal</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain clearly to public contributors why this funding is needed, how cash flow is governed, and expected impact metrics..."
                  value={formData.description}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <button
                id="submit-campaign-btn"
                type="submit"
                className="w-full bg-brand hover:bg-brand-hover text-brand-bg font-bold py-3 text-xs rounded-xl cursor-pointer hover:scale-[1.01] transition-all"
              >
                Launch Active Drive Campaign
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
