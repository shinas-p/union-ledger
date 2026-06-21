/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  Share2, 
  ChevronRight, 
  Check, 
  X, 
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar 
} from 'recharts';
import { Transaction, Campaign, AuditLog, CURRENCY_SYMBOLS, OrganizationCurrency } from '../types';

interface DashboardProps {
  transactions: Transaction[];
  campaigns: Campaign[];
  audits: AuditLog[];
  currency: OrganizationCurrency;
  role: string;
  onNavigate: (tab: string) => void;
  onApproveTransaction: (id: string, status: 'Approved' | 'Rejected') => Promise<void>;
  onOpenPublicTransparency: () => void;
  orgSlug: string;
}

export function Dashboard({ 
  transactions, 
  campaigns, 
  audits, 
  currency, 
  role,
  onNavigate,
  onApproveTransaction,
  onOpenPublicTransparency,
  orgSlug
}: DashboardProps) {

  const symbol = CURRENCY_SYMBOLS[currency] || '₹';

  // Approved totals
  const approvedTx = transactions.filter(t => t.status === 'Approved');
  
  const totalIncome = approvedTx
    .filter(t => t.type === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = approvedTx
    .filter(t => t.type === 'Expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const currentBalance = totalIncome - totalExpense;

  const activeCampaignsCount = campaigns.filter(c => c.status === 'Active').length;

  const pendingTransactions = transactions.filter(t => t.status === 'Pending');

  // Prepare chart data grouping by date (last 7 releases)
  const last7DaysData = () => {
    const dates: Record<string, { income: number, expense: number }> = {};
    
    // Sort transactions chronologically
    const sorted = [...approvedTx].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sorted.forEach(t => {
      const formattedDate = new Date(t.date).toLocaleDateString([], { month: 'short', day: '2-digit' });
      if (!dates[formattedDate]) {
        dates[formattedDate] = { income: 0, expense: 0 };
      }
      if (t.type === 'Income') {
        dates[formattedDate].income += t.amount;
      } else {
        dates[formattedDate].expense += t.amount;
      }
    });

    const entries = Object.entries(dates).map(([date, val]) => ({
      date,
      Income: val.income,
      Expense: val.expense,
      Cashflow: val.income - val.expense
    }));

    return entries.slice(-7); // take last 7 active intervals
  };

  const chartData = last7DaysData();

  // WhatsApp broadcast strings
  const getWhatsAppMessage = (type: 'summary' | 'campaign') => {
    let text = '';
    if (type === 'summary') {
      text = `*UNION LEDGER FINANCIAL UPDATE*\n` +
             `*Organization*: Malkangiri Labour Union\n` +
             `📅 _As of: ${new Date().toLocaleDateString()}_\n` +
             `--------------------------------\n` +
             `💰 *Total Income*: ${symbol}${totalIncome.toLocaleString()}\n` +
             `🧾 *Total Expenses*: ${symbol}${totalExpense.toLocaleString()}\n` +
             `⚖️ *Current Balance*: ${symbol}${currentBalance.toLocaleString()}\n` +
             `--------------------------------\n` +
             `🌍 *View Public Audit Portal*:\n` +
             `https://unionledger.org/transparency/${orgSlug}\n\n` +
             `_Real-time audit records compiled transparently._`;
    } else {
      const primaryCamp = campaigns.find(c => c.status === 'Active');
      if (primaryCamp) {
        const raised = approvedTx
          .filter(t => t.campaignId === primaryCamp.id && t.type === 'Income')
          .reduce((sum, t) => sum + t.amount, 0);
        const term = Math.round((raised / primaryCamp.goalAmount) * 100);
        
        text = `*CAMPAIGN MONITOR: ${primaryCamp.title.toUpperCase()}*\n` +
               `*Goal Amount*: ${symbol}${primaryCamp.goalAmount.toLocaleString()}\n` +
               `📈 *Gathered Funding*: ${symbol}${raised.toLocaleString()} (${term}% Achieved)\n` +
               `⏳ *Remaining Needed*: ${symbol}${Math.max(0, primaryCamp.goalAmount - raised).toLocaleString()}\n` +
               `--------------------------------\n` +
               `Please support our collective efforts here: https://unionledger.org/transparency/${orgSlug}/donate`;
      } else {
        text = `*UNION LEDGER CAMPAIGN NOTICE*\nAll recent general drives are current! Track details at the public portal.`;
      }
    }
    return encodeURIComponent(text);
  };

  return (
    <div className="space-y-6" id="dashboard-tab-view">
      
      {/* Upper Panel: Slogan & Quick Public Link */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#161A20] border border-white/5 p-5 rounded-lg relative overflow-hidden" id="dashboard-header-panel">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#D6FF20]/5 rounded-full blur-2xl pointer-events-none" />
        <div>
          <h2 className="text-lg font-sans font-bold text-white tracking-tight flex items-center gap-2 uppercase">
            Ledger Overview
            <span className="px-2 py-0.5 rounded bg-[#D6FF20]/20 text-[#D6FF20] text-[10px] font-mono tracking-wider uppercase font-bold">
              {role} Account
            </span>
          </h2>
          <p className="text-zinc-450 text-xs mt-1">
            Real-time financial status, budget allocations, and pending workflows.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="view-public-portal-btn"
            onClick={onOpenPublicTransparency}
            className="px-4 py-1.5 bg-[#D6FF20] hover:bg-[#C5F000] text-[#0F1115] text-xs font-bold uppercase rounded-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Share2 size={12} />
            <span>Public transparency Portal</span>
          </button>
          
          <button
            id="nav-to-transactions-btn"
            onClick={() => onNavigate('transactions')}
            className="px-4 py-1.5 bg-[#1B2028] hover:bg-zinc-800 text-zinc-300 border border-white/10 text-xs font-bold uppercase rounded-sm flex items-center gap-1 transition-all cursor-pointer"
          >
            <span>Ledger Details</span>
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* KPI Dashboard Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-cards-grid">
        
        {/* Balance Card */}
        <div className="bg-[#161A20] border border-white/5 p-5 rounded-lg flex flex-col justify-between" id="kpi-balance-card">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono tracking-widest text-[#A1A1AA] uppercase">Current Balance</span>
            <div className="p-1.5 rounded-sm bg-white/5 text-[#D6FF20]">
              <DollarSign size={14} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-mono font-semibold text-[#D6FF20] tracking-tight">
              {symbol}{currentBalance.toLocaleString()}
            </span>
          </div>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-[#D6FF20] w-3/4" />
          </div>
        </div>

        {/* Income Card */}
        <div className="bg-[#161A20] border border-white/5 p-5 rounded-lg flex flex-col justify-between" id="kpi-income-card">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono tracking-widest text-[#A1A1AA] uppercase">Total Income</span>
            <div className="p-1.5 rounded-sm bg-green-500/10 text-green-400">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-mono font-semibold text-white tracking-tight">
              {symbol}{totalIncome.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-green-400 uppercase tracking-widest">
            <span>+12.5%</span>
            <span className="text-[#A1A1AA] opacity-50 lowercase font-sans">from last month</span>
          </div>
        </div>

        {/* Expense Card */}
        <div className="bg-[#161A20] border border-white/5 p-5 rounded-lg flex flex-col justify-between" id="kpi-expense-card">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono tracking-widest text-[#A1A1AA] uppercase">Expenses Stamped</span>
            <div className="p-1.5 rounded-sm bg-red-500/10 text-red-100">
              <TrendingDown size={14} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-mono font-bold text-white tracking-tight font-mono">
              {symbol}{totalExpense.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-red-400 uppercase tracking-widest">
            <span>-4.2%</span>
            <span className="text-[#A1A1AA] opacity-50 lowercase font-sans">within budget</span>
          </div>
        </div>

        {/* Active Campaigns Card */}
        <div className="bg-[#161A20] border border-white/5 p-5 rounded-lg flex flex-col justify-between" id="kpi-campaigns-card">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono tracking-widest text-[#A1A1AA] uppercase">Active Campaigns</span>
            <div className="p-1.5 rounded-sm bg-blue-500/10 text-blue-400">
              <Target size={14} />
            </div>
          </div>
          <div className="my-2">
            <span className="text-2xl font-bold text-white font-mono tracking-tight">
              {activeCampaignsCount.toString().padStart(2, '0')}
            </span>
          </div>
          <div className="flex gap-1.5 items-center">
            <div className="w-2 h-2 rounded-full bg-[#D6FF20]"></div>
            <div className="w-2 h-2 rounded-full bg-[#D6FF20]"></div>
            <div className="w-2 h-2 rounded-full bg-[#D6FF20]"></div>
            <div className="w-2 h-2 rounded-full bg-white/10"></div>
          </div>
        </div>

      </div>

      {/* Main Stats Grid : Charts and Sidebar controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Chart Column (8 spans) */}
        <div className="lg:col-span-8 bg-[#161A20] border border-white/5 p-5 rounded-lg" id="dashboard-trends-chart">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white font-sans">Cashflow & Transaction Trends</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5 font-sans">Chronological summary of verified cash inflows vs outflows.</p>
            </div>
            
            <div className="flex items-center gap-3 text-[10px] font-mono font-semibold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D6FF20]" />
                <span className="text-[#A1A1AA]">Income</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FB7185]" />
                <span className="text-[#A1A1AA]">Expense</span>
              </div>
            </div>
          </div>

          <div className="h-72 w-full font-mono" id="trends-chart-container">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-600 font-mono text-xs">
                No verified transactions recorded in chronological series
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D6FF20" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#D6FF20" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FB7185" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#FB7185" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#22252A" />
                  <XAxis dataKey="date" stroke="#71717A" fontSize={10} fontFamily="var(--font-mono)" />
                  <YAxis stroke="#71717A" fontSize={10} fontFamily="var(--font-mono)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#161A20', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="Income" stroke="#D6FF20" strokeWidth={1.5} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="Expense" stroke="#FB7185" strokeWidth={1.5} fillOpacity={1} fill="url(#colorExpense)" fillRule="evenodd" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Sidebar Panel: Sharing / Quick Actions (4 spans) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Quick Sharing panel */}
          <div className="bg-[#161A20] border border-white/5 p-5 rounded-lg space-y-4" id="whatsapp-sharing-panel">
            <h3 className="text-xs font-bold font-mono text-[#D6FF20] uppercase tracking-widest text-[#D6FF20]">
              Actionable Broadcasting
            </h3>
            <p className="text-[10px] text-zinc-400 leading-normal font-sans">
              Directly feed verified aggregates and active goals into beautiful, mobile-friendly WhatsApp updates to share with members, committee forums, or public status groups.
            </p>

            <div className="space-y-2" id="whatsapp-shareactions">
              {/* Report Share */}
              <a
                id="share-whatsapp-summary"
                href={`https://api.whatsapp.com/send?text=${getWhatsAppMessage('summary')}`}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-[#1B2028] hover:bg-[#0F1115] border border-white/5 hover:border-white/10 transition-all py-2 px-3 rounded text-left block text-xs cursor-pointer group"
              >
                <div className="flex justify-between items-center text-[#D6FF20] font-semibold mb-1 uppercase tracking-wider text-[10px] font-mono">
                  <span>Broadcast Ledger Pulse</span>
                  <Share2 size={11} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
                <span className="text-[9px] font-mono text-zinc-400 block truncate font-mono">Balance sheet, income, expenses, active links</span>
              </a>

              {/* Campaign Progress Share */}
              <a
                id="share-whatsapp-campaign"
                href={`https://api.whatsapp.com/send?text=${getWhatsAppMessage('campaign')}`}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-[#1B2028] hover:bg-[#0F1115] border border-white/5 hover:border-white/10 transition-all py-2 px-3 rounded text-left block text-xs cursor-pointer group"
              >
                <div className="flex justify-between items-center text-white font-semibold mb-1 uppercase tracking-wider text-[10px] font-mono">
                  <span className="flex items-center gap-1">📊 Drive Monitor</span>
                  <Share2 size={11} className="group-hover:translate-x-0.5 transition-transform text-zinc-400" />
                </div>
                <span className="text-[9px] font-mono text-zinc-400 block truncate font-mono">Target goal progress and contributor invitation</span>
              </a>
            </div>
          </div>

          {/* Quick Audit Timings Panel */}
          <div className="bg-[#161A20] border border-white/5 p-5 rounded-lg flex-1 flex flex-col justify-between" id="quick-audit-feed">
            <div>
              <div className="flex justify-between items-center mb-3 border-b border-white/5 pb-2">
                <h3 className="text-xs font-bold font-mono text-[#D6FF20] uppercase tracking-wider">
                  Live Audit Feed
                </h3>
                <button 
                  id="view-all-audits-btn"
                  onClick={() => onNavigate('audits')}
                  className="text-[10px] text-zinc-400 hover:text-white font-mono flex items-center cursor-pointer"
                >
                  <span>More &rarr;</span>
                </button>
              </div>

              <div className="space-y-3" id="audit-feed-list">
                {audits.slice(0, 3).map((log) => (
                  <div key={log.id} className="text-left text-xs border-l border-white/10 pl-3 relative pr-1" id={`audit-feed-${log.id}`}>
                    <span className="absolute left-0 -translate-x-[4.5px] top-1.5 w-2 h-2 rounded-full bg-[#D6FF20]" />
                    <p className="text-white text-[11px] leading-tight font-mono">{log.details}</p>
                    <span className="text-[9px] font-mono text-zinc-500 mt-0.5 block">
                      By {log.userName} • {new Date(log.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                {audits.length === 0 && (
                  <p className="text-zinc-650 text-xs italic font-mono text-center py-4">No logged operations yet.</p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5">
              <div className="text-[9px] text-[#A1A1AA] uppercase mb-1 font-mono">WORKSPACE CODEID</div>
              <div className="text-[10px] font-mono text-[#D6FF20] bg-black/30 p-2 rounded border border-white/5 select-all truncate">
                ORG-TRANS-SECURE-{orgSlug.toUpperCase()}
              </div>
            </div>
          </div>

        </div>
      </div>

       {/* Transaction Approvals pipeline (Visible to Admins & Treasurers) */}
      {(role === 'Admin' || role === 'Treasurer') && (
        <div className="bg-[#161A20] border border-white/5 p-5 rounded-lg" id="dashboard-approvals-pipeline">
          <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2 font-sans">
                Approvals Queue
                {pendingTransactions.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-[#D6FF20]/20 text-[#D6FF20] font-mono font-bold text-[9px] uppercase tracking-wider">
                    {pendingTransactions.length} Pending
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-zinc-400 mt-0.5 font-sans">Evaluate incoming income declarations or expense reports proposed by members.</p>
            </div>
            
            <button
              id="goto-approvals-queue-btn"
              onClick={() => onNavigate('transactions')}
              className="text-[10px] font-bold uppercase tracking-wider text-[#D6FF20] hover:text-[#C5F000] flex items-center gap-0.5 cursor-pointer"
            >
              <span>Verify Pipeline</span>
              <ChevronRight size={12} />
            </button>
          </div>

          {pendingTransactions.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 flex flex-col items-center justify-center gap-1.5 bg-black/20 border border-white/5 rounded">
              <Check className="text-[#D6FF20]" size={16} />
              <p className="text-xs font-mono uppercase tracking-wider">Ledger is clean. No transactional sign-offs pending.</p>
            </div>
          ) : (
            <div className="overflow-x-auto" id="pending-transactions-table">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-zinc-400 font-mono text-[10px] tracking-widest uppercase">
                    <th className="pb-2.5 font-medium italic">Proposal title</th>
                    <th className="pb-2.5 font-medium">Type</th>
                    <th className="pb-2.5 font-medium">Amount</th>
                    <th className="pb-2.5 font-medium">Proposed by</th>
                    <th className="pb-2.5 text-right font-medium">Action decisions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-xs">
                  {pendingTransactions.slice(0, 5).map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/5 transition-all animate-fade-in" id={`pending-tr-${tx.id}`}>
                      <td className="py-3">
                        <div>
                          <span className="text-white font-medium block font-sans">{tx.title}</span>
                          <span className="text-zinc-500 text-[9px] font-mono">{tx.category} • {new Date(tx.date).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${tx.type === 'Income' ? 'bg-[#D6FF20]/20 text-[#D6FF20]' : 'bg-red-500/20 text-red-500'}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-[#D6FF20] font-semibold">
                        {symbol}{tx.amount.toLocaleString()}
                      </td>
                      <td className="py-3 text-zinc-400 font-sans">
                        {tx.createdByUserName}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            id={`approve-btn-${tx.id}`}
                            onClick={() => onApproveTransaction(tx.id, 'Approved')}
                            className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-800/40 text-[9px] font-mono font-bold uppercase rounded-sm flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Check size={9} />
                            <span>Approve</span>
                          </button>
                          
                          <button
                            id={`reject-btn-${tx.id}`}
                            onClick={() => onApproveTransaction(tx.id, 'Rejected')}
                            className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-900/40 text-rose-400 text-[9px] font-mono font-bold uppercase rounded-sm flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <X size={9} />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
