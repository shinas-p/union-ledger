/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  FileCheck, 
  UserPlus, 
  Settings, 
  Activity, 
  TrendingUp, 
  Download, 
  Clock, 
  X, 
  Info, 
  Calendar,
  AlertCircle,
  Search
} from 'lucide-react';
import { AuditLog } from '../types';

interface AuditsProps {
  token: string;
}

export function Audits({ token }: AuditsProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');

  const fetchAudits = async () => {
    try {
      const res = await fetch('/api/audits', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.audits || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAudits();
  }, [token]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.details.toLowerCase().includes(search.toLowerCase()) || 
                          log.userName.toLowerCase().includes(search.toLowerCase()) ||
                          log.action.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === 'All' || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const getLogIcon = (action: string) => {
    switch (action) {
      case 'organization_created':
        return <Settings className="text-brand h-4 w-4" />;
      case 'member_joined':
        return <UserPlus className="text-emerald-400 h-4 w-4" />;
      case 'role_changed':
        return <Activity className="text-[#A8CC00] h-4 w-4" />;
      case 'transaction_created':
        return <TrendingUp className="text-[#D6FF20] h-4 w-4" />;
      case 'transaction_approved':
        return <FileCheck className="text-emerald-400 h-4 w-4" />;
      case 'transaction_rejected':
        return <X className="text-rose-400 h-4 w-4" />;
      default:
        return <Info className="text-zinc-500 h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6 text-left" id="audit-trail-timeline-logs">
      
      {/* Header card with filters */}
      <div className="bg-brand-surface border border-brand-secondary p-5 rounded-2xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg font-sans font-bold text-white flex items-center gap-1.5">
              <span>Cryptographic Audit Trails</span>
              <span className="px-2 py-0.5 rounded bg-[#D6FF20]/10 text-brand text-[9px] font-mono tracking-wider">IMMUTABLE</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Every creation, modification, approval decision, or role state change is recorded with corresponding timestamps.
            </p>
          </div>

          {/* Filtering bar in-card */}
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search audit trail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-brand-bg text-xs pl-8 pr-3 py-1.5 rounded-lg border border-zinc-850 hover:border-zinc-800 text-white w-full md:w-56 focus:outline-none"
              />
            </div>

            <select
              id="audit-action-select"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-brand-bg text-xs border border-zinc-850 py-1.5 px-3 rounded-lg text-zinc-400 select focus:outline-none focus:border-brand cursor-pointer"
            >
              <option value="All">All Actions</option>
              <option value="transaction_created">Transaction Created</option>
              <option value="transaction_approved">Transaction Approved</option>
              <option value="transaction_rejected">Transaction Rejected</option>
              <option value="member_joined">Member Joined</option>
              <option value="role_changed">Member Role/Status altered</option>
              <option value="organization_created">Organization created</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timeline design layout */}
      <div className="bg-brand-surface border border-brand-secondary p-6 rounded-2xl relative" id="timeline-container">
        
        {/* Timeline dotted vertical background */}
        <div className="absolute left-[33px] md:left-[177px] top-6 bottom-6 border-l border-dashed border-zinc-800 pointer-events-none" />

        <div className="space-y-6" id="logs-mapped-pipeline">
          {filteredLogs.map((log) => (
            <div key={log.id} className="flex flex-col md:flex-row relative pl-12 md:pl-0" id={`audit-node-${log.id}`}>
              
              {/* Date Column (visible above sm screens as leftmost column) */}
              <div className="hidden md:block w-36 text-right pr-6 font-mono text-[10px] text-zinc-500 mt-1.5 whitespace-nowrap">
                <span className="block">{new Date(log.timestamp).toLocaleDateString()}</span>
                <span className="block text-[9px] text-zinc-600">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Central Circle Dot containing log specific icon */}
              <div className="absolute left-4 md:left-[158px] top-0 mr-4 p-2 rounded-full bg-brand-bg border border-zinc-800 z-10 flex items-center justify-center">
                {getLogIcon(log.action)}
              </div>

              {/* Main Log Card details */}
              <div className="flex-1 bg-brand-bg/40 border border-zinc-900 rounded-xl p-4 md:ml-6 hover:border-zinc-850 transition-all text-left">
                {/* Mobile time representation inside the card */}
                <div className="block md:hidden font-mono text-[9px] text-zinc-500 mb-1">
                  {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                  <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider block">
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  
                  <span className="text-[10px] font-mono text-zinc-400">
                    Operated by: <span className="text-[#D6FF20] font-sans font-semibold">{log.userName}</span>
                  </span>
                </div>

                <p className="text-white text-xs leading-relaxed">{log.details}</p>
                
                <span className="text-[9px] font-mono text-zinc-600 block mt-2">
                  System ID Reference: {log.id} • Secure Container Ledger
                </span>
              </div>

            </div>
          ))}

          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-zinc-500 flex flex-col items-center justify-center gap-2">
              <Calendar size={32} className="text-zinc-600 animate-pulse" />
              <p className="text-xs">No cryptographic log operations found with the queries typed.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
