/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Bell, BellRing, CheckCheck, Clock, ShieldCheck, CreditCard, UserPlus, Coins, Inbox, Trash2, AlertTriangle } from 'lucide-react';
import { OrganizationNotification } from '../types';

interface NotificationCenterProps {
  token: string;
  refreshToggle: boolean;
}

export function NotificationCenter({ token, refreshToggle }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<OrganizationNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Setting up active polling for dynamic updates
    const timer = setInterval(fetchNotifications, 10000);
    return () => clearInterval(timer);
  }, [token, refreshToggle]);

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  const markSingleRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notificationId: id })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      }
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'IncomeAdded':
        return <Coins className="text-emerald-400 h-4 w-4" />;
      case 'ExpenseAdded':
        return <CreditCard className="text-[#D6FF20] h-4 w-4" />;
      case 'TransactionApproved':
        return <ShieldCheck className="text-emerald-400 h-4 w-4" />;
      case 'TransactionRejected':
        return <Inbox className="text-rose-400 h-4 w-4" />;
      case 'DonationReceived':
        return <Coins className="text-brand h-4 w-4 animate-bounce" />;
      case 'MemberJoined':
        return <UserPlus className="text-blue-400 h-4 w-4" />;
      case 'TransactionDeleteRequested':
        return <AlertTriangle className="text-amber-400 h-4 w-4" />;
      case 'TransactionDeleteApproved':
      case 'TransactionDeleted':
        return <Trash2 className="text-rose-400 h-4 w-4" />;
      case 'TransactionDeleteRejected':
        return <Inbox className="text-zinc-500 h-4 w-4" />;
      default:
        return <Bell className="text-zinc-400 h-4 w-4" />;
    }
  };

  return (
    <div className="relative" id="notifications-dropdown">
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-brand-surface hover:bg-brand-secondary border border-zinc-800 hover:border-zinc-700 transition-all text-zinc-300 hover:text-white cursor-pointer"
      >
        {unreadCount > 0 ? (
          <>
            <BellRing className="h-5 w-5 text-brand animate-swing" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-brand-bg text-[9px] font-bold font-mono">
              {unreadCount}
            </span>
          </>
        ) : (
          <Bell className="h-5 w-5" />
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          <div 
            id="notifications-tray"
            className="absolute right-0 mt-2 w-80 md:w-96 bg-brand-surface border border-brand-secondary rounded-2xl shadow-xl shadow-black/80 z-50 overflow-hidden"
          >
            <div className="p-4 bg-brand-secondary border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-sans font-bold text-sm text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-brand/10 text-brand text-[10px] font-mono">
                    {unreadCount} New
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  id="mark-all-read-btn"
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[10px] font-mono hover:text-brand text-zinc-400 transition-colors cursor-pointer"
                >
                  <CheckCheck size={12} />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/65" id="notifications-list">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
                  <Inbox size={26} className="text-zinc-600" />
                  <p className="text-xs">No pending ledger notifications</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markSingleRead(n.id)}
                    className={`p-4 transition-all hover:bg-brand-secondary cursor-pointer flex gap-3 ${!n.isRead ? 'bg-brand/5 border-l-2 border-brand' : ''}`}
                    id={`notification-item-${n.id}`}
                  >
                    <div className="p-1.5 rounded-lg bg-brand-bg h-fit border border-zinc-800">
                      {getIcon(n.type)}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs font-semibold text-white leading-tight">{n.title}</h4>
                        <span className="text-[9px] font-mono text-zinc-500 whitespace-nowrap flex items-center gap-0.5">
                          <Clock size={8} />
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-normal text-left">{n.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="bg-brand-secondary/40 p-3 border-t border-zinc-900 border-dashed text-center text-[10px] font-mono text-zinc-500">
              LEDGER AUDIT STREAMING ENABLED
            </div>
          </div>
        </>
      )}
    </div>
  );
}
