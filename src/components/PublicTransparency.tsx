/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building, 
  Coins, 
  CreditCard, 
  TrendingUp, 
  ChevronRight, 
  Award, 
  CheckCircle,
  X,
  FileText,
  Printer,
  Calendar,
  Share2,
  Copy,
  ArrowLeft,
  Search
} from 'lucide-react';
import { CURRENCY_SYMBOLS, OrganizationCurrency } from '../types';

interface PublicTransparencyProps {
  slug: string;
  onClose?: () => void;
}

export function PublicTransparency({ slug, onClose }: PublicTransparencyProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [search, setSearch] = useState('');

  const fetchPublicData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transparency/${slug}`);
      if (!res.ok) {
        throw new Error('Could not pull transparency portal ledger. Path may be invalid.');
      }
      const val = await res.json();
      setData(val);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicData();
  }, [slug]);

  const symbol = data ? CURRENCY_SYMBOLS[data.organization.currency as OrganizationCurrency] || '₹' : '₹';

  const copyPublicLink = () => {
    const pubUrl = `${window.location.origin}/?portal=${slug}`;
    navigator.clipboard.writeText(pubUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1115] text-white flex flex-col items-center justify-center p-8">
        <span className="w-10 h-10 border-4 border-[#D6FF20] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-mono text-xs text-zinc-500 tracking-wider">COMPILING PUBLIC LEDGER PARALLAX...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0F1115] text-white flex flex-col items-center justify-center p-8 text-center space-y-4">
        <X className="text-rose-500 h-12 w-12 border border-rose-900 bg-rose-950/20 p-2.5 rounded-full" />
        <h3 className="text-lg font-bold">Portal offline</h3>
        <p className="text-xs text-zinc-400 max-w-xs">{error || 'Ledger records could not load'}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-brand-surface border border-brand-secondary text-zinc-300 hover:text-white rounded text-xs"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  const { organization, metrics, campaigns, transactions } = data;

  const filteredTx = transactions.filter((t: any) => {
    return t.title.toLowerCase().includes(search.toLowerCase()) || 
           t.category.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-[#0F1115] text-white font-sans text-left pb-16" id="public-audit-portal">
      
      {/* Upper Navigation Backline */}
      <div className="bg-[#161A20] border-b border-zinc-850/60 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                id="back-to-dashboard-action"
                onClick={onClose}
                className="p-1 px-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={12} />
                <span>Sandbox Dashboard</span>
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand animate-ping" />
              <span className="text-[10px] font-mono tracking-widest text-[#A8CC00] uppercase font-bold">
                PUBLIC ACCOUNTABILITY REGISTER
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="print-public-ledger"
              onClick={() => window.print()}
              className="p-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 hover:text-[#D6FF20] transition-colors rounded text-xs font-mono flex items-center gap-1 cursor-pointer"
            >
              <Printer size={12} />
              <span>Print Board</span>
            </button>
            
            <button
              id="copy-portal-link"
              onClick={copyPublicLink}
              className="p-1.5 px-3 bg-[#D6FF20] hover:bg-[#C5F000] text-brand-bg transition-colors rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Copy size={12} />
              <span>{copiedLink ? 'Portal Link Copied!' : 'Copy Portal Link'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-8 space-y-6">
        
        {/* Banner Card */}
        <div className="bg-[#161A20] border border-zinc-850 p-8 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden" id="public-header-mast">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#D6FF20]/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-4">
            <img
              src={organization.logoUrl || `https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=100`}
              alt="Org branding"
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl object-cover bg-zinc-800 border border-zinc-800 shadow-xl"
            />
            <div>
              <h1 className="text-2xl font-sans font-bold text-white tracking-tight">{organization.name}</h1>
              <span className="text-zinc-400 font-mono text-xs mt-1 block">
                Workspace ID: {organization.id} • Registered Registry
              </span>
            </div>
          </div>

          <div className="bg-[#1B2028]/85 border border-emerald-800/20 p-4 px-5 rounded-2xl flex items-center gap-3.5" id="stamp-audited">
            <CheckCircle className="text-brand h-9 w-9 animate-pulse" />
            <div>
              <span className="text-[10px] font-mono text-brand block uppercase font-bold tracking-widest">
                VERIFIED HIGH-TRUST LEDGER
              </span>
              <span className="text-zinc-300 text-xs mt-0.5 block font-medium max-w-xs">
                Financial accounts signed by administrative committee personnel.
              </span>
            </div>
          </div>
        </div>

        {/* Public KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="public-kpi-row">
          
          <div className="bg-[#161A20] border border-zinc-850 p-6 rounded-2xl">
            <span className="text-[10px] font-mono text-zinc-400 tracking-wider block mb-1">TOTAL SYSTEM FUND RECEIVED</span>
            <span className="text-3xl font-mono font-bold text-white">{symbol}{metrics.totalIncome.toLocaleString()}</span>
            <span className="text-[11px] text-zinc-500 font-mono block mt-1.5 font-semibold text-emerald-400 font-bold">● verified credit</span>
          </div>

          <div className="bg-[#161A20] border border-zinc-850 p-6 rounded-2xl">
            <span className="text-[10px] font-mono text-zinc-400 tracking-wider block mb-1">TOTAL OUTFLOWS DOCUMENTED</span>
            <span className="text-3xl font-mono font-bold text-white">{symbol}{metrics.totalExpense.toLocaleString()}</span>
            <span className="text-[11px] text-zinc-500 font-mono block mt-1.5 text-rose-400 font-bold">● debit reserve</span>
          </div>

          <div className="bg-[#161A20] border border-[#D6FF20]/25 p-6 rounded-2xl bg-gradient-to-br from-[#161A20] to-[#D6FF20]/5">
            <span className="text-[10px] font-mono text-brand tracking-wider block mb-1">NET BALANCE CURRENT</span>
            <span className="text-3xl font-mono font-bold text-[#D6FF20]">{symbol}{metrics.currentBalance.toLocaleString()}</span>
            <span className="text-[11px] text-teal-400 font-mono block mt-1.5">● operating liquidity surplus</span>
          </div>

        </div>

        {/* Active Campaigns Tracker Panel */}
        <div className="bg-[#161A20] border border-zinc-850 p-6 rounded-2xl space-y-4 text-left" id="public-campaigns-panel">
          <div>
            <h3 className="font-sans font-bold text-base text-white">Active Fundraising drives</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Complete status on social campaigns, allocated budgets, goals, and public contributions list.
            </p>
          </div>

          {campaigns.length === 0 ? (
            <p className="text-zinc-650 text-xs font-mono py-2 italic text-center">No campaigns compiled currently.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((camp: any) => (
                <div key={camp.id} className="bg-[#0F1115] border border-zinc-850 p-5 rounded-xl space-y-3" id={`public-camp-${camp.id}`}>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-white text-xs font-bold font-sans">{camp.title}</span>
                      <span className="text-[9px] font-mono bg-[#D6FF20]/15 text-[#D6FF20] p-0.5 px-1.5 rounded">{camp.status}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-normal">{camp.description}</p>
                  </div>

                  {/* Percentage tracking */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                      <span>Met: {camp.percentage}%</span>
                      <span>Target Goal: {symbol}{camp.goalAmount.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-[#161A20] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#D6FF20] h-full" style={{ width: `${camp.percentage}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Public Borrow & Loan Register Panel */}
        <div className="bg-[#161A20] border border-zinc-850 p-6 rounded-2xl space-y-4 text-left" id="public-borrows-panel">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h3 className="font-sans font-bold text-base text-white">Borrow & Loan Register</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Transparency tracking of public loans borrowed from the union or owed by the union, ensuring complete visual accountability of credit.
              </p>
            </div>
            
            {/* Borrow Metrics inside the panel */}
            <div className="flex gap-4">
              <div className="bg-[#0F1115] border border-zinc-850 px-4 py-2 rounded-xl text-xs">
                <span className="text-[9px] font-mono text-rose-400 uppercase block">Owed to Union</span>
                <span className="font-mono font-bold text-white mt-0.5 block">{symbol}{(metrics.moneyOwedToUnion || 0).toLocaleString()}</span>
              </div>
              <div className="bg-[#0F1115] border border-zinc-850 px-4 py-2 rounded-xl text-xs">
                <span className="text-[9px] font-mono text-emerald-400 uppercase block">Union Owes</span>
                <span className="font-mono font-bold text-white mt-0.5 block">{symbol}{(metrics.moneyUnionOwes || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {(data.borrows || []).length === 0 ? (
            <p className="text-zinc-650 text-xs font-mono py-2 italic text-center">No public borrow or loan records reported.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-850 text-zinc-500 font-mono text-[10px] tracking-widest uppercase">
                    <th className="pb-3 px-4">Entity / Member</th>
                    <th className="pb-3 px-3">Type</th>
                    <th className="pb-3 px-3">Principal</th>
                    <th className="pb-3 px-3">Balance Due</th>
                    <th className="pb-3 px-3">Due Date</th>
                    <th className="pb-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850/50 text-xs">
                  {(data.borrows || []).map((b: any) => {
                    const titleName = b.type === 'borrowed_from_union' ? b.borrowerName : b.lenderName;
                    return (
                      <tr key={b.id} className="hover:bg-zinc-850/20 transition-all">
                        <td className="py-3 px-4">
                          <div>
                            <span className="text-white font-semibold block">{titleName}</span>
                            <span className="text-[10px] text-zinc-500 mt-0.5">{b.purpose || 'No purpose listed.'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                            b.type === 'borrowed_from_union' 
                              ? 'bg-rose-950/40 text-rose-400' 
                              : 'bg-emerald-950/40 text-emerald-400'
                          }`}>
                            {b.type === 'borrowed_from_union' ? 'Owed to Union' : 'Owed by Union'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-300">
                          {symbol}{b.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-white">
                          {symbol}{b.balanceDue.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-zinc-400 font-mono text-[11px]">
                          {b.dueDate ? new Date(b.dueDate).toLocaleDateString() : 'No limit'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wide font-bold border ${
                            b.status === 'fully_paid'
                              ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
                              : b.status === 'partially_paid'
                              ? 'bg-indigo-950/40 border-indigo-800/40 text-indigo-400'
                              : b.status === 'overdue'
                              ? 'bg-rose-950/40 border-rose-800/40 text-rose-400'
                              : b.status === 'waived'
                              ? 'bg-zinc-800 border-zinc-700 text-zinc-400'
                              : 'bg-amber-950/40 border-amber-800/40 text-amber-400'
                          }`}>
                            {b.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Transactions ledger history table (Approved Only!) */}
        <div className="bg-[#161A20] border border-zinc-850 p-6 rounded-2xl space-y-4" id="public-ledger-grid">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-sans font-bold text-base text-white">Verified ledger balances</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Approved allocations, donor records, and structural expenditures.</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search public records..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-[#0F1115] text-white border border-zinc-850 hover:border-zinc-800 rounded focus:outline-none focus:border-[#D6FF20]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-850 text-zinc-500 font-mono text-[10px] tracking-widest uppercase">
                  <th className="pb-3 px-4">Date / label</th>
                  <th className="pb-3 px-3">Type</th>
                  <th className="pb-3 px-3">Amount</th>
                  <th className="pb-3 px-3">Category</th>
                  <th className="pb-3 px-4 text-right">Verification stamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/50 text-xs">
                {filteredTx.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-zinc-850/20 transition-all" id={`public-tx-row-${tx.id}`}>
                    <td className="py-3 px-4">
                      <div>
                        <span className="text-white font-semibold block">{tx.title}</span>
                        <span className="text-[10px] font-mono text-zinc-500 mt-0.5">{tx.date}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${tx.type === 'Income' ? 'bg-emerald-950/40 text-emerald-400' : 'bg-rose-950/40 text-rose-400'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-white">
                      {symbol}{tx.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-zinc-400 font-mono text-[11px]">{tx.category}</td>
                    <td className="py-3 px-4 text-emerald-450 font-mono text-[10px] text-right text-emerald-400 text-[11px]">
                      ✔ Verified by {tx.approvedByUserName || 'Committee Sign-off'}
                    </td>
                  </tr>
                ))}

                {filteredTx.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <FileText size={24} className="text-zinc-650" />
                        <p className="text-xs">No ledger rows match this query.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Public Footer */}
      <div className="max-w-6xl mx-auto px-4 mt-12 pt-6 border-t border-zinc-850/60 text-center text-[10px] font-mono text-zinc-500 space-y-1">
        <p>UNION LEDGER PLATFORM • CRYPTOGRAPHIC TRANSPARENCY STANDARD v2.4</p>
        <p>RECORDS COMPLIANT WITH SECTOR STANDARDS FOR NGOs, UNIONS, AND TRUST GROUPS.</p>
      </div>

    </div>
  );
}
