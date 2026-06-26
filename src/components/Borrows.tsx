/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Check,
  Trash,
  Coins,
  ShieldCheck,
  X,
  AlertCircle,
  Calendar,
  Percent,
  TrendingUp,
  HelpCircle,
  PiggyBank,
  ChevronDown,
  ChevronUp,
  Users,
  Eye,
  EyeOff,
  UserCheck,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign
} from 'lucide-react';
import { BorrowRecord, BorrowRepayment, CURRENCY_SYMBOLS, OrganizationCurrency, UserRole } from '../types';

interface BorrowsProps {
  currency: OrganizationCurrency;
  role: UserRole;
  token: string;
  onRefresh: () => void;
}

export function Borrows({
  currency,
  role,
  token,
  onRefresh
}: BorrowsProps) {
  const symbol = CURRENCY_SYMBOLS[currency] || '₹';

  // Lists state
  const [borrows, setBorrows] = useState<BorrowRecord[]>([]);
  const [repayments, setRepayments] = useState<BorrowRepayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & tab states
  const [activeSubTab, setActiveSubTab] = useState<'from_union' | 'by_union'>('from_union');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  // Modals state
  const [isNewRecordOpen, setIsNewRecordOpen] = useState(false);
  const [isEditRecordOpen, setIsEditRecordOpen] = useState(false);
  const [isRepayOpen, setIsRepayOpen] = useState(false);

  // Form states
  const [recordForm, setRecordForm] = useState({
    type: 'borrowed_from_union' as 'borrowed_from_union' | 'borrowed_by_union',
    borrowerName: '',
    lenderName: '',
    amount: '',
    purpose: '',
    dueDate: '',
    notes: '',
    publicVisible: true
  });

  const [editRecordForm, setEditRecordForm] = useState({
    id: '',
    borrowerName: '',
    lenderName: '',
    amount: '',
    purpose: '',
    dueDate: '',
    notes: '',
    status: 'active' as any,
    publicVisible: true
  });

  const [repayForm, setRepayForm] = useState({
    borrowRecordId: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Bank Transfer',
    note: ''
  });

  const [activeRecordForRepay, setActiveRecordForRepay] = useState<BorrowRecord | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/borrows', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch borrow records.');
      setBorrows(data.borrows || []);
      setRepayments(data.repayments || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [token]);

  // Actions
  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const bName = recordForm.type === 'borrowed_from_union' ? recordForm.borrowerName : 'Union Ledger';
    const lName = recordForm.type === 'borrowed_by_union' ? recordForm.lenderName : 'Union Ledger';

    if (!bName || !lName || !recordForm.amount) {
      setError('Please fill in borrower name, lender name and amount.');
      return;
    }

    try {
      const response = await fetch('/api/borrows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...recordForm,
          borrowerName: bName,
          lenderName: lName
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create record.');

      setIsNewRecordOpen(false);
      setRecordForm({
        type: 'borrowed_from_union',
        borrowerName: '',
        lenderName: '',
        amount: '',
        purpose: '',
        dueDate: '',
        notes: '',
        publicVisible: true
      });
      fetchRecords();
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch('/api/borrows/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editRecordForm)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update record.');

      setIsEditRecordOpen(false);
      fetchRecords();
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleApproveRecord = async (id: string) => {
    setError(null);
    try {
      const response = await fetch('/api/borrows/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to approve record.');

      fetchRecords();
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRecordRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!repayForm.amount || !repayForm.paymentDate) {
      setError('Repayment amount and date are required.');
      return;
    }

    try {
      const response = await fetch('/api/borrows/repay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(repayForm)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to record repayment.');

      setIsRepayOpen(false);
      setRepayForm({
        borrowRecordId: '',
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Bank Transfer',
        note: ''
      });
      setActiveRecordForRepay(null);
      fetchRecords();
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleWaiveRecord = async (id: string) => {
    setError(null);
    try {
      const response = await fetch('/api/borrows/waive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to complete waive action.');

      alert(data.message || 'Borrow record waived successfully.');
      fetchRecords();
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm('Are you absolutely sure you want to delete this borrow ledger record? This will delete all repayment logs linked with it.')) return;
    setError(null);
    try {
      const response = await fetch('/api/borrows/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete record.');

      setExpandedRecordId(null);
      fetchRecords();
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openEditModal = (b: BorrowRecord) => {
    setEditRecordForm({
      id: b.id,
      borrowerName: b.borrowerName,
      lenderName: b.lenderName,
      amount: b.amount.toString(),
      purpose: b.purpose || '',
      dueDate: b.dueDate || '',
      notes: b.notes || '',
      status: b.status,
      publicVisible: b.publicVisible
    });
    setIsEditRecordOpen(true);
  };

  const openRepayModal = (b: BorrowRecord) => {
    setActiveRecordForRepay(b);
    setRepayForm({
      borrowRecordId: b.id,
      amount: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'Bank Transfer',
      note: ''
    });
    setIsRepayOpen(true);
  };

  const toggleExpandRecord = (id: string) => {
    if (expandedRecordId === id) {
      setExpandedRecordId(null);
    } else {
      setExpandedRecordId(id);
    }
  };

  // Calculations
  const fromUnionRecords = borrows.filter(b => b.type === 'borrowed_from_union');
  const byUnionRecords = borrows.filter(b => b.type === 'borrowed_by_union');

  // Stats
  const activeFromUnion = fromUnionRecords.filter(b => b.status !== 'waived');
  const activeByUnion = byUnionRecords.filter(b => b.status !== 'waived');

  const totalBorrowedFromUnion = activeFromUnion.reduce((sum, b) => sum + b.amount, 0);
  const totalRepaidToUnion = activeFromUnion.reduce((sum, b) => sum + b.amountRepaid, 0);
  const outstandingToUnion = activeFromUnion.reduce((sum, b) => sum + b.balanceDue, 0);

  const totalBorrowedByUnion = activeByUnion.reduce((sum, b) => sum + b.amount, 0);
  const totalRepaidByUnion = activeByUnion.reduce((sum, b) => sum + b.amountRepaid, 0);
  const outstandingByUnion = activeByUnion.reduce((sum, b) => sum + b.balanceDue, 0);

  // Filter items
  const activeList = activeSubTab === 'from_union' ? fromUnionRecords : byUnionRecords;
  const filteredList = activeList.filter(b => {
    const term = searchQuery.toLowerCase();
    const matchesSearch =
      b.borrowerName.toLowerCase().includes(term) ||
      b.lenderName.toLowerCase().includes(term) ||
      (b.purpose && b.purpose.toLowerCase().includes(term)) ||
      (b.notes && b.notes.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6" id="borrows-module">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#14171F] p-6 rounded-2xl border border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="text-brand w-5 h-5" />
            Borrow & Loan Ledger
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Track money borrowed from the student union and money the union owes to vendors or members, with cryptographic-certified ledger tracing and transparent public auditing.
          </p>
        </div>
        {(role === 'Admin' || role === 'Treasurer') && (
          <button
            onClick={() => {
              setRecordForm({
                type: activeSubTab === 'from_union' ? 'borrowed_from_union' : 'borrowed_by_union',
                borrowerName: activeSubTab === 'from_union' ? '' : 'Union Ledger',
                lenderName: activeSubTab === 'from_union' ? 'Union Ledger' : '',
                amount: '',
                purpose: '',
                dueDate: '',
                notes: '',
                publicVisible: true
              });
              setIsNewRecordOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-[#c0e61d] text-black font-semibold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-brand/10 self-start md:self-auto"
          >
            <Plus size={14} />
            Create Record
          </button>
        )}
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-800/60 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={16} />
          <div>
            <h4 className="text-xs font-bold text-rose-200">Processing Error Occurred</h4>
            <p className="text-[11px] text-rose-300/90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Stats Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="borrows-stats-dashboard">
        
        {/* Left Stats Section */}
        <div className="bg-[#14171F] p-5 rounded-2xl border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Borrowed From Union</span>
            <div className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
              <ArrowUpRight size={14} className="text-rose-400" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold tracking-tight text-white">{symbol}{outstandingToUnion.toLocaleString()}</span>
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 mt-2">
              <span>Total: {symbol}{totalBorrowedFromUnion.toLocaleString()}</span>
              <span>Repaid: {symbol}{totalRepaidToUnion.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-3 text-[10px] bg-zinc-800/30 p-2 rounded-lg border border-zinc-800/60">
            <span className="text-zinc-400">Receivable balance due to union.</span>
          </div>
        </div>

        {/* Center Stats Section */}
        <div className="bg-[#14171F] p-5 rounded-2xl border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Borrowed By Union</span>
            <div className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
              <ArrowDownLeft size={14} className="text-emerald-400" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold tracking-tight text-white">{symbol}{outstandingByUnion.toLocaleString()}</span>
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 mt-2">
              <span>Total: {symbol}{totalBorrowedByUnion.toLocaleString()}</span>
              <span>Repaid: {symbol}{totalRepaidByUnion.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-3 text-[10px] bg-zinc-800/30 p-2 rounded-lg border border-zinc-800/60">
            <span className="text-zinc-400">Payable balance owed by union.</span>
          </div>
        </div>

        {/* Right Info Section */}
        <div className="bg-[#14171F] p-5 rounded-2xl border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Waivers & Auditing</span>
            <div className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
              <ShieldCheck size={14} className="text-brand" />
            </div>
          </div>
          <div className="mt-3 text-xs text-zinc-300">
            <p className="leading-relaxed">
              Administrators have sole authorization to wave balances or approve transactions. Auditors can view all records. Viewers see public-visible ledger lines.
            </p>
          </div>
          <div className="mt-3 text-[10px] bg-zinc-800/30 p-2 rounded-lg border border-zinc-800/60">
            <span className="text-zinc-400">Real-time sync to Supabase engine is enabled.</span>
          </div>
        </div>
      </div>

      {/* Navigation and Filtering toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#14171F] p-4 rounded-xl border border-zinc-800">
        
        {/* Sub-tabs */}
        <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => {
              setActiveSubTab('from_union');
              setExpandedRecordId(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'from_union'
                ? 'bg-brand text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Borrowed FROM Union (Receivables)
          </button>
          <button
            onClick={() => {
              setActiveSubTab('by_union');
              setExpandedRecordId(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'by_union'
                ? 'bg-brand text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Borrowed BY Union (Payables)
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            placeholder="Search name, purpose, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-brand/40 min-w-[180px]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-brand/40"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="fully_paid">Fully Paid</option>
            <option value="overdue">Overdue</option>
            <option value="waived">Waived</option>
          </select>
        </div>
      </div>

      {/* Main Records List */}
      <div className="bg-[#14171F] rounded-2xl border border-zinc-800 overflow-hidden" id="borrows-table-container">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-mono">
            Loading ledger registry lines...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500 font-mono">
            No borrow/loan ledger records match criteria.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filteredList.map((b) => {
              const isExpanded = expandedRecordId === b.id;
              const titleName = b.type === 'borrowed_from_union' ? b.borrowerName : b.lenderName;
              
              // repayments list for this borrow
              const recordRepayments = repayments.filter(r => r.borrowRecordId === b.id);

              return (
                <div key={b.id} className="transition-all hover:bg-zinc-800/10">
                  {/* Row summary */}
                  <div
                    onClick={() => toggleExpandRecord(b.id)}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg border ${
                        b.type === 'borrowed_from_union'
                          ? 'bg-rose-950/20 border-rose-900/40 text-rose-400'
                          : 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400'
                      }`}>
                        {b.type === 'borrowed_from_union' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{titleName}</span>
                          {!b.approvedBy && (
                            <span className="text-[9px] font-mono bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded uppercase font-bold">Pending Approval</span>
                          )}
                          {!b.publicVisible && (
                            <span className="text-[9px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <EyeOff size={8} /> Private
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">{b.purpose || 'No purpose listed.'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 justify-between sm:justify-end">
                      <div className="text-right">
                        <span className="font-mono text-sm font-bold text-white block">{symbol}{b.balanceDue.toLocaleString()}</span>
                        <span className="text-[10px] font-mono text-zinc-500 block">Due of {symbol}{b.amount.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide font-bold border ${
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
                        {isExpanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail section */}
                  {isExpanded && (
                    <div className="px-5 pb-6 pt-2 border-t border-zinc-800 bg-[#0F1115]/40 space-y-4">
                      
                      {/* Meta stats bento rows */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="bg-[#14171F] p-3.5 rounded-xl border border-zinc-800/60">
                          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Due Date</span>
                          <span className="text-xs font-semibold text-white mt-1 block flex items-center gap-1.5">
                            <Calendar size={12} className="text-zinc-400" />
                            {b.dueDate ? new Date(b.dueDate).toLocaleDateString() : 'No limit'}
                          </span>
                        </div>
                        <div className="bg-[#14171F] p-3.5 rounded-xl border border-zinc-800/60">
                          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Created By</span>
                          <span className="text-xs font-semibold text-white mt-1 block">{b.createdByName || 'Unknown'}</span>
                        </div>
                        <div className="bg-[#14171F] p-3.5 rounded-xl border border-zinc-800/60">
                          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Approved Status</span>
                          <span className="text-xs font-semibold text-white mt-1 block flex items-center gap-1.5">
                            <ShieldCheck size={12} className={b.approvedBy ? "text-emerald-400" : "text-amber-500"} />
                            {b.approvedByName ? `By ${b.approvedByName}` : 'Requires verification'}
                          </span>
                        </div>
                        <div className="bg-[#14171F] p-3.5 rounded-xl border border-zinc-800/60">
                          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block">Notes</span>
                          <span className="text-xs text-zinc-300 mt-1 block truncate" title={b.notes}>{b.notes || 'No notes appended.'}</span>
                        </div>
                      </div>

                      {/* Repayment History list */}
                      <div className="bg-[#14171F] rounded-xl border border-zinc-800/60 overflow-hidden">
                        <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block font-bold">Repayment logs ({recordRepayments.length})</span>
                          {(role === 'Admin' || role === 'Treasurer') && b.status !== 'fully_paid' && b.status !== 'waived' && b.approvedBy && (
                            <button
                              onClick={() => openRepayModal(b)}
                              className="px-2 py-1 bg-brand hover:bg-[#c0e61d] text-black font-bold text-[10px] rounded flex items-center gap-1 cursor-pointer"
                            >
                              <Plus size={10} /> Record Repayment
                            </button>
                          )}
                        </div>
                        {recordRepayments.length === 0 ? (
                          <div className="p-4 text-center text-[10px] text-zinc-500 font-mono">
                            No repayment logs found for this borrow.
                          </div>
                        ) : (
                          <div className="divide-y divide-zinc-800">
                            {recordRepayments.map((r) => (
                              <div key={r.id} className="p-3 flex items-center justify-between gap-4 text-xs">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-white">{symbol}{r.amount.toLocaleString()}</span>
                                    <span className="text-[10px] text-zinc-400 font-mono">via {r.paymentMethod}</span>
                                  </div>
                                  <p className="text-[10px] text-zinc-500 mt-0.5">{r.note || 'No transaction note added.'}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-zinc-400 block">{new Date(r.paymentDate).toLocaleDateString()}</span>
                                  <span className="text-[9px] text-zinc-500 font-mono block">Logged by {r.recordedByName}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Detail operations buttons footer */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/60">
                        {/* Approval operations */}
                        {role === 'Admin' && !b.approvedBy && (
                          <button
                            onClick={() => handleApproveRecord(b.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-lg transition-all cursor-pointer"
                          >
                            <UserCheck size={12} /> Approve Record
                          </button>
                        )}

                        {/* Waiver operations */}
                        {b.status !== 'fully_paid' && b.status !== 'waived' && (role === 'Admin' || role === 'Treasurer') && (
                          <button
                            onClick={() => handleWaiveRecord(b.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 font-semibold text-xs rounded-lg transition-all cursor-pointer"
                          >
                            <ShieldCheck size={12} /> {role === 'Admin' ? 'Waive Balance' : 'Request Waiver'}
                          </button>
                        )}

                        {/* Admin edits and deletes */}
                        {role === 'Admin' && (
                          <>
                            <button
                              onClick={() => openEditModal(b)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 font-semibold text-xs rounded-lg transition-all cursor-pointer"
                            >
                              Edit Details
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(b.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-950/60 text-rose-400 border border-rose-900/40 font-semibold text-xs rounded-lg transition-all cursor-pointer ml-auto"
                            >
                              <Trash size={12} /> Delete Record
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Create Borrow Record */}
      {isNewRecordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsNewRecordOpen(false)} />
          <div className="bg-[#14171F] rounded-2xl border border-zinc-800 w-full max-w-lg z-10 overflow-hidden shadow-2xl animate-in fade-in-50">
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
              <h3 className="font-bold text-sm text-white">Create Borrow/Loan Record</h3>
              <button onClick={() => setIsNewRecordOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateRecord} className="p-5 space-y-4 text-xs">
              
              <div className="space-y-1">
                <label className="text-zinc-400 block font-semibold">Ledger Entry Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecordForm({
                      ...recordForm, 
                      type: 'borrowed_from_union',
                      borrowerName: '',
                      lenderName: 'Union Ledger'
                    })}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-semibold ${
                      recordForm.type === 'borrowed_from_union'
                        ? 'bg-brand/10 border-brand text-brand'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Borrowed From Union (Receivable)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordForm({
                      ...recordForm, 
                      type: 'borrowed_by_union',
                      borrowerName: 'Union Ledger',
                      lenderName: ''
                    })}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-semibold ${
                      recordForm.type === 'borrowed_by_union'
                        ? 'bg-brand/10 border-brand text-brand'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Borrowed By Union (Payable)
                  </button>
                </div>
              </div>

              {recordForm.type === 'borrowed_from_union' ? (
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-semibold">Borrower Name (Person/Member)</label>
                  <input
                    type="text"
                    required
                    value={recordForm.borrowerName}
                    onChange={(e) => setRecordForm({ ...recordForm, borrowerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-brand/40"
                    placeholder="e.g. Ahmed Salim"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-semibold">Lender Name (Person/Vendor)</label>
                  <input
                    type="text"
                    required
                    value={recordForm.lenderName}
                    onChange={(e) => setRecordForm({ ...recordForm, lenderName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-brand/40"
                    placeholder="e.g. Salim Electronics"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-zinc-400 block font-semibold">Principal Amount ({symbol})</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={recordForm.amount}
                  onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono focus:outline-none focus:border-brand/40"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-semibold">Purpose</label>
                  <input
                    type="text"
                    value={recordForm.purpose}
                    onChange={(e) => setRecordForm({ ...recordForm, purpose: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-brand/40"
                    placeholder="e.g. General emergency loan"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-semibold">Due Date</label>
                  <input
                    type="date"
                    value={recordForm.dueDate}
                    onChange={(e) => setRecordForm({ ...recordForm, dueDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-brand/40"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block font-semibold">Private Notes</label>
                <textarea
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-brand/40"
                  placeholder="Internal audit notes (hidden from public view)..."
                />
              </div>

              <div className="flex items-center gap-2 py-1 bg-zinc-900/40 px-3 rounded-xl border border-zinc-800">
                <input
                  type="checkbox"
                  id="pub-visible-check"
                  checked={recordForm.publicVisible}
                  onChange={(e) => setRecordForm({ ...recordForm, publicVisible: e.target.checked })}
                  className="w-4 h-4 rounded text-brand border-zinc-700 bg-zinc-800 accent-brand cursor-pointer"
                />
                <label htmlFor="pub-visible-check" className="text-zinc-300 font-semibold cursor-pointer">
                  Publicly Visible on Transparency Page
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsNewRecordOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-[#c0e61d] text-black font-semibold cursor-pointer"
                >
                  Create Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Borrow Record */}
      {isEditRecordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditRecordOpen(false)} />
          <div className="bg-[#14171F] rounded-2xl border border-zinc-800 w-full max-w-lg z-10 overflow-hidden shadow-2xl animate-in fade-in-50">
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
              <h3 className="font-bold text-sm text-white">Edit Borrow/Loan Record</h3>
              <button onClick={() => setIsEditRecordOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleEditRecord} className="p-5 space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-semibold">Borrower Name</label>
                  <input
                    type="text"
                    required
                    value={editRecordForm.borrowerName}
                    onChange={(e) => setEditRecordForm({ ...editRecordForm, borrowerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-semibold">Lender Name</label>
                  <input
                    type="text"
                    required
                    value={editRecordForm.lenderName}
                    onChange={(e) => setEditRecordForm({ ...editRecordForm, lenderName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-semibold">Amount ({symbol})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editRecordForm.amount}
                    onChange={(e) => setEditRecordForm({ ...editRecordForm, amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-semibold">Status</label>
                  <select
                    value={editRecordForm.status}
                    onChange={(e) => setEditRecordForm({ ...editRecordForm, status: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="partially_paid">Partially Paid</option>
                    <option value="fully_paid">Fully Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="waived">Waived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-semibold">Purpose</label>
                  <input
                    type="text"
                    value={editRecordForm.purpose}
                    onChange={(e) => setEditRecordForm({ ...editRecordForm, purpose: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-semibold">Due Date</label>
                  <input
                    type="date"
                    value={editRecordForm.dueDate}
                    onChange={(e) => setEditRecordForm({ ...editRecordForm, dueDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block font-semibold">Private Notes</label>
                <textarea
                  value={editRecordForm.notes}
                  onChange={(e) => setEditRecordForm({ ...editRecordForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white"
                />
              </div>

              <div className="flex items-center gap-2 py-1 bg-zinc-900/40 px-3 rounded-xl border border-zinc-800">
                <input
                  type="checkbox"
                  id="pub-visible-edit-check"
                  checked={editRecordForm.publicVisible}
                  onChange={(e) => setEditRecordForm({ ...editRecordForm, publicVisible: e.target.checked })}
                  className="w-4 h-4 rounded text-brand border-zinc-700 bg-zinc-800 accent-brand cursor-pointer"
                />
                <label htmlFor="pub-visible-edit-check" className="text-zinc-300 font-semibold cursor-pointer">
                  Publicly Visible on Transparency Page
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditRecordOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-[#c0e61d] text-black font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Record Repayment */}
      {isRepayOpen && activeRecordForRepay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsRepayOpen(false)} />
          <div className="bg-[#14171F] rounded-2xl border border-zinc-800 w-full max-w-md z-10 overflow-hidden shadow-2xl animate-in fade-in-50">
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
              <div>
                <h3 className="font-bold text-sm text-white">Record Repayment</h3>
                <span className="text-[10px] font-mono text-zinc-500 mt-0.5 block">
                  For: {activeRecordForRepay.type === 'borrowed_from_union' ? activeRecordForRepay.borrowerName : activeRecordForRepay.lenderName}
                </span>
              </div>
              <button onClick={() => setIsRepayOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleRecordRepayment} className="p-5 space-y-4 text-xs">
              
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-zinc-400 block font-semibold">Repayment Amount ({symbol})</label>
                  <span className="text-[10px] text-brand font-mono">Max Outstanding: {symbol}{activeRecordForRepay.balanceDue.toLocaleString()}</span>
                </div>
                <input
                  type="number"
                  step="any"
                  required
                  value={repayForm.amount}
                  onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-semibold">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={repayForm.paymentDate}
                    onChange={(e) => setRepayForm({ ...repayForm, paymentDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block font-semibold">Payment Method</label>
                  <select
                    value={repayForm.paymentMethod}
                    onChange={(e) => setRepayForm({ ...repayForm, paymentMethod: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Mobile Wallet">Mobile Money/Wallet</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 block font-semibold">Note / Explanation</label>
                <textarea
                  value={repayForm.note}
                  onChange={(e) => setRepayForm({ ...repayForm, note: e.target.value })}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none"
                  placeholder="e.g. First installment paid via bank transfer"
                />
              </div>

              <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800 text-[10px] text-zinc-400 space-y-1 leading-relaxed">
                <p className="font-semibold text-zinc-300">💡 Financial Sync Integration</p>
                {activeRecordForRepay.type === 'borrowed_from_union' ? (
                  <p>This repayment will automatically log an <strong className="text-emerald-400">Income Transaction</strong> of type "Borrow Repayment" to reflect instantly in union cash balances.</p>
                ) : (
                  <p>This repayment will automatically log an <strong className="text-rose-400">Expense Transaction</strong> of type "Borrow Repayment" to reflect instantly in union expenditures.</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsRepayOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand hover:bg-[#c0e61d] text-black font-semibold cursor-pointer"
                >
                  Record Repayment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
