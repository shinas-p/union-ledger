/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Check, 
  X, 
  Eye, 
  Paperclip, 
  Edit, 
  FileText, 
  FileCheck,
  AlertCircle,
  Download,
  Award,
  ChevronDown,
  FileSpreadsheet,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Transaction, Campaign, CURRENCY_SYMBOLS, OrganizationCurrency, UserRole } from '../types';

interface TransactionsProps {
  transactions: Transaction[];
  campaigns: Campaign[];
  currency: OrganizationCurrency;
  role: UserRole;
  token: string;
  onRefresh: () => void;
  onApproveTransaction: (id: string, status: 'Approved' | 'Rejected') => Promise<void>;
}

export function Transactions({ 
  transactions, 
  campaigns, 
  currency, 
  role,
  token,
  onRefresh,
  onApproveTransaction
}: TransactionsProps) {

  const symbol = CURRENCY_SYMBOLS[currency] || '₹';

  // State
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Income' | 'Expense'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Approved' | 'Pending' | 'Rejected'>('All');
  const [timeframeFilter, setTimeframeFilter] = useState<'All' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Custom'>('All');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // ModalsState
  const [isNewTxOpen, setIsNewTxOpen] = useState(false);
  const [isEditTxOpen, setIsEditTxOpen] = useState(false);
  const [isReceiptViewOpen, setIsReceiptViewOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [showDeletedLegacy, setShowDeletedLegacy] = useState(false);
  const [isDeleteReasonOpen, setIsDeleteReasonOpen] = useState(false);
  const [targetDeleteTx, setTargetDeleteTx] = useState<Transaction | null>(null);
  const [deleteReasonInput, setDeleteReasonInput] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    type: 'Income' as 'Income' | 'Expense',
    title: '',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    campaignId: '',
    receiptName: '',
    receiptData: '' // base64 string
  });

  const [activeEditTx, setActiveEditTx] = useState<Transaction | null>(null);
  const [activeReceiptUri, setActiveReceiptUri] = useState<string | null>(null);
  const [activeReceiptName, setActiveReceiptName] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Common categories
  const categories = formData.type === 'Income' 
    ? ['Membership Dues', 'Individual Donation', 'Corporate CSR', 'Grants', 'Sponsorship', 'Registrations', 'Other Income']
    : ['Office Utilities', 'Relief Operations', 'Catering', 'Campaign Advocacy', 'Utilities', 'Travel & Rent', 'Legal Aid', 'Printing', 'Other Expense'];

  // Handle Receipt selection, validate sizes (< 8MB)
  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (8MB max)
    const limitBytes = 8 * 1024 * 1024;
    if (file.size > limitBytes) {
      setError('File exceeds maximum 8MB size limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({
        ...prev,
        receiptName: file.name,
        receiptData: reader.result as string
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title || !formData.amount || !formData.category || !formData.date) {
      setError('Please fill in all target input fields.');
      return;
    }

    try {
      const isAutoApprove = role === 'Admin' || role === 'Treasurer';
      const statusValue = isAutoApprove ? 'Approved' : 'Pending';

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          status: statusValue
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit proposal.');

      setIsNewTxOpen(false);
      // Reset form
      setFormData({
        type: 'Income',
        title: '',
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        campaignId: '',
        receiptName: '',
        receiptData: ''
      });
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEditTx) return;
    setError(null);

    try {
      const response = await fetch('/api/transactions/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: activeEditTx.id,
          title: activeEditTx.title,
          amount: activeEditTx.amount,
          category: activeEditTx.category,
          description: activeEditTx.description,
          date: activeEditTx.date,
          campaignId: activeEditTx.campaignId
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update transaction.');

      setIsEditTxOpen(false);
      setActiveEditTx(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const triggerEdit = (tx: Transaction) => {
    setActiveEditTx(tx);
    setIsEditTxOpen(true);
  };

  const triggerDelete = (tx: Transaction) => {
    setTargetDeleteTx(tx);
    setDeleteReasonInput('');
    setIsDeleteReasonOpen(true);
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeleteTx) return;
    setError(null);

    try {
      const url = role === 'Admin' 
        ? '/api/transactions/direct-delete' 
        : '/api/transactions/request-delete';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transactionId: targetDeleteTx.id,
          reason: deleteReasonInput
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to dispatch deletion.');

      setIsDeleteReasonOpen(false);
      setTargetDeleteTx(null);
      setDeleteReasonInput('');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleApproveDelete = async (txId: string) => {
    setError(null);
    try {
      const r = await fetch('/api/transactions/approve-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transactionId: txId })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to approve delete request.');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRejectDelete = async (txId: string) => {
    setError(null);
    try {
      const r = await fetch('/api/transactions/reject-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transactionId: txId })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to reject delete request.');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Filter pipeline
  const filteredTransactions = transactions.filter(t => {
    // Soft-deleted records check
    if (t.deletedAt && !showDeletedLegacy) {
      return false;
    }

    // Search
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                          t.category.toLowerCase().includes(search.toLowerCase()) ||
                          t.createdByUserName.toLowerCase().includes(search.toLowerCase());
    
    // Type
    const matchesType = typeFilter === 'All' || t.type === typeFilter;

    // Status
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;

    // Dates
    let matchesTime = true;
    const txDate = new Date(t.date);
    const now = new Date();

    if (timeframeFilter === 'Monthly') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      matchesTime = txDate >= startOfMonth;
    } else if (timeframeFilter === 'Quarterly') {
      const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      matchesTime = txDate >= startOfQuarter;
    } else if (timeframeFilter === 'Yearly') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      matchesTime = txDate >= startOfYear;
    } else if (timeframeFilter === 'Custom') {
      if (customStart) {
        matchesTime = matchesTime && txDate >= new Date(customStart);
      }
      if (customEnd) {
        matchesTime = matchesTime && txDate <= new Date(customEnd);
      }
    }

    return matchesSearch && matchesType && matchesStatus && matchesTime;
  });

  // Export handlers
  const handleCSVExport = () => {
    setExportSuccess(null);
    let csv = 'ID,Type,Title,Amount,Category,Date,CreatedBy,ApprovedBy,Status,Description\n';
    filteredTransactions.forEach(t => {
      const row = [
        t.id,
        t.type,
        `"${t.title.replace(/"/g, '""')}"`,
        t.amount,
        t.category,
        t.date,
        `"${t.createdByUserName}"`,
        `"${t.approvedByUserName || 'N/A'}"`,
        t.status,
        `"${(t.description || '').replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `UnionLedger_FilterReport_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportSuccess('CSV Export ready. Initiated download.');
  };

  const handleExcelExport = () => {
    setExportSuccess(null);
    // Tab delimited representation (readable directly as Excel)
    let excel = 'ID\tType\tTitle\tAmount\tCategory\tDate\tCreatedBy\tApprovedBy\tStatus\tDescription\n';
    filteredTransactions.forEach(t => {
      excel += `${t.id}\t${t.type}\t${t.title}\t${t.amount}\t${t.category}\t${t.date}\t${t.createdByUserName}\t${t.approvedByUserName || 'N/A'}\t${t.status}\t${t.description || ''}\n`;
    });

    const blob = new Blob([excel], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `UnionLedger_FilterReport_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportSuccess('Excel Export sheet ready. Initiated download.');
  };

  // Helper to trigger receipt viewer
  const triggerReceiptPreview = (tx: Transaction) => {
    if (tx.receiptData) {
      setActiveReceiptUri(tx.receiptData);
      setActiveReceiptName(tx.receiptName || 'uploaded_receipt');
      setIsReceiptViewOpen(true);
    }
  };

  return (
    <div className="space-y-6" id="ledger-transactions-sec">
      
      {/* Header Block with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-brand-surface border border-brand-secondary p-5 rounded-2xl">
        <div>
          <h2 className="text-lg font-sans font-bold text-white">Verified Ledger Accountings</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Register Income declarations, approve operating expenditures, and audit receipts.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            id="open-export-modal-btn"
            onClick={() => { setIsExportOpen(true); setExportSuccess(null); }}
            className="px-3.5 py-2 hover:bg-zinc-850 bg-brand-bg border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-semibold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Download size={13} />
            <span>Generate Export Reports</span>
          </button>

          {role !== 'Viewer' && (
            <button
              id="open-new-proposal-btn"
              onClick={() => setIsNewTxOpen(true)}
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-brand-bg font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-all hover:scale-[1.01]"
            >
              <Plus size={14} />
              <span>Propose Ledger entry</span>
            </button>
          )}
        </div>
      </div>

      {/* Structured Complex Filters Section */}
      <div className="bg-brand-surface border border-brand-secondary p-5 rounded-2xl space-y-4" id="ledger-filters-bar">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* Searching input (span 4) */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by title, category, proposed by..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-brand-bg border border-brand-secondary hover:border-zinc-800 focus:border-brand rounded-lg pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-brand/45 focus:outline-none transition-all"
            />
          </div>

          {/* Type Filter (span 2) */}
          <div className="md:col-span-2">
            <div className="relative">
              <select
                id="type-filter-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full bg-brand-bg border border-brand-secondary rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-brand cursor-pointer appearance-none"
              >
                <option value="All">All Inflows/Outflows</option>
                <option value="Income">Income (Inflow)</option>
                <option value="Expense">Expense (Outflow)</option>
              </select>
            </div>
          </div>

          {/* Status Filter (span 2) */}
          <div className="md:col-span-2">
            <select
              id="status-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-brand-bg border border-brand-secondary rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-brand cursor-pointer focus:ring-1 focus:ring-brand/45 transition-all"
            >
              <option value="All">All Approval States</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending Queue</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Timeframe Filter (span 4) */}
          <div className="md:col-span-4 flex gap-2">
            <select
              id="timeframe-filter-select"
              value={timeframeFilter}
              onChange={(e) => setTimeframeFilter(e.target.value as any)}
              className="flex-1 bg-brand-bg border border-brand-secondary rounded-lg px-2 text-xs text-white focus:outline-none focus:border-brand cursor-pointer focus:ring-1 focus:ring-brand/45 transition-all"
            >
              <option value="All">All Lifespan Records</option>
              <option value="Monthly">Current Month</option>
              <option value="Quarterly">Current Quarter (90 Days)</option>
              <option value="Yearly">This Year (2026)</option>
              <option value="Custom">Custom Range...</option>
            </select>
          </div>

        </div>

        {/* Custom Date Selector Row (Visible only if filter === Custom) */}
        {timeframeFilter === 'Custom' && (
          <div className="flex gap-4 p-3 bg-brand-bg/40 border border-brand-secondary rounded-xl items-center animate-fade-in" id="custom-date-selectors">
            <Calendar size={14} className="text-zinc-500" />
            <span className="text-xs text-zinc-400 font-mono">Select Interval:</span>
            <input
              type="date"
              className="bg-brand-secondary border border-zinc-800 text-xs px-2 py-1 rounded text-white focus:outline-none focus:border-brand"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className="text-zinc-600 text-xs">—</span>
            <input
              type="date"
              className="bg-brand-secondary border border-zinc-800 text-xs px-2 py-1 rounded text-white focus:outline-none focus:border-brand"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
        )}
        {/* Toggle of soft deleted ledger logs */}
        {(role === 'Admin' || role === 'Treasurer' || role === 'Auditor') && (
          <div className="pt-2 border-t border-zinc-850/65 flex items-center justify-between gap-4">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none relative">
              <input
                id="toggle-deleted-audit-checkbox"
                type="checkbox"
                checked={showDeletedLegacy}
                onChange={(e) => setShowDeletedLegacy(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-zinc-800 rounded-full peer peer-focus:ring-1 peer-focus:ring-[#D6FF20]/50 peer-checked:bg-[#D6FF20]/25 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-500 after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:translate-x-3.5 peer-checked:after:bg-[#D6FF20] relative" />
              <span className="text-xs text-zinc-300 font-semibold font-mono tracking-wide uppercase">Include Soft-Deleted Audit Logs</span>
            </label>
            <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
              Only accessible to privileged roles (Admin, Treasurer, Auditor).
            </span>
          </div>
        )}
      </div>

      {/* Main Ledger Table view */}
      <div className="bg-brand-surface border border-brand-secondary rounded-2xl overflow-hidden" id="ledger-registry-table">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-850 bg-brand-secondary/40 text-zinc-500 font-mono text-[10px] tracking-widest uppercase">
                <th className="py-4 px-6">Date / Record</th>
                <th className="py-4 px-3">Flow</th>
                <th className="py-4 px-3">Amount</th>
                <th className="py-4 px-3">Category</th>
                <th className="py-4 px-3">Creator / Author</th>
                <th className="py-4 px-3">Resolution Status</th>
                <th className="py-4 px-6 text-right">Receipt / Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850 text-xs">
              {filteredTransactions.map((tx) => {
                const isDeleted = !!tx.deletedAt;
                const isRequested = tx.deletionStatus === 'requested';
                return (
                  <tr 
                    key={tx.id} 
                    className={`transition-all font-sans ${
                      isDeleted 
                        ? 'bg-rose-950/15 text-zinc-500 hover:bg-rose-950/20 opacity-75' 
                        : isRequested 
                          ? 'bg-amber-950/10 text-zinc-300 hover:bg-amber-950/15'
                          : 'hover:bg-brand-secondary/20 text-zinc-300'
                    }`} 
                    id={`tx-registry-${tx.id}`}
                  >
                    {/* Title & Date */}
                    <td className="py-4 px-6">
                      <div>
                        <span className={`text-white font-semibold leading-tight block ${isDeleted ? 'line-through text-zinc-500' : ''}`}>{tx.title}</span>
                        <span className="text-[10px] font-mono text-zinc-500 block mt-0.5">{tx.date} • ID: {tx.id.substring(0,8)}</span>
                        {isDeleted && tx.deletionReason && (
                          <span className="text-[10px] font-mono text-rose-400 mt-1 block">🚫 Deletion Reason: {tx.deletionReason}</span>
                        )}
                        {isRequested && tx.deletionReason && (
                          <span className="text-[10px] font-mono text-amber-400 mt-1 block">⚠️ Proposed Deletion Reason: {tx.deletionReason}</span>
                        )}
                      </div>
                    </td>
                    
                    {/* Flow Indicator */}
                    <td className="py-4 px-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${tx.type === 'Income' ? 'bg-emerald-950/40 text-emerald-400' : 'bg-rose-950/40 text-rose-400'}`}>
                        {tx.type}
                      </span>
                    </td>

                    {/* Amount with monospace formatting */}
                    <td className="py-4 px-3">
                      <span className={`font-mono font-semibold text-sm ${isDeleted ? 'line-through text-zinc-500' : 'text-white'}`}>
                        {symbol}{tx.amount.toLocaleString()}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="py-4 px-3 text-zinc-400 font-mono text-[11px]">
                      {tx.category}
                    </td>

                    {/* Creator */}
                    <td className="py-4 px-3">
                      <div>
                        <span className="text-zinc-300 block">{tx.createdByUserName}</span>
                        <span className="text-[10px] font-mono text-zinc-500 block">Proposed</span>
                      </div>
                    </td>

                    {/* Status pills or workflow trigger */}
                    <td className="py-4 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        {isDeleted ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-955/40 text-rose-400 border border-rose-900/40">
                            🚫 DELETED
                          </span>
                        ) : isRequested ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/40 text-amber-400 border border-amber-800/40 animate-pulse">
                            ⚠️ DELETE REQUEST
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            tx.status === 'Approved' ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/50' : 
                            tx.status === 'Pending' ? 'bg-yellow-950/40 text-amber-400 border border-amber-800/40 animate-pulse' : 
                            'bg-red-950/30 text-rose-400 border border-red-900/30'
                          }`}>
                            ● {tx.status}
                          </span>
                        )}
                        {!isDeleted && tx.status === 'Approved' && tx.approvedByUserName && (
                          <span className="text-[9px] font-mono text-zinc-500 block">Validated: {tx.approvedByUserName}</span>
                        )}
                        {isDeleted && tx.deletedBy && (
                          <span className="text-[9px] font-mono text-zinc-500 block">By Admin</span>
                        )}
                      </div>
                    </td>

                    {/* Receipts Attachment, actions, workflow decisions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2 items-center">
                        {tx.receiptData ? (
                          <button
                            id={`preview-receipt-btn-${tx.id}`}
                            onClick={() => triggerReceiptPreview(tx)}
                            className="p-1 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-mono font-medium flex items-center gap-1 cursor-pointer hover:border hover:border-brand/40"
                          >
                            <Paperclip size={10} />
                            <span>Receipt</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-zinc-600 italic">No receipt</span>
                        )}

                        {/* Edit option (only if not soft deleted) */}
                        {!isDeleted && !isRequested && (role === 'Admin' || role === 'Treasurer') && (
                          <button
                            id={`edit-tx-btn-${tx.id}`}
                            onClick={() => triggerEdit(tx)}
                            className="p-1 rounded bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-[#D6FF20] cursor-pointer"
                          >
                            <Edit size={11} />
                          </button>
                        )}

                        {/* Deletion option or approval controls */}
                        {!isDeleted && !isRequested && (role === 'Admin' || role === 'Treasurer') && (
                          <button
                            id={`delete-tx-btn-${tx.id}`}
                            onClick={() => triggerDelete(tx)}
                            className="p-1 rounded bg-zinc-850 hover:bg-rose-955/35 border border-zinc-800 hover:border-rose-900 text-zinc-400 hover:text-rose-400 cursor-pointer"
                            title={role === 'Admin' ? 'Soft-Delete' : 'Propose Deletion'}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}

                        {/* Direct approvals for Pending state */}
                        {!isDeleted && tx.status === 'Pending' && (role === 'Admin' || role === 'Treasurer') && (
                          <div className="flex gap-1 ml-2">
                            <button
                              id={`approve-col-btn-${tx.id}`}
                              onClick={() => onApproveTransaction(tx.id, 'Approved')}
                              className="bg-emerald-950 hover:bg-emerald-900 text-emerald-400 p-1 rounded cursor-pointer"
                              title="Quick Approve"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              id={`reject-col-btn-${tx.id}`}
                              onClick={() => onApproveTransaction(tx.id, 'Rejected')}
                              className="bg-rose-950 hover:bg-rose-900 text-rose-400 p-1 rounded cursor-pointer"
                              title="Quick Reject"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}

                        {/* Admin approval/rejection of Deletion Requests */}
                        {!isDeleted && isRequested && role === 'Admin' && (
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => handleApproveDelete(tx.id)}
                              className="bg-emerald-950 hover:bg-emerald-900 text-emerald-400 p-1 px-2 rounded cursor-pointer font-mono text-[9px] flex items-center gap-1"
                              title="Confirm soft deletion request"
                            >
                              <Check size={10} /> Approve Deletion
                            </button>
                            <button
                              onClick={() => handleRejectDelete(tx.id)}
                              className="bg-rose-950 hover:bg-rose-900 text-rose-400 p-1 px-2 rounded cursor-pointer font-mono text-[9px] flex items-center gap-1"
                              title="Reject deletion request"
                            >
                              <X size={10} /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText size={32} className="text-zinc-600" />
                      <p className="text-xs">No matching transactions found with the active filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          MODALS ENGINES
          ------------------------------------------------------------------- */}

      {/* Modal: New Transaction Form */}
      {isNewTxOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in" id="new-tx-modal">
          <div className="bg-brand-surface border border-brand-secondary max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="p-5 bg-brand-secondary border-b border-zinc-850 flex justify-between items-center">
              <h3 className="font-sans font-bold text-sm text-white">Propose Financial Transaction</h3>
              <button
                id="close-new-tx-btn"
                onClick={() => setIsNewTxOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="m-4 bg-red-950/40 border border-red-900 text-red-200 text-xs p-3 rounded-lg flex gap-1.5 items-center">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateTransaction} className="p-5 space-y-4">
              
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2" id="form-type-group">
                <button
                  id="form-type-income-btn"
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, type: 'Income', category: 'Membership Dues' }))}
                  className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${formData.type === 'Income' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-700 font-bold' : 'bg-brand-bg text-zinc-400 border-zinc-800'}`}
                >
                  ▲ Income (Inflow)
                </button>
                <button
                  id="form-type-expense-btn"
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, type: 'Expense', category: 'Office Utilities' }))}
                  className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${formData.type === 'Expense' ? 'bg-rose-950/20 text-rose-400 border-rose-800/80 font-bold' : 'bg-brand-bg text-zinc-400 border-zinc-800'}`}
                >
                  ▼ Expense (Outflow)
                </button>
              </div>

              {/* Title Input */}
              <div className="space-y-1" id="form-title-group">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Transaction Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Malkangiri membership fees"
                  value={formData.title}
                  onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-brand-bg border border-zinc-800 hover:border-zinc-700/85 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              {/* Amount and Dates in grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1" id="form-amount-group">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Amount ({symbol})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))}
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
                
                <div className="space-y-1" id="form-date-group">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Date of ledger entry</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Categories & Optional Campaign linking */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1" id="form-category-group">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))}
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1" id="form-campaign-group">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Campaign Drive (Optional)</label>
                  <select
                    value={formData.campaignId}
                    onChange={(e) => setFormData(p => ({ ...p, campaignId: e.target.value }))}
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="">General Reserve (No Campaign)</option>
                    {campaigns.filter(c => c.status === 'Active').map((camp) => (
                      <option key={camp.id} value={camp.id}>{camp.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1" id="form-desc-group">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Detailed Description / Purpose</label>
                <textarea
                  rows={2}
                  placeholder="Purpose of expenditures or receipt details..."
                  value={formData.description}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              {/* Receipt File upload */}
              <div className="space-y-1" id="form-receipt-upload-group">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Upload receipt verification file (Max 8MB)</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-zinc-800 hover:border-brand/40 bg-brand-bg/40 p-4 rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1"
                >
                  <Paperclip size={18} className="text-zinc-500 hover:text-brand" />
                  <span className="text-[11px] text-zinc-400">
                    {formData.receiptName ? (
                      <span className="text-brand font-semibold block truncate max-w-xs">{formData.receiptName}</span>
                    ) : (
                      <span>Drag receipt here or click to select image (PNG/JPG)</span>
                    )}
                  </span>
                  <span className="text-[9px] text-zinc-600 block">PDF / PNG / JPG formats accepted up to 8MB max</span>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleReceiptChange}
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                />
              </div>

              <div className="p-3 bg-brand-secondary text-[10px] text-zinc-400 rounded-lg text-left leading-normal">
                {role === 'Admin' || role === 'Treasurer' ? (
                  <span>🔒 Your role ({role}) grants immediate authorization power. Ledger transaction will be pre-approved instantly.</span>
                ) : (
                  <span>⚠️ Since you have lower clearance ({role}), your proposed transaction will queue in the Pending Approvals list.</span>
                )}
              </div>

              <button
                id="submit-new-tx-btn"
                type="submit"
                className="w-full bg-brand hover:bg-brand-hover text-brand-bg font-bold py-3 text-xs rounded-xl cursor-pointer hover:scale-[1.01] transition-all"
              >
                Submit transaction Proposal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Transaction Form */}
      {isEditTxOpen && activeEditTx && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in" id="edit-tx-modal">
          <div className="bg-brand-surface border border-brand-secondary max-w-md w-full rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="p-5 bg-brand-secondary border-b border-zinc-850 flex justify-between items-center">
              <h3 className="font-sans font-bold text-sm text-white">Modify Transaction Record</h3>
              <button
                id="close-edit-tx-btn"
                onClick={() => { setIsEditTxOpen(false); setActiveEditTx(null); }}
                className="text-zinc-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditTxSubmit} className="p-5 space-y-4 text-left">
              
              {/* Title */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Transaction Title</label>
                <input
                  type="text"
                  required
                  value={activeEditTx.title}
                  onChange={(e) => setActiveEditTx({ ...activeEditTx, title: e.target.value })}
                  className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Amount ({symbol})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={activeEditTx.amount}
                    onChange={(e) => setActiveEditTx({ ...activeEditTx, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Date</label>
                  <input
                    type="date"
                    required
                    value={activeEditTx.date}
                    onChange={(e) => setActiveEditTx({ ...activeEditTx, date: e.target.value })}
                    className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Category</label>
                <select
                  value={activeEditTx.category}
                  onChange={(e) => setActiveEditTx({ ...activeEditTx, category: e.target.value })}
                  className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Description</label>
                <textarea
                  rows={3}
                  value={activeEditTx.description || ''}
                  onChange={(e) => setActiveEditTx({ ...activeEditTx, description: e.target.value })}
                  className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <button
                id="submit-edit-tx-btn"
                type="submit"
                className="w-full bg-brand hover:bg-brand-hover text-brand-bg font-bold py-3 text-xs rounded-xl cursor-pointer hover:scale-[1.01] transition-all"
              >
                Save ledger modifications
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Receipt Dialogue */}
      {isReceiptViewOpen && activeReceiptUri && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 animate-fade-in" id="receipt-preview-modal">
          <div className="bg-brand-surface border border-brand-secondary max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="p-5 bg-brand-secondary border-b border-zinc-850 flex justify-between items-center">
              <span className="font-sans font-bold text-xs text-white truncate max-w-xs">{activeReceiptName}</span>
              <button
                id="close-receipt-preview-btn"
                onClick={() => { setIsReceiptViewOpen(false); setActiveReceiptUri(null); }}
                className="text-zinc-300 hover:text-white p-1 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 bg-brand-bg flex items-center justify-center min-h-64 max-h-96 overflow-auto">
              <img
                src={activeReceiptUri}
                alt="Receipt audit verify"
                referrerPolicy="no-referrer"
                className="max-w-full max-h-72 object-contain rounded-lg border border-zinc-800"
              />
            </div>

            <div className="p-4 bg-brand-secondary border-t border-zinc-900 flex justify-between items-center text-[10px] font-mono text-zinc-500">
              <span>Receipt file verified</span>
              <a
                href={activeReceiptUri}
                download={activeReceiptName}
                className="px-2.5 py-1 bg-brand-bg hover:bg-zinc-800 transition-colors border border-zinc-800 text-zinc-300 rounded block hover:text-brand"
              >
                Download Receipt File
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Dynamic Exports Reports Panel */}
      {isExportOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in" id="exports-reports-modal">
          <div className="bg-brand-surface border border-brand-secondary max-w-md w-full rounded-2xl overflow-hidden shadow-2xl relative text-left">
            <div className="p-5 bg-brand-secondary border-b border-zinc-850 flex justify-between items-center">
              <h3 className="font-sans font-bold text-sm text-white flex items-center gap-1.5">
                <FileCheck size={16} className="text-brand" />
                <span>Compile Financial Report Sheets</span>
              </h3>
              <button
                id="close-exports-modal-btn"
                onClick={() => setIsExportOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-brand-bg border border-brand-secondary p-4 rounded-xl space-y-1">
                <span className="text-[10px] font-mono text-[#D6FF20] tracking-wider block">CURRENT REPORT SCOPE SUMMARY</span>
                <div className="text-zinc-300 font-sans text-xs space-y-1">
                  <p>• <span className="text-white font-semibold">Inflows/Outflows Selected:</span> {typeFilter === 'All' ? 'Incomes & Expenses' : typeFilter}</p>
                  <p>• <span className="text-white font-semibold">Active Dates filter:</span> {timeframeFilter}</p>
                  <p>• <span className="text-white font-semibold">Total Registry rows to export:</span> <span className="text-[#D6FF20] font-mono font-bold">{filteredTransactions.length} items</span></p>
                </div>
              </div>

              {exportSuccess && (
                <div id="export-success-alert" className="bg-emerald-950/40 border border-emerald-900 text-emerald-200 text-xs p-3 rounded-lg flex gap-1.5 items-center">
                  <Check size={14} />
                  <span>{exportSuccess}</span>
                </div>
              )}

              <p className="text-zinc-500 text-[11px] leading-normal">
                Choose your desired export formatting type. The file will capture and pack the pre-filtered items, categories, approval audits, and notes.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Excel */}
                <button
                  id="export-xls-btn"
                  onClick={handleExcelExport}
                  className="p-4 rounded-xl bg-brand-secondary border border-zinc-800 hover:border-brand/40 text-center transition-all cursor-pointer group hover:scale-[1.01]"
                >
                  <FileSpreadsheet className="text-emerald-400 mx-auto mb-2 group-hover:scale-110 transition-transform" size={24} />
                  <span className="text-white text-xs font-semibold block">Excel Sheets</span>
                  <span className="text-zinc-500 text-[9px] font-mono mt-1 block">XLS format spreadsheet</span>
                </button>

                {/* CSV */}
                <button
                  id="export-csv-btn"
                  onClick={handleCSVExport}
                  className="p-4 rounded-xl bg-brand-secondary border border-zinc-800 hover:border-brand/40 text-center transition-all cursor-pointer group hover:scale-[1.01]"
                >
                  <FileText className="text-brand mx-auto mb-2 group-hover:scale-110 transition-transform" size={24} />
                  <span className="text-white text-xs font-semibold block">CSV Spreadsheet</span>
                  <span className="text-zinc-500 text-[9px] font-mono mt-1 block">Standard text comma-split</span>
                </button>
              </div>

              {/* Print-friendly PDF View Trigger */}
              <button
                id="export-print-raw-btn"
                onClick={() => {
                  window.print();
                  setExportSuccess('Initiated printable print/PDF compiling.');
                }}
                className="w-full mt-4 py-2.5 bg-brand hover:bg-brand-hover text-brand-bg hover:scale-[1.01] transition-all font-semibold rounded-lg text-xs flex justify-center items-center gap-1.5 cursor-pointer"
              >
                <Award size={13} />
                <span>Open Print / PDF compiled formatting</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal: Soft Deletion Reason dialog */}
      {isDeleteReasonOpen && targetDeleteTx && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in" id="delete-reason-modal">
          <div className="bg-brand-surface border border-brand-secondary max-w-md w-full rounded-2xl overflow-hidden shadow-2xl relative text-left text-zinc-300">
            <div className="p-5 bg-brand-secondary border-b border-zinc-850 flex justify-between items-center">
              <h3 className="font-sans font-bold text-sm text-white flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-rose-400" />
                <span>{role === 'Admin' ? 'Confirm Soft Deletion' : 'Propose Transaction Deletion'}</span>
              </h3>
              <button
                id="close-delete-reason-btn"
                onClick={() => { setIsDeleteReasonOpen(false); setTargetDeleteTx(null); setDeleteReasonInput(''); }}
                className="text-zinc-400 hover:text-white p-1 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmDelete} className="p-5 space-y-4">
              {error && (
                <div className="bg-rose-950/30 border border-rose-900 text-rose-300 text-xs p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Target Transaction</span>
                <div className="p-3 bg-brand-bg rounded-lg border border-zinc-850 text-xs text-zinc-300">
                  <span className="text-white font-bold block">{targetDeleteTx.title}</span>
                  <span className="text-zinc-400 block mt-1">{symbol}{targetDeleteTx.amount.toLocaleString()} • {targetDeleteTx.category} • {targetDeleteTx.date}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block">Reason for Deletion</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide an auditable reason for erasing this financial ledger record..."
                  value={deleteReasonInput}
                  onChange={(e) => setDeleteReasonInput(e.target.value)}
                  className="w-full bg-brand-bg border border-zinc-800 focus:border-brand rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand/45"
                />
              </div>

              <button
                id="submit-delete-reason-btn"
                type="submit"
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 text-xs rounded-xl cursor-pointer hover:scale-[1.01] transition-all"
              >
                {role === 'Admin' ? 'Confirm and soft-delete' : 'Submit Deletion Request'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
