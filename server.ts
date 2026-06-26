/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { 
  UserProfile, 
  Organization, 
  OrganizationMember, 
  InviteLink, 
  Transaction, 
  Campaign, 
  AuditLog, 
  OrganizationNotification,
  UserRole,
  OrganizationCurrency,
  BorrowRecord,
  BorrowRepayment
} from './src/types';

import dotenv from 'dotenv';
dotenv.config();

import * as supabaseService from './src/lib/supabaseService';

// Simple file-based database for persistence
const DB_FILE = path.join(process.cwd(), 'src', 'db.json');

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ'
};

interface DatabaseSchema {
  users: Record<string, UserProfile & { passwordHash: string }>;
  organizations: Record<string, Organization>;
  members: OrganizationMember[];
  invites: InviteLink[];
  transactions: Transaction[];
  campaigns: Campaign[];
  audits: AuditLog[];
  notifications: OrganizationNotification[];
  borrows: BorrowRecord[];
  repayments: BorrowRepayment[];
}

let dbMemoryCache: DatabaseSchema | null = null;

// Bidirectional translation to map custom sandbox text IDs (like 'user-admin', 'org-malkangiri') to valid PostgreSQL UUID format
const UUID_MAP_FORWARD: Record<string, string> = {
  'user-admin': '11111111-1111-4111-a111-111111111111',
  'user-treasurer': '22222222-2222-4222-a222-222222222222',
  'user-auditor': '33333333-3333-4333-a333-333333333333',
  'user-viewer': '44444444-4444-4444-a444-444444444444',
  'org-malkangiri': '55555555-5555-4555-b555-555555555555',
  'org-studentcommittee': '66666666-6666-4666-b666-666666666666',
};

// Auto-generate predictable standard UUIDs for other known indexed/numbered items
for (let i = 1; i <= 200; i++) {
  UUID_MAP_FORWARD[`m-${i}`] = `00000000-0000-4000-c000-${i.toString(16).padStart(12, '0')}`;
  UUID_MAP_FORWARD[`inv-${i}`] = `00000000-0000-4000-d000-${i.toString(16).padStart(12, '0')}`;
  UUID_MAP_FORWARD[`camp-${i}`] = `00000000-0000-4000-e000-${i.toString(16).padStart(12, '0')}`;
  UUID_MAP_FORWARD[`tx-${i}`] = `00000000-0000-4000-f000-${i.toString(16).padStart(12, '0')}`;
  UUID_MAP_FORWARD[`au-${i}`] = `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`;
  UUID_MAP_FORWARD[`not-${i}`] = `00000000-0000-4000-9000-${i.toString(16).padStart(12, '0')}`;
}

const UUID_MAP_REVERSE: Record<string, string> = {};
for (const key in UUID_MAP_FORWARD) {
  UUID_MAP_REVERSE[UUID_MAP_FORWARD[key]] = key;
}

function toSupabaseId(id: string | null | undefined): string | null {
  if (!id) return null;
  const trimmed = id.toLowerCase().trim();
  if (UUID_MAP_FORWARD[trimmed]) {
    return UUID_MAP_FORWARD[trimmed];
  }

  // If already structured like 'user-11111111-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
  const match = trimmed.match(/^([a-z]+-)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/);
  if (match) {
    return match[2];
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (uuidRegex.test(trimmed)) {
    return trimmed;
  }
  
  // Create deterministic UUID hash for custom client strings
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash << 5) - hash + trimmed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  
  let hexPrefix = '00000000';
  if (trimmed.startsWith('user-')) hexPrefix = '11111111';
  else if (trimmed.startsWith('org-')) hexPrefix = '22222222';
  else if (trimmed.startsWith('m-')) hexPrefix = '33333333';
  else if (trimmed.startsWith('camp-')) hexPrefix = '44444444';
  else if (trimmed.startsWith('tx-')) hexPrefix = '55555555';
  else if (trimmed.startsWith('inv-')) hexPrefix = '66666666';
  else if (trimmed.startsWith('not-')) hexPrefix = '77777777';
  else if (trimmed.startsWith('au-')) hexPrefix = '88888888';

  const customUuid = `${hexPrefix}-${hex.slice(0, 4)}-4000-a000-${hex.slice(4).padStart(12, '0')}`;
  
  UUID_MAP_FORWARD[trimmed] = customUuid;
  UUID_MAP_REVERSE[customUuid] = trimmed;
  return customUuid;
}

function fromSupabaseId(id: string | null | undefined): string | null {
  if (!id) return null;
  const trimmed = id.toLowerCase().trim();
  if (UUID_MAP_REVERSE[trimmed]) {
    return UUID_MAP_REVERSE[trimmed];
  }

  // Map deterministic first-block prefixes back statelessly
  if (trimmed.startsWith('11111111-')) return 'user-' + trimmed;
  if (trimmed.startsWith('22222222-')) return 'org-' + trimmed;
  if (trimmed.startsWith('33333333-')) return 'm-' + trimmed;
  if (trimmed.startsWith('44444444-')) return 'camp-' + trimmed;
  if (trimmed.startsWith('55555555-')) return 'tx-' + trimmed;
  if (trimmed.startsWith('66666666-')) return 'inv-' + trimmed;
  if (trimmed.startsWith('77777777-')) return 'not-' + trimmed;
  if (trimmed.startsWith('88888888-')) return 'au-' + trimmed;

  return trimmed;
}
function logSupabaseError(context: string, error: any) {
  if (!error) return;
  console.warn(`[Supabase Sync Warning] ${context}: ${error.message || error} (code: ${error.code || 'unknown'})`);
  if (error.details) console.warn(`Details: ${error.details}`);
  if (error.hint) console.warn(`Hint: ${error.hint}`);
}

function resolveRealUserId(orgId: string, placeholderUserId: string, db: DatabaseSchema): string {
  if (db.users[placeholderUserId]) return placeholderUserId;

  const roleMapping: Record<string, string> = {
    'user-admin': 'Admin',
    'user-treasurer': 'Treasurer',
    'user-auditor': 'Auditor',
    'user-viewer': 'Viewer'
  };

  const targetRole = roleMapping[placeholderUserId];
  if (targetRole) {
    const foundMember = db.members.find(m => m.orgId === orgId && m.role === targetRole && m.status === 'Active');
    if (foundMember && db.users[foundMember.userId]) {
      return foundMember.userId;
    }
  }

  // Fallback: try to find an Admin of the organization
  const adminMem = db.members.find(m => m.orgId === orgId && m.role === 'Admin' && m.status === 'Active');
  if (adminMem && db.users[adminMem.userId]) {
    return adminMem.userId;
  }

  // Fallback 2: first member of organization
  const anyMem = db.members.find(m => m.orgId === orgId && m.status === 'Active');
  if (anyMem && db.users[anyMem.userId]) {
    return anyMem.userId;
  }

  // Fallback 3: first user in DB
  const firstUser = Object.keys(db.users)[0];
  if (firstUser) return firstUser;

  return placeholderUserId;
}

// Clean up background sync for deleted rows
async function persistToSupabase(newDb: DatabaseSchema) {
  const client = supabaseService.getSupabaseClient();
  if (!client) return;

  try {
    // 1. Sync organizations
    const orgsPayload = Object.values(newDb.organizations).map((o: any) => ({
      id: toSupabaseId(o.id),
      name: o.name,
      description: o.description || null,
      logo_url: o.logoUrl || null,
      currency: o.currency,
      transparency_enabled: o.transparencyEnabled !== undefined ? o.transparencyEnabled : true,
      slug: o.slug,
      created_at: o.createdAt
    }));
    if (orgsPayload.length > 0) {
      const { error } = await client.from('organizations').upsert(orgsPayload);
      if (error) logSupabaseError('Error syncing organizations to Supabase', error);
    }

    // 2. Sync profiles
    const profilesPayload = Object.values(newDb.users).map((u: any) => {
      const orgIdExists = u.lastActiveOrgId && newDb.organizations[u.lastActiveOrgId];
      return {
        id: toSupabaseId(u.id),
        email: u.email,
        name: u.name,
        avatar_url: u.avatarUrl || null,
        last_active_org_id: orgIdExists ? toSupabaseId(u.lastActiveOrgId) : null,
        created_at: u.joinedAt
      };
    });
    if (profilesPayload.length > 0) {
      const { error } = await client.from('profiles').upsert(profilesPayload);
      if (error) logSupabaseError('Error syncing profiles to Supabase', error);
    }

    // 3. Sync campaigns
    const campaignsPayload = newDb.campaigns
      .filter((c: any) => c.orgId && newDb.organizations[c.orgId])
      .map((c: any) => ({
        id: toSupabaseId(c.id),
        org_id: toSupabaseId(c.orgId),
        title: c.title,
        description: c.description || null,
        goal_amount: c.goalAmount,
        start_date: c.startDate || null,
        end_date: c.endDate || null,
        status: c.status,
        created_at: c.createdAt
      }));
    if (campaignsPayload.length > 0) {
      const { error } = await client.from('campaigns').upsert(campaignsPayload);
      if (error) logSupabaseError('Error syncing campaigns to Supabase', error);
    }

    // 4. Sync members
    const membersPayload = newDb.members
      .filter((m: any) => m.orgId && newDb.organizations[m.orgId] && m.userId && newDb.users[m.userId])
      .map((m: any) => ({
        id: toSupabaseId(m.id),
        org_id: toSupabaseId(m.orgId),
        user_id: toSupabaseId(m.userId),
        role: m.role,
        status: m.status,
        joined_at: m.joinedAt
      }));
    if (membersPayload.length > 0) {
      const { error } = await client.from('organization_members').upsert(membersPayload);
      if (error) logSupabaseError('Error syncing organization_members to Supabase', error);
    }

    // Synchronize Member Deletions cleanly
    const currentMemberIds = newDb.members.map(m => toSupabaseId(m.id));
    if (currentMemberIds.length > 0) {
      const { data: dbMembers } = await client.from('organization_members').select('id');
      const dbMemberIds = (dbMembers || []).map(d => d.id);
      const toDelete = dbMemberIds.filter(id => !currentMemberIds.includes(id));
      if (toDelete.length > 0) {
        const { error } = await client.from('organization_members').delete().in('id', toDelete);
        if (error) logSupabaseError('Error deleting organization_members from Supabase', error);
      }
    }

    // 5. Sync transactions
    const transactionsPayload = newDb.transactions
      .filter((t: any) => t.orgId && newDb.organizations[t.orgId])
      .map((t: any) => {
        const campaignExists = t.campaignId && newDb.campaigns.some(c => c.id === t.campaignId);
        const creatorExists = t.createdByUserId && newDb.users[t.createdByUserId];
        const approverExists = t.approvedByUserId && newDb.users[t.approvedByUserId];
        const rejectorExists = t.rejectedByUserId && newDb.users[t.rejectedByUserId];
        return {
          id: toSupabaseId(t.id),
          org_id: toSupabaseId(t.orgId),
          type: t.type,
          title: t.title,
          amount: t.amount,
          category: t.category,
          description: t.description || null,
          date: t.date,
          status: t.status,
          campaign_id: campaignExists ? toSupabaseId(t.campaignId) : null,
          receipt_name: t.receiptName || null,
          receipt_url: t.receiptData || null,
          created_by: creatorExists ? toSupabaseId(t.createdByUserId) : null,
          approved_by: approverExists ? toSupabaseId(t.approvedByUserId) : null,
          rejected_by: rejectorExists ? toSupabaseId(t.rejectedByUserId) : null,
          approval_date: t.approvalDate || null,
          rejection_date: t.rejection_date || null,
          created_at: t.createdAt,

          deleted_at: t.deletedAt || null,
          deleted_by: t.deletedBy ? toSupabaseId(t.deletedBy) : null,
          deletion_reason: t.deletionReason || null,
          deletion_status: t.deletionStatus || 'none',
          deletion_requested_by: t.deletionRequestedBy ? toSupabaseId(t.deletionRequestedBy) : null,
          deletion_requested_at: t.deletionRequestedAt || null,
          deletion_approved_by: t.deletionApprovedBy ? toSupabaseId(t.deletionApprovedBy) : null,
          deletion_approved_at: t.deletionApprovedAt || null,
          deletion_rejected_by: t.deletionRejectedBy ? toSupabaseId(t.deletionRejectedBy) : null,
          deletion_rejected_at: t.deletionRejectedAt || null
        };
      });
    if (transactionsPayload.length > 0) {
      const { error } = await client.from('transactions').upsert(transactionsPayload);
      if (error) logSupabaseError('Error syncing transactions to Supabase', error);
    }

    // 6. Sync invites
    const invitesPayload = newDb.invites
      .filter((i: any) => i.orgId && newDb.organizations[i.orgId])
      .map((i: any) => {
        const creatorExists = i.createdBy && newDb.users[i.createdBy];
        return {
          id: toSupabaseId(i.id),
          org_id: toSupabaseId(i.orgId),
          role: i.role,
          code: i.code,
          expires_at: i.expiresAt || null,
          usage_limit: i.usageLimit || null,
          usage_count: i.usageCount,
          is_revoked: i.isRevoked,
          created_by: creatorExists ? toSupabaseId(i.createdBy) : null,
          created_at: i.createdAt
        };
      });
    if (invitesPayload.length > 0) {
      const { error } = await client.from('invite_links').upsert(invitesPayload);
      if (error) logSupabaseError('Error syncing invite_links to Supabase', error);
    }

    // 7. Sync notifications (resolving placeholders dynamically)
    const notificationsPayload = newDb.notifications
      .filter((n: any) => n.orgId && newDb.organizations[n.orgId] && n.userId)
      .map((n: any) => {
        const actualUserId = resolveRealUserId(n.orgId, n.userId, newDb);
        return {
          id: toSupabaseId(n.id),
          org_id: toSupabaseId(n.orgId),
          user_id: toSupabaseId(actualUserId),
          type: n.type,
          title: n.title,
          message: n.message,
          is_read: n.isRead,
          created_at: n.createdAt,

          target_user_id: n.targetUserId ? toSupabaseId(n.targetUserId) : null,
          target_role: n.targetRole || null,
          visibility_scope: n.visibilityScope || null,
          related_entity_type: n.relatedEntityType || null,
          related_entity_id: n.relatedEntityId ? toSupabaseId(n.relatedEntityId) : null
        };
      });
    if (notificationsPayload.length > 0) {
      const { error } = await client.from('notifications').upsert(notificationsPayload);
      if (error) logSupabaseError('Error syncing notifications to Supabase', error);
    }

    // 8. Sync audit logs
    const auditsPayload = newDb.audits
      .filter((a: any) => a.orgId && newDb.organizations[a.orgId])
      .map((a: any) => {
        const userExists = a.userId && a.userId !== 'system' && a.userId !== 'Deleted User' && newDb.users[a.userId];
        return {
          id: toSupabaseId(a.id),
          org_id: toSupabaseId(a.orgId),
          user_id: userExists ? toSupabaseId(a.userId) : null,
          user_name: a.userName,
          action: a.action,
          details: a.details,
          timestamp: a.timestamp
        };
      });
    if (auditsPayload.length > 0) {
      const { error } = await client.from('audit_logs').upsert(auditsPayload);
      if (error) logSupabaseError('Error syncing audit_logs to Supabase', error);
    }

    // 9. Sync borrow records
    const borrowsPayload = newDb.borrows
      .filter((b: any) => b.orgId && newDb.organizations[b.orgId])
      .map((b: any) => ({
        id: toSupabaseId(b.id),
        org_id: toSupabaseId(b.orgId),
        type: b.type,
        borrower_name: b.borrowerName,
        lender_name: b.lenderName,
        amount: b.amount,
        amount_repaid: b.amountRepaid,
        balance_due: b.balanceDue,
        purpose: b.purpose || null,
        due_date: b.dueDate || null,
        status: b.status,
        created_by: b.createdBy ? toSupabaseId(b.createdBy) : null,
        approved_by: b.approvedBy ? toSupabaseId(b.approvedBy) : null,
        created_at: b.createdAt,
        updated_at: b.updatedAt,
        notes: b.notes || null,
        public_visible: b.publicVisible
      }));
    if (borrowsPayload.length > 0) {
      const { error } = await client.from('borrow_records').upsert(borrowsPayload);
      if (error) logSupabaseError('Error syncing borrow_records to Supabase', error);
    }

    // Synchronize Borrow Record Deletions
    const currentBorrowIds = newDb.borrows.map(b => toSupabaseId(b.id));
    if (currentBorrowIds.length > 0) {
      const { data: dbBorrows } = await client.from('borrow_records').select('id');
      const dbBorrowIds = (dbBorrows || []).map(d => d.id);
      const toDelete = dbBorrowIds.filter(id => !currentBorrowIds.includes(id));
      if (toDelete.length > 0) {
        const { error } = await client.from('borrow_records').delete().in('id', toDelete);
        if (error) logSupabaseError('Error deleting borrow_records from Supabase', error);
      }
    }

    // 10. Sync borrow repayments
    const repaymentsPayload = newDb.repayments
      .filter((r: any) => r.orgId && newDb.organizations[r.orgId])
      .map((r: any) => ({
        id: toSupabaseId(r.id),
        borrow_record_id: toSupabaseId(r.borrowRecordId),
        org_id: toSupabaseId(r.orgId),
        amount: r.amount,
        payment_date: r.paymentDate,
        payment_method: r.paymentMethod || null,
        note: r.note || null,
        recorded_by: r.recordedBy ? toSupabaseId(r.recordedBy) : null,
        created_at: r.createdAt,
        transaction_id: r.transactionId ? toSupabaseId(r.transactionId) : null
      }));
    if (repaymentsPayload.length > 0) {
      const { error } = await client.from('borrow_repayments').upsert(repaymentsPayload);
      if (error) logSupabaseError('Error syncing borrow_repayments to Supabase', error);
    }

  } catch (err) {
    console.error('Error synchronizing database writes to Supabase:', err);
  }
}

async function loadDatabaseFromSupabase() {
  try {
    const client = supabaseService.getSupabaseClient();
    if (!client) return;

    console.log('Connecting to Supabase single source of truth context...');

    const [
      profilesRes,
      orgsRes,
      membersRes,
      campaignsRes,
      transactionsRes,
      invitesRes,
      notificationsRes,
      auditsRes,
      borrowRes,
      repaymentRes
    ] = await Promise.all([
      client.from('profiles').select('*'),
      client.from('organizations').select('*'),
      client.from('organization_members').select('*'),
      client.from('campaigns').select('*'),
      client.from('transactions').select('*'),
      client.from('invite_links').select('*'),
      client.from('notifications').select('*'),
      client.from('audit_logs').select('*'),
      client.from('borrow_records').select('*'),
      client.from('borrow_repayments').select('*')
    ]);

    const profiles = profilesRes.data;
    const orgs = orgsRes.data;
    const members = membersRes.data;
    const campaigns = campaignsRes.data;
    const transactions = transactionsRes.data;
    const invites = invitesRes.data;
    const notifications = notificationsRes.data;
    const audits = auditsRes.data;
    const borrowRecords = borrowRes?.data || [];
    const borrowRepayments = repaymentRes?.data || [];

    // Read local db.json if it exists to merge registered offline users/actions
    let localDb: DatabaseSchema | null = null;
    if (fs.existsSync(DB_FILE)) {
      try {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        localDb = JSON.parse(content);
      } catch (e) {
        console.error('Error reading local db.json', e);
      }
    }

    // Check if the database profiles are empty on Supabase, and seed default data if so.
    if (!profiles || profiles.length === 0) {
      console.log('Supabase database is empty. Syncing local db.json to Supabase...');
      const seedDb = localDb || seedDatabase();
      dbMemoryCache = seedDb;
      await persistToSupabase(seedDb);
      console.log('Database synced with Supabase successfully.');
      return;
    }

    const newDb: DatabaseSchema = {
      users: {},
      organizations: {},
      members: [],
      invites: [],
      transactions: [],
      campaigns: [],
      audits: [],
      notifications: [],
      borrows: [],
      repayments: []
    };

    (profiles || []).forEach((p: any) => {
      const mappedId = fromSupabaseId(p.id) || p.id;
      newDb.users[mappedId] = {
        id: mappedId,
        email: p.email,
        name: p.name || '',
        avatarUrl: p.avatar_url || '',
        lastActiveOrgId: fromSupabaseId(p.last_active_org_id) || undefined,
        joinedAt: p.created_at,
        passwordHash: p.password_hash || 'secret'
      };
    });

    (orgs || []).forEach((o: any) => {
      const mappedId = fromSupabaseId(o.id) || o.id;
      newDb.organizations[mappedId] = {
        id: mappedId,
        name: o.name,
        description: o.description || '',
        logoUrl: o.logo_url || '',
        currency: o.currency || 'INR',
        createdAt: o.created_at,
        slug: o.slug,
        transparencyEnabled: o.transparency_enabled
      };
    });

    newDb.members = (members || []).map((m: any) => {
      const uId = fromSupabaseId(m.user_id) || m.user_id;
      const p = (profiles || []).find((x: any) => x.id === m.user_id);
      return {
        id: fromSupabaseId(m.id) || m.id,
        orgId: fromSupabaseId(m.org_id) || m.org_id,
        userId: uId,
        userName: p?.name || 'Unknown User',
        userEmail: p?.email || '',
        userAvatarUrl: p?.avatar_url || '',
        role: m.role,
        status: m.status,
        joinedAt: m.joined_at
      };
    });

    newDb.campaigns = (campaigns || []).map((c: any) => ({
      id: fromSupabaseId(c.id) || c.id,
      orgId: fromSupabaseId(c.org_id) || c.org_id,
      title: c.title,
      description: c.description || '',
      goalAmount: Number(c.goal_amount),
      startDate: c.start_date || '',
      endDate: c.end_date || '',
      status: c.status,
      createdAt: c.created_at
    }));

    newDb.transactions = (transactions || []).map((t: any) => {
      const creator = (profiles || []).find((x: any) => x.id === t.created_by);
      const approver = (profiles || []).find((x: any) => x.id === t.approved_by);
      const rejector = (profiles || []).find((x: any) => x.id === t.rejected_by);
      return {
        id: fromSupabaseId(t.id) || t.id,
        orgId: fromSupabaseId(t.org_id) || t.org_id,
        type: t.type,
        title: t.title,
        amount: Number(t.amount),
        category: t.category,
        description: t.description || '',
        date: t.date,
        status: t.status,
        campaignId: fromSupabaseId(t.campaign_id) || undefined,
        receiptName: t.receipt_name || undefined,
        receiptData: t.receipt_url || undefined,
        createdByUserId: fromSupabaseId(t.created_by) || '',
        createdByUserName: creator?.name || 'Deleted User',
        approvedByUserId: fromSupabaseId(t.approved_by) || undefined,
        approvedByUserName: approver?.name || undefined,
        rejectedByUserId: fromSupabaseId(t.rejected_by) || undefined,
        rejectedByUserName: rejector?.name || undefined,
        approvalDate: t.approval_date || undefined,
        rejectionDate: t.rejection_date || undefined,
        createdAt: t.created_at,

        deletedAt: t.deleted_at || undefined,
        deletedBy: fromSupabaseId(t.deleted_by) || undefined,
        deletionReason: t.deletion_reason || undefined,
        deletionStatus: t.deletion_status || 'none',
        deletionRequestedBy: fromSupabaseId(t.deletion_requested_by) || undefined,
        deletionRequestedAt: t.deletion_requested_at || undefined,
        deletionApprovedBy: fromSupabaseId(t.deletion_approved_by) || undefined,
        deletionApprovedAt: t.deletion_approved_at || undefined,
        deletionRejectedBy: fromSupabaseId(t.deletion_rejected_by) || undefined,
        deletionRejectedAt: t.deletion_rejected_at || undefined
      };
    });

    newDb.invites = (invites || []).map((i: any) => ({
      id: fromSupabaseId(i.id) || i.id,
      orgId: fromSupabaseId(i.org_id) || i.org_id,
      role: i.role,
      code: i.code,
      expiresAt: i.expires_at || undefined,
      usageLimit: i.usage_limit || null,
      usageCount: i.usage_count || 0,
      isRevoked: i.is_revoked || false,
      createdAt: i.created_at,
      createdBy: fromSupabaseId(i.created_by) || ''
    }));

    newDb.notifications = (notifications || []).map((n: any) => {
      const uId = fromSupabaseId(n.user_id) || 'user-admin';
      return {
        id: fromSupabaseId(n.id) || n.id,
        orgId: fromSupabaseId(n.org_id) || n.org_id,
        userId: uId,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.is_read || false,
        createdAt: n.created_at,

        targetUserId: fromSupabaseId(n.target_user_id) || undefined,
        targetRole: n.target_role || undefined,
        visibilityScope: n.visibility_scope || undefined,
        relatedEntityType: n.related_entity_type || undefined,
        relatedEntityId: fromSupabaseId(n.related_entity_id) || n.related_entity_id || undefined
      };
    });

    newDb.audits = (audits || []).map((a: any) => ({
      id: fromSupabaseId(a.id) || a.id,
      orgId: fromSupabaseId(a.org_id) || a.org_id,
      userId: fromSupabaseId(a.user_id) || 'system',
      userName: a.user_name || 'System Ledger',
      action: a.action,
      details: a.details,
      timestamp: a.timestamp
    }));

    newDb.borrows = (borrowRecords || []).map((b: any) => {
      const creator = (profiles || []).find((x: any) => x.id === b.created_by);
      const approver = (profiles || []).find((x: any) => x.id === b.approved_by);
      return {
        id: fromSupabaseId(b.id) || b.id,
        orgId: fromSupabaseId(b.org_id) || b.org_id,
        type: b.type,
        borrowerName: b.borrower_name,
        lenderName: b.lender_name,
        amount: Number(b.amount),
        amountRepaid: Number(b.amount_repaid),
        balanceDue: Number(b.balance_due),
        purpose: b.purpose || '',
        dueDate: b.due_date || '',
        status: b.status,
        createdBy: fromSupabaseId(b.created_by) || '',
        createdByName: creator?.name || 'Unknown User',
        approvedBy: fromSupabaseId(b.approved_by) || null,
        approvedByName: approver?.name || null,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
        notes: b.notes || '',
        publicVisible: b.public_visible !== undefined ? b.public_visible : true
      };
    });

    newDb.repayments = (borrowRepayments || []).map((r: any) => {
      const recorder = (profiles || []).find((x: any) => x.id === r.recorded_by);
      return {
        id: fromSupabaseId(r.id) || r.id,
        borrowRecordId: fromSupabaseId(r.borrow_record_id) || r.borrow_record_id,
        orgId: fromSupabaseId(r.org_id) || r.org_id,
        amount: Number(r.amount),
        paymentDate: r.payment_date,
        paymentMethod: r.payment_method || '',
        note: r.note || '',
        recordedBy: fromSupabaseId(r.recorded_by) || '',
        recordedByName: recorder?.name || 'Unknown User',
        createdAt: r.created_at,
        transactionId: fromSupabaseId(r.transaction_id) || null
      };
    });

    // Merge any locally registered users/organizations to Supabase
    if (localDb) {
      let mergedAny = false;
      if (localDb.users) {
        Object.entries(localDb.users).forEach(([id, u]) => {
          if (!newDb.users[id]) {
            newDb.users[id] = u;
            mergedAny = true;
          }
        });
      }
      if (localDb.organizations) {
        Object.entries(localDb.organizations).forEach(([id, o]) => {
          if (!newDb.organizations[id]) {
            newDb.organizations[id] = o;
            mergedAny = true;
          }
        });
      }
      if (localDb.members) {
        localDb.members.forEach((m) => {
          if (!newDb.members.find(x => x.id === m.id)) {
            newDb.members.push(m);
            mergedAny = true;
          }
        });
      }
      if (localDb.campaigns) {
        localDb.campaigns.forEach((c) => {
          if (!newDb.campaigns.find(x => x.id === c.id)) {
            newDb.campaigns.push(c);
            mergedAny = true;
          }
        });
      }
      if (localDb.transactions) {
        localDb.transactions.forEach((t) => {
          if (!newDb.transactions.find(x => x.id === t.id)) {
            newDb.transactions.push(t);
            mergedAny = true;
          }
        });
      }
      if (localDb.invites) {
        localDb.invites.forEach((i) => {
          if (!newDb.invites.find(x => x.id === i.id)) {
            newDb.invites.push(i);
            mergedAny = true;
          }
        });
      }
      if (localDb.notifications) {
        localDb.notifications.forEach((n) => {
          if (!newDb.notifications.find(x => x.id === n.id)) {
            newDb.notifications.push(n);
            mergedAny = true;
          }
        });
      }
      if (localDb.audits) {
        localDb.audits.forEach((a) => {
          if (!newDb.audits.find(x => x.id === a.id)) {
            newDb.audits.push(a);
            mergedAny = true;
          }
        });
      }
      if (localDb.borrows) {
        localDb.borrows.forEach((b) => {
          if (!newDb.borrows.find(x => x.id === b.id)) {
            newDb.borrows.push(b);
            mergedAny = true;
          }
        });
      }
      if (localDb.repayments) {
        localDb.repayments.forEach((r) => {
          if (!newDb.repayments.find(x => x.id === r.id)) {
            newDb.repayments.push(r);
            mergedAny = true;
          }
        });
      }

      if (mergedAny) {
        console.log('Merging local records into Supabase registry cache...');
        persistToSupabase(newDb);
      }
    }

    dbMemoryCache = newDb;
    console.log(`Supabase synchronized successfully. Cached ${Object.keys(newDb.users).length} profiles, ${newDb.transactions.length} transactions.`);
  } catch (err) {
    console.error('Failed to pre-cache database from Supabase:', err);
  }
}

// Function to read JSON Database
function readDB(): DatabaseSchema {
  let db: DatabaseSchema;
  if (supabaseService.isSupabaseConfigured() && dbMemoryCache) {
    db = dbMemoryCache;
  } else {
    try {
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        db = JSON.parse(content);
      } else {
        db = seedDatabase();
      }
    } catch (err) {
      console.error('Error reading database file, resetting...', err);
      db = seedDatabase();
    }
  }

  // Defensively ensure all collection arrays/objects are initialized
  if (!db.users) db.users = {};
  if (!db.organizations) db.organizations = {};
  if (!db.members) db.members = [];
  if (!db.invites) db.invites = [];
  if (!db.transactions) db.transactions = [];
  if (!db.campaigns) db.campaigns = [];
  if (!db.audits) db.audits = [];
  if (!db.notifications) db.notifications = [];
  if (!db.borrows) db.borrows = [];
  if (!db.repayments) db.repayments = [];

  return db;
}

// Function to write JSON Database
async function writeDB(data: DatabaseSchema) {
  if (supabaseService.isSupabaseConfigured()) {
    dbMemoryCache = data;
    // Await the push to Supabase to guarantee persistence
    await persistToSupabase(data);
  }
  try {
    // Ensure parent directory exists
    const dirname = path.dirname(DB_FILE);
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database file...', err);
  }
}

// Helper to generate IDs
function uuid(prefix?: string): string {
  // Pure JS compliant RFC4122 v4 UUID generator
  const r = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  if (!prefix) return r;

  const suffix = r.substring(8);
  let valPrefix = '00000000';
  if (prefix === 'user') valPrefix = '11111111';
  else if (prefix === 'org') valPrefix = '22222222';
  else if (prefix === 'm') valPrefix = '33333333';
  else if (prefix === 'camp') valPrefix = '44444444';
  else if (prefix === 'tx') valPrefix = '55555555';
  else if (prefix === 'inv') valPrefix = '66666666';
  else if (prefix === 'not') valPrefix = '77777777';
  else if (prefix === 'au') valPrefix = '88888888';
  return `${prefix}-${valPrefix}${suffix}`;
}

// Seed Initial Data
function seedDatabase(): DatabaseSchema {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && parsed.users) {
        console.log('[SEED] Loaded existing seed data hierarchy from db.json.');
        return parsed;
      }
    } catch (e) {
      console.error('[SEED] Error seeding from local db.json', e);
    }
  }

  const users: Record<string, UserProfile & { passwordHash: string }> = {};
  const organizations: Record<string, Organization> = {};
  const members: OrganizationMember[] = [];
  const invites: InviteLink[] = [];
  const campaigns: Campaign[] = [];
  const transactions: Transaction[] = [];
  const audits: AuditLog[] = [];
  const notifications: OrganizationNotification[] = [];
  const borrows: BorrowRecord[] = [];
  const repayments: BorrowRepayment[] = [];

  const dbData = { users, organizations, members, invites, transactions, campaigns, audits, notifications, borrows, repayments };
  writeDB(dbData);
  return dbData;
}

// Initialize server
const app = express();
const PORT = 3000;

// Enable JSON parsing up to 10MB (for receipt images storage inside the local database)
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'ALLOWALL'); // For convenient preview layout inside context
  next();
});

// Middleware to intercept Supabase Auth Bearer JWT tokens and map them to local database profiles
app.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      // A Supabase JWT typically has '.' (JWT signature) and is long
      if (token && token.includes('.') && token.length > 50) {
        if (supabaseService.isSupabaseConfigured()) {
          const client = supabaseService.getSupabaseClient();
          if (client) {
            const { data: { user }, error } = await client.auth.getUser(token);
            if (error) {
              console.error('[AUTH MIDDLEWARE] Supabase JWT verification error:', error.message);
            } else if (user) {
              const db = readDB();
              let cachedUser = db.users[user.id];
              
              if (!cachedUser) {
                const lowerEmail = (user.email || '').toLowerCase().trim();
                const existing = Object.values(db.users).find(u => u.email.toLowerCase() === lowerEmail);
                           if (existing) {
                  // If user exists locally, map them to Supabase Authenticated UUID
                  cachedUser = existing;
                  delete db.users[existing.id];
                  cachedUser.id = user.id;
                  db.users[user.id] = cachedUser;
                  await writeDB(db);
                  console.log(`[AUTH MIDDLEWARE] Migrated user id to Supabase UID ${user.id}`);
                } else {
                  // Create a fresh cached user profile
                  cachedUser = {
                    id: user.id,
                    email: lowerEmail,
                    name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
                    joinedAt: user.created_at || new Date().toISOString(),
                    lastActiveOrgId: undefined,
                    passwordHash: ''
                  };
                  db.users[user.id] = cachedUser;
                  await writeDB(db);
                  console.log(`[AUTH MIDDLEWARE] Cached profile for user UID ${user.id}`);
                }
              }
              
              // Translate the request Authorization header to use the actual user UUID
              req.headers.authorization = `Bearer ${user.id}`;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[AUTH MIDDLEWARE] Fatal middleware error:', err);
  }
  next();
});

// Endpoint to provide public safe configuration metrics to the frontend
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rrujgyjaabbdlchgwfvl.supabase.co',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
  });
});

// Middleware for bearer token check
function getAuthUser(req: express.Request, db: DatabaseSchema): { user: UserProfile; role: UserRole; status: 'Active' | 'Suspended' } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  
  // Simulated token corresponds directly to userId for robust and easy state control
  const user = db.users[token];
  if (!user) return null;

  // Find membership in last active org
  const orgId = user.lastActiveOrgId;
  let role: UserRole = 'Viewer';
  let status: 'Active' | 'Suspended' = 'Active';

  if (orgId) {
    const membership = db.members.find(m => m.orgId === orgId && m.userId === user.id);
    if (membership) {
      role = membership.role;
      status = membership.status;
    }
  }

  return { user, role, status };
}

// -----------------------------------------------------
// API ROUTING
// -----------------------------------------------------

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Check Email Existence
app.get('/api/auth/check-email', async (req, res) => {
  const email = req.query.email;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email parameter is required' });
  }

  const lowerEmail = email.toLowerCase().trim();
  console.log(`[CHECK-EMAIL-BACKEND] Performing duplicate email registration check for: "${lowerEmail}"`);

  let exists = false;
  let source = "none";

  if (supabaseService.isSupabaseConfigured()) {
    try {
      console.log(`[CHECK-EMAIL-BACKEND] Supabase is configured active. Querying Supabase 'profiles' table directly...`);
      const supabaseUser = await supabaseService.getUserByEmail(lowerEmail);
      if (supabaseUser) {
        exists = true;
        source = "Supabase Profiles";
        console.log(`[CHECK-EMAIL-BACKEND] Duplicate detected: user found in active Supabase profiles.`);
      } else {
        console.log(`[CHECK-EMAIL-BACKEND] No profile found on Supabase for "${lowerEmail}". Checking local cache...`);
      }
    } catch (err) {
      console.error(`[CHECK-EMAIL-BACKEND] Supabase query error (falling back to memory):`, err);
    }
  }

  // Double check our local memory/disk cache
  const db = readDB();
  const cachedUser = Object.values(db.users).find(u => u.email.toLowerCase() === lowerEmail);

  if (cachedUser) {
    if (supabaseService.isSupabaseConfigured() && !exists) {
      // Stale cache detected! The user exists in local db.json but does not exist in Supabase Profiles.
      console.log(`[CHECK-EMAIL-BACKEND] self-healing event triggered! Email "${lowerEmail}" exists in stale local cache, but was deleted from Supabase. Purging stale local records...`);
      
      delete db.users[cachedUser.id];
      // Clean up organization memberships for deleted user
      db.members = db.members.filter(m => m.userId !== cachedUser.id);
      
      await writeDB(db);
      console.log(`[CHECK-EMAIL-BACKEND] Stale records purged successfully. Re-sync completed.`);
    } else if (!supabaseService.isSupabaseConfigured()) {
      exists = true;
      source = "Local Memory Cache";
    }
  }

  console.log(`[CHECK-EMAIL-BACKEND] Final result for "${lowerEmail}": exists=${exists} (source: ${source})`);
  res.json({ exists, source });
});

// Register User
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    console.warn('[SIGNUP] Failed registration attempt: missing fields.');
    return res.status(400).json({ error: 'Please supply name, email and password' });
  }

  const db = readDB();
  const lowerEmail = email.toLowerCase().trim();
  console.log(`[SIGNUP] Attempting user registration with email: "${lowerEmail}", Name: "${name}"`);
  
  const existing = Object.values(db.users).find(u => u.email.toLowerCase() === lowerEmail);
  if (existing) {
    console.warn(`[SIGNUP] Failed: user already exists with email "${lowerEmail}".`);
    return res.status(400).json({ error: 'An account with this email already exists' });
  }

  const userId = uuid('user');
  console.log(`[SIGNUP] Proceeding with registration. Generated user ID: ${userId}`);
  const newUser: UserProfile & { passwordHash: string } = {
    id: userId,
    name,
    email: lowerEmail,
    joinedAt: new Date().toISOString(),
    passwordHash: password, // Store password
    lastActiveOrgId: undefined
  };

  db.users[userId] = newUser;
  await writeDB(db);

  res.json({
    token: userId,
    user: {
      id: userId,
      email: newUser.email,
      name: newUser.name,
      lastActiveOrgId: undefined,
      joinedAt: newUser.joinedAt
    }
  });
});

// Login User
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    console.warn('[LOGIN] Blocked: Provide both email and password.');
    return res.status(400).json({ error: 'Provide both email and password' });
  }

  const db = readDB();
  const lowerEmail = email.toLowerCase().trim();
  console.log(`[LOGIN] Attempting user login with email: "${lowerEmail}"`);
  
  const user = Object.values(db.users).find(u => u.email.toLowerCase() === lowerEmail);

  if (!user || user.passwordHash !== password) {
    console.warn(`[LOGIN] Forbidden: Failed login attempt for email "${lowerEmail}"`);
    return res.status(400).json({ error: 'Incorrect email or password credentials' });
  }

  console.log(`[LOGIN] Success: User "${user.name}" (${user.id}) successfully authenticated. Active organization: "${user.lastActiveOrgId}"`);

  res.json({
    token: user.id,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      lastActiveOrgId: user.lastActiveOrgId,
      joinedAt: user.joinedAt
    }
  });
});

// Get profile & context
app.get('/api/auth/me', (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) {
    return res.status(401).json({ error: 'Authorization token invalid or expired' });
  }

  res.json({
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name,
      avatarUrl: auth.user.avatarUrl,
      lastActiveOrgId: auth.user.lastActiveOrgId,
      joinedAt: auth.user.joinedAt
    },
    role: auth.role,
    status: auth.status
  });
});

// Log System/Auth Diagnostics Event
app.post('/api/auth/log-event', async (req, res) => {
  const { userId, action, details } = req.body;
  if (!userId || !action || !details) {
    return res.status(400).json({ error: 'Missing log fields' });
  }
  const db = readDB();
  const user = db.users[userId];
  const userEmail = user ? user.email : 'Unknown User';
  
  // Try to find an organization for this user to satisfy NOT NULL org_id
  let orgId = user?.lastActiveOrgId;
  if (!orgId) {
    const mem = db.members.find(m => m.userId === userId);
    if (mem) {
      orgId = mem.orgId;
    }
  }

  // If we have an organization, log it as an audit log as well
  if (orgId) {
    const auditId = uuid('au');
    db.audits.unshift({
      id: auditId,
      orgId: orgId,
      userId: userId,
      userName: user ? user.name : userEmail,
      action: action,
      details: details,
      timestamp: new Date().toISOString()
    });
    await writeDB(db);
  }

  console.log(`[DIAGNOSTICS] ${action.toUpperCase()}: Email: "${userEmail}" (UID: ${userId}) - Details: "${details}"`);
  res.json({ status: 'ok' });
});

// Switch Active Org
app.post('/api/orgs/switch', async (req, res) => {
  const { orgId } = req.body;
  if (!orgId) {
    console.warn('[ORG SWITCH] Attempted switch with empty orgId.');
    return res.status(400).json({ error: 'orgId required' });
  }

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) {
    console.warn(`[ORG SWITCH] Unauthorized switch attempt to organization: ${orgId}`);
    return res.status(410).json({ error: 'Not authorized' });
  }

  console.log(`[ORG SWITCH] User "${auth.user.name}" (${auth.user.id}) requesting switch to workspace "${orgId}".`);

  // Verify membership
  const member = db.members.find(m => m.orgId === orgId && m.userId === auth.user.id);
  if (!member) {
    console.warn(`[ORG SWITCH] Denied: User "${auth.user.name}" is not a member of Organization "${orgId}".`);
    return res.status(403).json({ error: 'You are not a member of this organization' });
  }

  // Update profile
  db.users[auth.user.id].lastActiveOrgId = orgId;
  await writeDB(db);

  console.log(`[ORG SWITCH] Success: User "${auth.user.name}" has successfully switched to workspace "${orgId}" with role "${member.role}".`);

  res.json({ status: 'ok', lastActiveOrgId: orgId, role: member.role, memberStatus: member.status });
});

// Create Or Join Organization
app.post('/api/orgs', async (req, res) => {
  const { name, logoUrl, currency } = req.body;
  if (!name) return res.status(400).json({ error: 'Organization name required' });

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  const orgId = uuid('org');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  
  const newOrg: Organization = {
    id: orgId,
    name,
    logoUrl: logoUrl || `https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=100&auto=format&fit=crop&q=60`,
    currency: currency || 'INR',
    createdAt: new Date().toISOString(),
    slug: slug + '-' + Math.floor(Math.random() * 1000)
  };

  db.organizations[orgId] = newOrg;

  // creator becomes Admin
  const newMember: OrganizationMember = {
    id: uuid('m'),
    orgId,
    userId: auth.user.id,
    userName: auth.user.name,
    userEmail: auth.user.email,
    userAvatarUrl: auth.user.avatarUrl,
    role: 'Admin',
    status: 'Active',
    joinedAt: new Date().toISOString()
  };
  db.members.push(newMember);

  // Modify last active org
  db.users[auth.user.id].lastActiveOrgId = orgId;

  // Add initial audit logs
  db.audits.unshift({
    id: uuid('au'),
    orgId,
    userId: auth.user.id,
    userName: auth.user.name,
    action: 'organization_created',
    details: `Organization "${name}" successfully registered. Admin assigned.`,
    timestamp: new Date().toISOString()
  });

  await writeDB(db);

  res.json({ org: newOrg, role: 'Admin' });
});

// Join with Invitation Code / Joint Code
app.post('/api/orgs/join', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    console.warn('[INVITE REDEMPTION] Attempted join with empty code.');
    return res.status(400).json({ error: 'Join code or link is required' });
  }

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) {
    console.warn('[INVITE REDEMPTION] Unauthorized attempt to join with code:', code);
    return res.status(401).json({ error: 'Not authorized' });
  }

  const cleanCode = code.trim();
  console.log(`[INVITE LOOKUP] Searching database for invite code "${cleanCode}" by user "${auth.user.name}" (${auth.user.id}).`);
  
  // Find custom generated dynamic invite link first (case-insensitive)
  let invite = db.invites.find(i => i.code.toUpperCase() === cleanCode.toUpperCase() && !i.isRevoked);
  
  // If not found, check if it matches one of the preloaded seed codes on the fly
  if (!invite) {
    const defaultCodes: Record<string, 'Viewer' | 'Auditor' | 'Treasurer' | 'Admin'> = {
      'VIEWER2026': 'Viewer',
      'AUDITOR2026': 'Auditor',
      'TREASURER2026': 'Treasurer',
      'ADMIN2026': 'Admin'
    };
    const uppercaseCode = cleanCode.toUpperCase();
    if (defaultCodes[uppercaseCode]) {
      const targetRole = defaultCodes[uppercaseCode];
      // Find the first organization in the database
      const firstOrgId = Object.keys(db.organizations)[0];
      if (firstOrgId) {
        // Create it dynamically in DB cache
        const dynamicId = `inv-000-preload-${targetRole.toLowerCase()}`;
        const newSeedInvite: InviteLink = {
          id: dynamicId,
          orgId: firstOrgId,
          role: targetRole,
          code: uppercaseCode,
          expiresAt: null,
          usageLimit: null,
          usageCount: 0,
          isRevoked: false,
          createdAt: new Date().toISOString(),
          createdBy: 'b4ac6bce-259d-4cd2-a9d4-a734a4ddd4a8'
        };
        db.invites.push(newSeedInvite);
        await writeDB(db);
        invite = newSeedInvite;
        console.log(`[INVITE LOOKUP] Dynamically self-seeded missing test code "${uppercaseCode}" linked to organization "${firstOrgId}".`);
      }
    }
  }

  if (!invite) {
    console.warn(`[INVITE LOOKUP] Failed: Code "${cleanCode}" not found in database.`);
    return res.status(400).json({ error: 'Invalid join code or expired invite link. Please check spelling.' });
  }

  console.log(`[INVITE LOOKUP] Found custom invite link. Expiration: ${invite.expiresAt}, Threshold Limit: ${invite.usageLimit}, Current usageCount: ${invite.usageCount}, Org ID: ${invite.orgId}, Role: ${invite.role}`);
  // Audit check expiration
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    console.warn(`[INVITE REDEMPTION] Failed: Code "${cleanCode}" has expired.`);
    return res.status(400).json({ error: 'This invitation code has expired.' });
  }
  // Audit check limit
  if (invite.usageLimit !== null && invite.usageCount >= invite.usageLimit) {
    console.warn(`[INVITE REDEMPTION] Failed: Code "${cleanCode}" reached usage limit (${invite.usageLimit}).`);
    return res.status(400).json({ error: 'This invitation link has reached its usage threshold.' });
  }
  const targetOrgId = invite.orgId;
  const targetRole = invite.role;

  // increment usage count
  invite.usageCount += 1;
  console.log(`[INVITE REDEMPTION] Incremented usage count of "${cleanCode}" to ${invite.usageCount}.`);

  // Check if they are already active members in this organization
  const alreadyMember = db.members.find(m => m.orgId === targetOrgId && m.userId === auth.user.id);
  if (alreadyMember) {
    if (alreadyMember.status === 'Suspended') {
      console.warn(`[INVITE REDEMPTION] Failed: User "${auth.user.name}" is Suspended in Org "${targetOrgId}".`);
      return res.status(403).json({ error: 'Your membership in this organization is suspended. Contacter Admin.' });
    }
    // Just switch active context
    db.users[auth.user.id].lastActiveOrgId = targetOrgId;
    await writeDB(db);
    console.log(`[INVITE REDEMPTION] User "${auth.user.name}" already was a member. Switched active workspace to "${targetOrgId}".`);
    return res.json({ status: 'already_member', orgId: targetOrgId, message: 'You are already a member! Swapped your active workspace.' });
  }

  // Create new membership registry
  const newMember: OrganizationMember = {
    id: uuid('m'),
    orgId: targetOrgId,
    userId: auth.user.id,
    userName: auth.user.name,
    userEmail: auth.user.email,
    userAvatarUrl: auth.user.avatarUrl,
    role: targetRole,
    status: 'Active',
    joinedAt: new Date().toISOString()
  };

  db.members.push(newMember);

  // Switch last active org for immediate display
  db.users[auth.user.id].lastActiveOrgId = targetOrgId;

  // Log audit
  const targetOrgName = db.organizations[targetOrgId]?.name || 'Organization';
  db.audits.unshift({
    id: uuid('au'),
    orgId: targetOrgId,
    userId: auth.user.id,
    userName: auth.user.name,
    action: 'member_joined',
    details: `Joined using invite code. Granted role: ${targetRole}.`,
    timestamp: new Date().toISOString()
  });

  // Notify admins
  db.notifications.unshift({
    id: uuid('not'),
    orgId: targetOrgId,
    userId: 'user-admin',
    type: 'MemberJoined',
    title: 'New Workspace Member',
    message: `${auth.user.name} joined as ${targetRole} via code "${cleanCode}".`,
    isRead: false,
    createdAt: new Date().toISOString(),
    targetUserId: null,
    targetRole: 'Admin',
    visibilityScope: 'all_admins',
    relatedEntityType: 'member',
    relatedEntityId: newMember.id
  });

  await writeDB(db);
  console.log(`[INVITE REDEMPTION] Success: User "${auth.user.name}" has successfully joined Org "${targetOrgName}" (${targetOrgId}) as "${targetRole}".`);

  res.json({ status: 'joined', orgId: targetOrgId, role: targetRole, orgName: targetOrgName });
});

// Create dynamic role-based invites
app.post('/api/orgs/invites', async (req, res) => {
  const { role, usageLimit, daysValid } = req.body;
  if (!role) return res.status(400).json({ error: 'Role is required' });

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) {
    console.warn('[INVITE GENERATION] Unauthorized attempt to create invite link.');
    return res.status(401).json({ error: 'Not authorized' });
  }
  if (auth.role !== 'Admin') {
    console.warn(`[INVITE GENERATION] Access denied: User "${auth.user.name}" is not an Admin.`);
    return res.status(403).json({ error: 'Only administrators can create invitation links.' });
  }

  const activeOrgId = auth.user.lastActiveOrgId;
  if (!activeOrgId) {
    console.warn(`[INVITE GENERATION] Failed: No active organization context found for user "${auth.user.name}".`);
    return res.status(400).json({ error: 'Active organization context missing.' });
  }

  console.log(`[INVITE GENERATION] Creating code for role "${role}" (Limit: ${usageLimit || 'infinite'}, Validity: ${daysValid || 'infinite'} days) by User "${auth.user.name}" (${auth.user.id}) inside org "${activeOrgId}".`);

  // Random distinct code
  const code = `${role.toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  const expiresAt = daysValid ? new Date(Date.now() + daysValid * 24 * 3600 * 1000).toISOString() : null;

  const newInvite: InviteLink = {
    id: uuid('inv'),
    orgId: activeOrgId,
    role: role as UserRole,
    code,
    expiresAt,
    usageLimit: usageLimit ? parseInt(usageLimit) : null,
    usageCount: 0,
    isRevoked: false,
    createdAt: new Date().toISOString(),
    createdBy: auth.user.id
  };

  db.invites.push(newInvite);
  await writeDB(db);

  console.log(`[INVITE GENERATION] Successfully generated invite code "${newInvite.code}" (Expires: ${newInvite.expiresAt || 'Never'}, UsageLimit: ${newInvite.usageLimit || 'infinite'}).`);

  res.json({ invite: newInvite });
});

// Revoke/Delete custom invite links
app.post('/api/orgs/invites/revoke', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code to revoke is required' });

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });
  if (auth.role !== 'Admin') return res.status(403).json({ error: 'Only admins can revoke links.' });

  const inviteIdx = db.invites.findIndex(i => i.code === code && i.orgId === auth.user.lastActiveOrgId);
  if (inviteIdx === -1) {
    return res.status(404).json({ error: 'Invite code not found in workspace' });
  }

  db.invites[inviteIdx].isRevoked = true;
  await writeDB(db);

  res.json({ status: 'ok', message: 'Invite successfully revoked.' });
});

// Get workspace invite list
app.get('/api/orgs/invites', (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  const activeOrgId = auth.user.lastActiveOrgId;
  const list = db.invites.filter(i => i.orgId === activeOrgId);

  res.json({ invites: list });
});

// Get user accounts organizations list
app.get('/api/orgs', (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  // Find all organizations where user is registered
  const userMemberships = db.members.filter(m => m.userId === auth.user.id);
  const orgIds = userMemberships.map(m => m.orgId);
  
  const orgList = Object.values(db.organizations)
    .filter(o => orgIds.includes(o.id))
    .map(o => {
      const membership = userMemberships.find(m => m.orgId === o.id)!;
      return {
        ...o,
        userRole: membership.role,
        memberStatus: membership.status
      };
    });

  res.json({ organizations: orgList });
});

// Get active organization members
app.get('/api/members', (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  const activeOrgId = auth.user.lastActiveOrgId;
  const list = db.members.filter(m => m.orgId === activeOrgId);

  res.json({ members: list });
});

// Update Member Role or Status (Suspended/Active)
app.post('/api/members/update', async (req, res) => {
  const { memberId, role, status } = req.body;
  if (!memberId) return res.status(400).json({ error: 'memberId is essential.' });

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });
  if (auth.role !== 'Admin') {
    return res.status(403).json({ error: 'Only organization Admins are permitted to perform administrative updates.' });
  }

  const memberIdx = db.members.findIndex(m => m.id === memberId && m.orgId === auth.user.lastActiveOrgId);
  if (memberIdx === -1) {
    return res.status(404).json({ error: 'Member not found in current organization context.' });
  }

  const targetMember = db.members[memberIdx];

  if (targetMember.userId === auth.user.id) {
    return res.status(400).json({ error: 'You are forbidden from altering your own administrative credentials or suspension status.' });
  }

  const logChanges: string[] = [];

  if (role && targetMember.role !== role) {
    logChanges.push(`changed role from ${targetMember.role} to ${role}`);
    targetMember.role = role as UserRole;
  }

  if (status && targetMember.status !== status) {
    logChanges.push(`assigned status as ${status}`);
    targetMember.status = status as 'Active' | 'Suspended';
  }

  if (logChanges.length > 0) {
    const details = `Updates made to member ${targetMember.userName} (${targetMember.userEmail}): ${logChanges.join(', ')}.`;
    
    // Add auditlog
    db.audits.unshift({
      id: 'au-' + uuid(),
      orgId: auth.user.lastActiveOrgId!,
      userId: auth.user.id,
      userName: auth.user.name,
      action: 'role_changed',
      details,
      timestamp: new Date().toISOString()
    });

    // Notify the target user
    db.notifications.unshift({
      id: 'not-' + uuid(),
      orgId: auth.user.lastActiveOrgId!,
      userId: targetMember.userId,
      type: 'MemberJoined',
      title: 'Workspace Status Update',
      message: `Your membership configuration has been modified: ${logChanges.join(', ')}.`,
      isRead: false,
      createdAt: new Date().toISOString(),
      targetUserId: targetMember.userId,
      targetRole: null,
      visibilityScope: 'user_specific',
      relatedEntityType: 'member',
      relatedEntityId: targetMember.id
    });
  }

  await writeDB(db);
  res.json({ status: 'ok', member: targetMember });
});

// Remove Member entirely from active workspace
app.post('/api/members/remove', async (req, res) => {
  const { memberId } = req.body;
  if (!memberId) return res.status(400).json({ error: 'memberId is essential.' });

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });
  if (auth.role !== 'Admin') {
    return res.status(403).json({ error: 'Only administrative personnel can delete organization members.' });
  }

  const memberIdx = db.members.findIndex(m => m.id === memberId && m.orgId === auth.user.lastActiveOrgId);
  if (memberIdx === -1) {
    return res.status(404).json({ error: 'Member not found.' });
  }

  const targetMember = db.members[memberIdx];
  if (targetMember.userId === auth.user.id) {
    return res.status(400).json({ error: 'You are forbidden from removing yourself from the organization registry.' });
  }

  // Remove membership registry
  db.members.splice(memberIdx, 1);

  // Audits
  db.audits.unshift({
    id: 'au-' + uuid(),
    orgId: auth.user.lastActiveOrgId!,
    userId: auth.user.id,
    userName: auth.user.name,
    action: 'role_changed',
    details: `Expelled member ${targetMember.userName} (${targetMember.userEmail}) from the organization.`,
    timestamp: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ status: 'ok', message: 'Member successfully removed.' });
});

// -----------------------------------------------------
// TRANSACTIONS ROUTING
// -----------------------------------------------------

// Get active workspace transactions
app.get('/api/transactions', (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  const activeOrgId = auth.user.lastActiveOrgId;
  const list = db.transactions.filter(t => t.orgId === activeOrgId);

  res.json({ transactions: list });
});

// Create Income or Expense Transaction
app.post('/api/transactions', async (req, res) => {
  const { type, title, amount, category, description, date, campaignId, receiptName, receiptData } = req.body;
  if (!type || !title || !amount || !category || !date) {
    return res.status(400).json({ error: 'Missing mandatory transaction parameters.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be an explicit positive number.' });
  }

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  if (auth.status === 'Suspended') {
    return res.status(403).json({ error: 'Your account status is currently suspended.' });
  }

  // Viewer cannot create transactions
  if (auth.role === 'Viewer') {
    return res.status(403).json({ error: 'Viewer accounts have read-only permissions and cannot declare transactions.' });
  }

  const activeOrgId = auth.user.lastActiveOrgId;
  if (!activeOrgId) return res.status(400).json({ error: 'No active organization set' });

  // Self-approve only if creator is Admin / Treasurer, otherwise standard default is Pending
  const status = (auth.role === 'Admin' || auth.role === 'Treasurer') ? 'Approved' : 'Pending';
  const finalStatus = req.body.status || status;

  const txId = 'tx-' + uuid();
  const newTx: Transaction = {
    id: txId,
    orgId: activeOrgId,
    type: type as 'Income' | 'Expense',
    title,
    amount: parsedAmount,
    category,
    description: description || '',
    date,
    status: finalStatus,
    campaignId: campaignId ? campaignId : undefined,
    receiptName: receiptName || undefined,
    receiptData: receiptData || undefined, // Base64
    createdAt: new Date().toISOString(),
    createdByUserId: auth.user.id,
    createdByUserName: auth.user.name
  };

  // If approved already, populate approved fields
  if (finalStatus === 'Approved') {
    newTx.approvedByUserId = auth.user.id;
    newTx.approvedByUserName = auth.user.name;
  }

  db.transactions.push(newTx);

  // Log Audits
  db.audits.unshift({
    id: 'au-' + uuid(),
    orgId: activeOrgId,
    userId: auth.user.id,
    userName: auth.user.name,
    action: 'transaction_created',
    details: `Added ${type} transaction "${title}" (${CURRENCY_SYMBOLS[db.organizations[activeOrgId].currency]}${parsedAmount.toLocaleString()}) with status ${finalStatus}.`,
    timestamp: new Date().toISOString()
  });

  // Push notifications to appropriate workers
  const notificationType = type === 'Income' ? 'IncomeAdded' : 'ExpenseAdded';
  const orgName = db.organizations[activeOrgId]?.name;

  db.notifications.unshift({
    id: 'not-' + uuid(),
    orgId: activeOrgId,
    userId: 'user-admin', // Admin
    type: notificationType,
    title: `New Organization ${type}`,
    message: `${auth.user.name} reported a new ${type.toLowerCase()} of ${CURRENCY_SYMBOLS[db.organizations[activeOrgId].currency]}${parsedAmount} - "${title}". Status: ${finalStatus}.`,
    isRead: false,
    createdAt: new Date().toISOString(),
    relatedEntityType: 'transaction',
    relatedEntityId: txId
  });

  // Also check if it's a Donation linked to a Campaign!
  if (type === 'Income' && campaignId) {
    const campaign = db.campaigns.find(c => c.id === campaignId);
    if (campaign) {
      db.notifications.unshift({
        id: 'not-' + uuid(),
        orgId: activeOrgId,
        userId: 'user-treasurer',
        type: 'DonationReceived',
        title: `Donation Received - ${campaign.title}`,
        message: `Contribution of ${CURRENCY_SYMBOLS[db.organizations[activeOrgId].currency]}${parsedAmount} logged from "${title}" towards ${campaign.title}.`,
        isRead: false,
        createdAt: new Date().toISOString(),
        relatedEntityType: 'transaction',
        relatedEntityId: txId
      });
    }
  }

  await writeDB(db);
  res.json({ status: 'ok', transaction: newTx });
});

// Update approved/rejected status inside the pipeline
app.post('/api/transactions/approve', async (req, res) => {
  const { transactionId, status } = req.body; // status is 'Approved' or 'Rejected'
  if (!transactionId || !status) {
    return res.status(400).json({ error: 'Provide transactionId and target approval status.' });
  }

  if (status !== 'Approved' && status !== 'Rejected') {
    return res.status(400).json({ error: 'Invalid operation status code. Must be "Approved" or "Rejected".' });
  }

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized.' });

  // Check roles: Only Admins and Treasurers have transaction modification permissions
  if (auth.role !== 'Admin' && auth.role !== 'Treasurer') {
    return res.status(403).json({ error: 'Only Admins and Treasurers hold active authorization to approve/reject transactions.' });
  }

  const txIdx = db.transactions.findIndex(t => t.id === transactionId && t.orgId === auth.user.lastActiveOrgId);
  if (txIdx === -1) {
    return res.status(404).json({ error: 'Transaction record not found in workspace context.' });
  }

  const targetTx = db.transactions[txIdx];
  if (targetTx.status !== 'Pending') {
    return res.status(400).json({ error: `This transaction has already been processed: ${targetTx.status}.` });
  }

  // Update status
  targetTx.status = status;
  targetTx.approvedByUserId = auth.user.id;
  targetTx.approvedByUserName = auth.user.name;

  const actionName = status === 'Approved' ? 'transaction_approved' : 'transaction_rejected';
  
  // Audits
  db.audits.unshift({
    id: 'au-' + uuid(),
    orgId: auth.user.lastActiveOrgId!,
    userId: auth.user.id,
    userName: auth.user.name,
    action: actionName,
    details: `${status === 'Approved' ? 'Validated' : 'Rejected'} ${targetTx.type.toLowerCase()} trans: "${targetTx.title}" of ${CURRENCY_SYMBOLS[db.organizations[auth.user.lastActiveOrgId!].currency]}${targetTx.amount}.`,
    timestamp: new Date().toISOString()
  });

  // Notify creator
  db.notifications.unshift({
    id: 'not-' + uuid(),
    orgId: auth.user.lastActiveOrgId!,
    userId: targetTx.createdByUserId,
    type: status === 'Approved' ? 'TransactionApproved' : 'TransactionRejected',
    title: `Transaction Request ${status}`,
    message: `Your proposed ${targetTx.type.toLowerCase()} "${targetTx.title}" has been ${status.toLowerCase()} by ${auth.user.name}.`,
    isRead: false,
    createdAt: new Date().toISOString(),
    relatedEntityType: 'transaction',
    relatedEntityId: targetTx.id
  });

  await writeDB(db);
  res.json({ status: 'ok', transaction: targetTx });
});

// Request Transaction Deletion
app.post('/api/transactions/request-delete', async (req, res) => {
  try {
    const { transactionId, reason } = req.body;
    if (!transactionId || !reason) {
      return res.status(400).json({ error: 'Provide transactionId and direct deletion request credentials / reason.' });
    }

    const db = readDB();
    const auth = getAuthUser(req, db);
    if (!auth) return res.status(401).json({ error: 'Not authorized.' });

    if (auth.role !== 'Admin' && auth.role !== 'Treasurer') {
      return res.status(403).json({ error: 'Only Admins and Treasurers hold permission to request transaction deletions.' });
    }

    const txIdx = db.transactions.findIndex(t => t.id === transactionId && t.orgId === auth.user.lastActiveOrgId);
    if (txIdx === -1) {
      return res.status(404).json({ error: 'Transaction record not found.' });
    }

    const targetTx = db.transactions[txIdx];

    targetTx.deletionStatus = 'requested';
    targetTx.deletionReason = reason;
    targetTx.deletionRequestedBy = auth.user.id;
    targetTx.deletionRequestedAt = new Date().toISOString();

    // Audit log (action: transaction.delete_requested)
    db.audits.unshift({
      id: 'au-' + uuid(),
      orgId: auth.user.lastActiveOrgId!,
      userId: auth.user.id,
      userName: auth.user.name,
      action: 'transaction.delete_requested',
      details: `Requested deletion of ${targetTx.type.toLowerCase()} "${targetTx.title}" of India currency ${targetTx.amount}. Reason: ${reason}`,
      timestamp: new Date().toISOString()
    });

    // Notification to Admins
    db.notifications.unshift({
      id: 'not-' + uuid(),
      orgId: auth.user.lastActiveOrgId!,
      userId: 'user-admin',
      type: 'TransactionDeleteRequested',
      title: 'Transaction Deletion Requested',
      message: `${auth.user.name} (Treasurer) requested deletion of "${targetTx.title}" for India currency ${targetTx.amount}. Reason: ${reason}.`,
      isRead: false,
      createdAt: new Date().toISOString(),
      targetUserId: null,
      targetRole: 'Admin',
      visibilityScope: 'all_admins',
      relatedEntityType: 'transaction',
      relatedEntityId: targetTx.id
    });

    await writeDB(db);
    res.json({ status: 'ok', transaction: targetTx });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve Transaction Deletion Request
app.post('/api/transactions/approve-delete', async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ error: 'Provide transactionId.' });
    }

    const db = readDB();
    const auth = getAuthUser(req, db);
    if (!auth) return res.status(401).json({ error: 'Not authorized.' });

    if (auth.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can approve delete requests.' });
    }

    const txIdx = db.transactions.findIndex(t => t.id === transactionId && t.orgId === auth.user.lastActiveOrgId);
    if (txIdx === -1) {
      return res.status(404).json({ error: 'Transaction record not found.' });
    }

    const targetTx = db.transactions[txIdx];

    targetTx.deletedAt = new Date().toISOString();
    targetTx.deletedBy = auth.user.id;
    targetTx.deletionStatus = 'approved';
    targetTx.deletionApprovedBy = auth.user.id;
    targetTx.deletionApprovedAt = new Date().toISOString();

    // Audit log (action: transaction.delete_approved)
    db.audits.unshift({
      id: 'au-' + uuid(),
      orgId: auth.user.lastActiveOrgId!,
      userId: auth.user.id,
      userName: auth.user.name,
      action: 'transaction.delete_approved',
      details: `Approved deletion of ${targetTx.type.toLowerCase()} "${targetTx.title}" of India currency ${targetTx.amount}.`,
      timestamp: new Date().toISOString()
    });

    // Notification to requester (Treasurer)
    const notifyUserId = targetTx.deletionRequestedBy || targetTx.createdByUserId;
    db.notifications.unshift({
      id: 'not-' + uuid(),
      orgId: auth.user.lastActiveOrgId!,
      userId: notifyUserId,
      type: 'TransactionDeleteApproved',
      title: 'Transaction Deletion Approved',
      message: `Your deletion request for "${targetTx.title}" was approved & finalized by Admin ${auth.user.name}.`,
      isRead: false,
      createdAt: new Date().toISOString(),
      targetUserId: notifyUserId,
      targetRole: null,
      visibilityScope: 'user_specific',
      relatedEntityType: 'transaction',
      relatedEntityId: targetTx.id
    });

    await writeDB(db);
    res.json({ status: 'ok', transaction: targetTx });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject Transaction Deletion Request
app.post('/api/transactions/reject-delete', async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ error: 'Provide transactionId.' });
    }

    const db = readDB();
    const auth = getAuthUser(req, db);
    if (!auth) return res.status(401).json({ error: 'Not authorized.' });

    if (auth.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can reject delete requests.' });
    }

    const txIdx = db.transactions.findIndex(t => t.id === transactionId && t.orgId === auth.user.lastActiveOrgId);
    if (txIdx === -1) {
      return res.status(404).json({ error: 'Transaction record not found.' });
    }

    const targetTx = db.transactions[txIdx];

    targetTx.deletionStatus = 'rejected';
    targetTx.deletionRejectedBy = auth.user.id;
    targetTx.deletionRejectedAt = new Date().toISOString();

    // Audit log (action: transaction.delete_rejected)
    db.audits.unshift({
      id: 'au-' + uuid(),
      orgId: auth.user.lastActiveOrgId!,
      userId: auth.user.id,
      userName: auth.user.name,
      action: 'transaction.delete_rejected',
      details: `Rejected deletion request for ${targetTx.type.toLowerCase()} "${targetTx.title}" of India currency ${targetTx.amount}.`,
      timestamp: new Date().toISOString()
    });

    // Notification to requester (Treasurer)
    const notifyUserId = targetTx.deletionRequestedBy || targetTx.createdByUserId;
    db.notifications.unshift({
      id: 'not-' + uuid(),
      orgId: auth.user.lastActiveOrgId!,
      userId: notifyUserId,
      type: 'TransactionDeleteRejected',
      title: 'Transaction Deletion Rejected',
      message: `Your deletion request for "${targetTx.title}" was rejected by Admin ${auth.user.name}.`,
      isRead: false,
      createdAt: new Date().toISOString(),
      targetUserId: notifyUserId,
      targetRole: null,
      visibilityScope: 'user_specific',
      relatedEntityType: 'transaction',
      relatedEntityId: targetTx.id
    });

    await writeDB(db);
    res.json({ status: 'ok', transaction: targetTx });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin Direct soft-delete a transaction
app.post('/api/transactions/direct-delete', async (req, res) => {
  try {
    const { transactionId, reason } = req.body;
    if (!transactionId || !reason) {
      return res.status(400).json({ error: 'Provide transactionId and deletion reason.' });
    }

    const db = readDB();
    const auth = getAuthUser(req, db);
    if (!auth) return res.status(401).json({ error: 'Not authorized.' });

    if (auth.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can directly delete transactions.' });
    }

    const txIdx = db.transactions.findIndex(t => t.id === transactionId && t.orgId === auth.user.lastActiveOrgId);
    if (txIdx === -1) {
      return res.status(404).json({ error: 'Transaction record not found.' });
    }

    const targetTx = db.transactions[txIdx];

    targetTx.deletedAt = new Date().toISOString();
    targetTx.deletedBy = auth.user.id;
    targetTx.deletionReason = reason;
    targetTx.deletionStatus = 'approved';

    // Audit log (action: transaction.deleted_by_admin)
    db.audits.unshift({
      id: 'au-' + uuid(),
      orgId: auth.user.lastActiveOrgId!,
      userId: auth.user.id,
      userName: auth.user.name,
      action: 'transaction.deleted_by_admin',
      details: `Directly soft deleted ${targetTx.type.toLowerCase()} "${targetTx.title}" of India currency ${targetTx.amount}. Reason: ${reason}`,
      timestamp: new Date().toISOString()
    });

    // Notification to creator
    db.notifications.unshift({
      id: 'not-' + uuid(),
      orgId: auth.user.lastActiveOrgId!,
      userId: targetTx.createdByUserId,
      type: 'TransactionDeleted',
      title: 'Transaction Deleted by Admin',
      message: `Your transaction "${targetTx.title}" was soft-deleted directly by Admin ${auth.user.name}. Reason: ${reason}.`,
      isRead: false,
      createdAt: new Date().toISOString(),
      targetUserId: targetTx.createdByUserId,
      targetRole: null,
      visibilityScope: 'user_specific',
      relatedEntityType: 'transaction',
      relatedEntityId: targetTx.id
    });

    await writeDB(db);
    res.json({ status: 'ok', transaction: targetTx });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Edit existing approved/pending transactions
app.post('/api/transactions/edit', async (req, res) => {
  const { id, title, amount, category, description, date, campaignId } = req.body;
  if (!id || !title || !amount || !category || !date) {
    return res.status(400).json({ error: 'Missing mandatory transaction values.' });
  }

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized.' });

  if (auth.role !== 'Admin' && auth.role !== 'Treasurer') {
    return res.status(403).json({ error: 'Only Admin/Treasurer context holds active permissions to edit ledger records.' });
  }

  const txIdx = db.transactions.findIndex(t => t.id === id && t.orgId === auth.user.lastActiveOrgId);
  if (txIdx === -1) {
    return res.status(404).json({ error: 'Transaction records not found.' });
  }

  const targetTx = db.transactions[txIdx];
  const oldAmount = targetTx.amount;
  const oldTitle = targetTx.title;

  targetTx.title = title;
  targetTx.amount = parseFloat(amount);
  targetTx.category = category;
  targetTx.description = description || '';
  targetTx.date = date;
  targetTx.campaignId = campaignId ? campaignId : undefined;

  // Track Audit
  db.audits.unshift({
    id: 'au-' + uuid(),
    orgId: auth.user.lastActiveOrgId!,
    userId: auth.user.id,
    userName: auth.user.name,
    action: 'transaction_edited',
    details: `Updated details for "${oldTitle}" (Amt before: ${CURRENCY_SYMBOLS[db.organizations[auth.user.lastActiveOrgId!].currency]}${oldAmount} -> Now: ${CURRENCY_SYMBOLS[db.organizations[auth.user.lastActiveOrgId!].currency]}${amount}).`,
    timestamp: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ status: 'ok', transaction: targetTx });
});

// -----------------------------------------------------
// CAMPAIGNS ROUTING
// -----------------------------------------------------

// Get active workspace campaigns
app.get('/api/campaigns', (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  const activeOrgId = auth.user.lastActiveOrgId;
  const list = db.campaigns.filter(c => c.orgId === activeOrgId);

  res.json({ campaigns: list });
});

// Create Campaign
app.post('/api/campaigns', async (req, res) => {
  const { title, description, goalAmount, startDate, endDate, status } = req.body;
  if (!title || !goalAmount || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing core campaign parameters.' });
  }

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  if (auth.role !== 'Admin' && auth.role !== 'Treasurer') {
    return res.status(403).json({ error: 'Only Admin and Treasurer accounts are authorized to initiate charity campaigns.' });
  }

  const activeOrgId = auth.user.lastActiveOrgId;
  const campId = 'camp-' + uuid();

  const newCampaign: Campaign = {
    id: campId,
    orgId: activeOrgId!,
    title,
    description: description || '',
    goalAmount: parseFloat(goalAmount),
    startDate,
    endDate,
    status: status || 'Active',
    createdAt: new Date().toISOString()
  };

  db.campaigns.push(newCampaign);

  // Audits
  db.audits.unshift({
    id: 'au-' + uuid(),
    orgId: activeOrgId!,
    userId: auth.user.id,
    userName: auth.user.name,
    action: 'campaign_created',
    details: `Launched active fund-raising campaign "${title}" with targeted goal ${CURRENCY_SYMBOLS[db.organizations[activeOrgId!].currency]}${goalAmount}.`,
    timestamp: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ status: 'ok', campaign: newCampaign });
});

// Edit Campaign
app.post('/api/campaigns/update', async (req, res) => {
  const { id, title, description, goalAmount, startDate, endDate, status } = req.body;
  if (!id) return res.status(400).json({ error: 'Provide campaign id.' });

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  if (auth.role !== 'Admin' && auth.role !== 'Treasurer') {
    return res.status(403).json({ error: 'Only Admin/Treasurer are permitted to modify campaign metrics.' });
  }

  const activeOrgId = auth.user.lastActiveOrgId;
  const campIdx = db.campaigns.findIndex(c => c.id === id && c.orgId === activeOrgId);
  if (campIdx === -1) {
    return res.status(404).json({ error: 'Campaign context missing.' });
  }

  const target = db.campaigns[campIdx];
  target.title = title || target.title;
  target.description = description !== undefined ? description : target.description;
  target.goalAmount = goalAmount !== undefined ? parseFloat(goalAmount) : target.goalAmount;
  target.startDate = startDate || target.startDate;
  target.endDate = endDate || target.endDate;
  target.status = status || target.status;

  await writeDB(db);
  res.json({ status: 'ok', campaign: target });
});

// -----------------------------------------------------
// BORROW & LOAN LEDGER ROUTING
// -----------------------------------------------------

// Get borrow records
app.get('/api/borrows', (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  const activeOrgId = auth.user.lastActiveOrgId;
  if (!activeOrgId) return res.status(400).json({ error: 'No active organization selected' });

  let list = db.borrows.filter(b => b.orgId === activeOrgId);
  let repaymentsList = db.repayments.filter(r => r.orgId === activeOrgId);

  if (auth.role === 'Viewer') {
    list = list.filter(b => b.publicVisible);
    const publicIds = new Set(list.map(b => b.id));
    repaymentsList = repaymentsList.filter(r => publicIds.has(r.borrowRecordId));
  }

  res.json({ borrows: list, repayments: repaymentsList });
});

// Create Borrow record
app.post('/api/borrows', async (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  if (auth.role !== 'Admin' && auth.role !== 'Treasurer') {
    return res.status(403).json({ error: 'Only Admins and Treasurers can create borrow records' });
  }

  const activeOrgId = auth.user.lastActiveOrgId;
  if (!activeOrgId) return res.status(400).json({ error: 'No active organization selected' });

  const { type, borrowerName, lenderName, amount, purpose, dueDate, publicVisible, notes } = req.body;
  if (!type || !borrowerName || !lenderName || amount === undefined) {
    return res.status(400).json({ error: 'Missing mandatory fields: type, borrowerName, lenderName, amount' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount < 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const borrowId = 'br-' + uuid();
  const newRecord: BorrowRecord = {
    id: borrowId,
    orgId: activeOrgId,
    type,
    borrowerName,
    lenderName,
    amount: parsedAmount,
    amountRepaid: 0,
    balanceDue: parsedAmount,
    purpose: purpose || '',
    dueDate: dueDate || '',
    status: 'active',
    createdBy: auth.user.id,
    createdByName: auth.user.name,
    approvedBy: auth.role === 'Admin' ? auth.user.id : null,
    approvedByName: auth.role === 'Admin' ? auth.user.name : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: notes || '',
    publicVisible: publicVisible !== undefined ? publicVisible : true
  };

  db.borrows.unshift(newRecord);

  // Audit log
  db.audits.unshift({
    id: 'au-' + uuid(),
    orgId: activeOrgId,
    userId: auth.user.id,
    userName: auth.user.name,
    action: 'borrow.created',
    details: `Created borrow record: ${type === 'borrowed_from_union' ? borrowerName : lenderName} (${type}) for ${parsedAmount}`,
    timestamp: new Date().toISOString()
  });

  // Notify Admins
  const admins = db.members.filter(m => m.orgId === activeOrgId && m.role === 'Admin');
  const currencySymbol = CURRENCY_SYMBOLS[db.organizations[activeOrgId]?.currency] || '₹';
  admins.forEach(admin => {
    db.notifications.unshift({
      id: 'not-' + uuid(),
      orgId: activeOrgId,
      userId: admin.userId,
      type: 'BorrowCreated',
      title: 'New Borrow Record Created',
      message: `${auth.user.name} created a new borrow record of ${currencySymbol}${parsedAmount} for ${type === 'borrowed_from_union' ? borrowerName : lenderName}.`,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  });

  await writeDB(db);
  res.json({ status: 'ok', borrow: newRecord });
});

// Edit Borrow record
app.post('/api/borrows/edit', async (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  if (auth.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Admins can edit borrow records' });
  }

  const { id, borrowerName, lenderName, amount, purpose, dueDate, status, publicVisible, notes } = req.body;
  const recordIndex = db.borrows.findIndex(b => b.id === id);
  if (recordIndex === -1) {
    return res.status(404).json({ error: 'Borrow record not found' });
  }

  const record = db.borrows[recordIndex];
  if (borrowerName) record.borrowerName = borrowerName;
  if (lenderName) record.lenderName = lenderName;
  if (amount !== undefined) {
    const parsedAmount = parseFloat(amount);
    if (!isNaN(parsedAmount)) {
      record.amount = parsedAmount;
    }
  }
  if (purpose !== undefined) record.purpose = purpose;
  if (dueDate !== undefined) record.dueDate = dueDate;
  if (publicVisible !== undefined) record.publicVisible = publicVisible;
  if (notes !== undefined) record.notes = notes;
  if (status !== undefined) record.status = status;

  // Recalculate balance
  record.balanceDue = Math.max(0, record.amount - record.amountRepaid);
  if (record.status !== 'waived') {
    if (record.balanceDue <= 0) {
      record.status = 'fully_paid';
    } else if (record.amountRepaid > 0) {
      record.status = 'partially_paid';
    } else {
      record.status = 'active';
    }
  } else {
    record.balanceDue = 0;
  }
  record.updatedAt = new Date().toISOString();

  // Audit log
  db.audits.unshift({
    id: 'au-' + uuid(),
    orgId: record.orgId,
    userId: auth.user.id,
    userName: auth.user.name,
    action: 'borrow.updated',
    details: `Updated borrow record ${record.id}`,
    timestamp: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ status: 'ok', borrow: record });
});

// Approve Borrow record
app.post('/api/borrows/approve', async (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  if (auth.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Admins can approve borrow records' });
  }

  const { id } = req.body;
  const record = db.borrows.find(b => b.id === id);
  if (!record) {
    return res.status(404).json({ error: 'Borrow record not found' });
  }

  record.approvedBy = auth.user.id;
  record.approvedByName = auth.user.name;
  record.updatedAt = new Date().toISOString();

  // Audit log
  db.audits.unshift({
    id: 'au-' + uuid(),
    orgId: record.orgId,
    userId: auth.user.id,
    userName: auth.user.name,
    action: 'borrow.approved',
    details: `Approved borrow record ${record.id}`,
    timestamp: new Date().toISOString()
  });

  // Notify Treasurer
  db.notifications.unshift({
    id: 'not-' + uuid(),
    orgId: record.orgId,
    userId: record.createdBy,
    type: 'BorrowApproved',
    title: 'Borrow Record Approved',
    message: `Your borrow record for ${record.borrowerName || record.lenderName} of amount ${record.amount} has been approved by ${auth.user.name}.`,
    isRead: false,
    createdAt: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ status: 'ok', borrow: record });
});

// Record a repayment
app.post('/api/borrows/repay', async (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  if (auth.role !== 'Admin' && auth.role !== 'Treasurer') {
    return res.status(403).json({ error: 'Only Admins and Treasurers can record repayments' });
  }

  const { borrowRecordId, amount, paymentDate, paymentMethod, note } = req.body;
  if (!borrowRecordId || amount === undefined || !paymentDate) {
    return res.status(400).json({ error: 'Missing mandatory fields: borrowRecordId, amount, paymentDate' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid repayment amount' });
  }

  const record = db.borrows.find(b => b.id === borrowRecordId);
  if (!record) {
    return res.status(404).json({ error: 'Borrow record not found' });
  }

  // Create transaction integration
  const txId = 'tx-' + uuid();
  const txType = record.type === 'borrowed_from_union' ? 'Income' : 'Expense';
  const txTitle = `Repayment: ${record.type === 'borrowed_from_union' ? record.borrowerName : record.lenderName} - ${record.purpose || 'Borrow repayment'}`;
  const currencySymbol = CURRENCY_SYMBOLS[db.organizations[record.orgId]?.currency] || '₹';

  const newTx: Transaction = {
    id: txId,
    orgId: record.orgId,
    type: txType,
    title: txTitle,
    amount: parsedAmount,
    category: 'Borrow Repayment',
    description: note || `Repayment recorded for borrow record ID ${record.id}`,
    date: paymentDate,
    status: 'Approved',
    createdAt: new Date().toISOString(),
    createdByUserId: auth.user.id,
    createdByUserName: auth.user.name,
    approvedByUserId: auth.user.id,
    approvedByUserName: auth.user.name,
    approvalDate: new Date().toISOString()
  };

  db.transactions.unshift(newTx);

  const repaymentId = 'brp-' + uuid();
  const repayment: BorrowRepayment = {
    id: repaymentId,
    borrowRecordId,
    orgId: record.orgId,
    amount: parsedAmount,
    paymentDate,
    paymentMethod: paymentMethod || 'Cash',
    note: note || '',
    recordedBy: auth.user.id,
    recordedByName: auth.user.name,
    createdAt: new Date().toISOString(),
    transactionId: txId
  };

  db.repayments.unshift(repayment);

  // Update borrow record balance
  record.amountRepaid += parsedAmount;
  record.balanceDue = Math.max(0, record.amount - record.amountRepaid);
  if (record.status !== 'waived') {
    if (record.balanceDue <= 0) {
      record.status = 'fully_paid';
    } else {
      record.status = 'partially_paid';
    }
  }
  record.updatedAt = new Date().toISOString();

  // Audit log
  db.audits.unshift({
    id: 'au-' + uuid(),
    orgId: record.orgId,
    userId: auth.user.id,
    userName: auth.user.name,
    action: 'borrow.repayment_added',
    details: `Recorded repayment of ${parsedAmount} for borrow record ${record.id}`,
    timestamp: new Date().toISOString()
  });

  // Notify Admins
  const admins = db.members.filter(m => m.orgId === record.orgId && m.role === 'Admin');
  admins.forEach(admin => {
    db.notifications.unshift({
      id: 'not-' + uuid(),
      orgId: record.orgId,
      userId: admin.userId,
      type: 'BorrowRepaymentRecorded',
      title: 'Borrow Repayment Recorded',
      message: `${auth.user.name} recorded a repayment of ${currencySymbol}${parsedAmount} for ${record.type === 'borrowed_from_union' ? record.borrowerName : record.lenderName}.`,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  });

  await writeDB(db);
  res.json({ status: 'ok', repayment, borrow: record });
});

// Close a Borrow record (Mark fully paid)
app.post('/api/borrows/close', async (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  if (auth.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Admins can close borrow records' });
  }

  const { id } = req.body;
  const record = db.borrows.find(b => b.id === id);
  if (!record) {
    return res.status(404).json({ error: 'Borrow record not found' });
  }

  record.status = 'fully_paid';
  record.balanceDue = 0;
  record.updatedAt = new Date().toISOString();

  // Audit log
  db.audits.unshift({
    id: 'au-' + uuid(),
    orgId: record.orgId,
    userId: auth.user.id,
    userName: auth.user.name,
    action: 'borrow.closed',
    details: `Marked borrow record ${record.id} as fully paid (closed)`,
    timestamp: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ status: 'ok', borrow: record });
});

// Waive borrow record / Request Waiver
app.post('/api/borrows/waive', async (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  const { id } = req.body;
  const record = db.borrows.find(b => b.id === id);
  if (!record) {
    return res.status(404).json({ error: 'Borrow record not found' });
  }

  if (auth.role === 'Admin') {
    record.status = 'waived';
    record.balanceDue = 0;
    record.updatedAt = new Date().toISOString();

    // Audit log
    db.audits.unshift({
      id: 'au-' + uuid(),
      orgId: record.orgId,
      userId: auth.user.id,
      userName: auth.user.name,
      action: 'borrow.waived',
      details: `Waived borrow record ${record.id}`,
      timestamp: new Date().toISOString()
    });

    // Notify Treasurer
    db.notifications.unshift({
      id: 'not-' + uuid(),
      orgId: record.orgId,
      userId: record.createdBy,
      type: 'BorrowWaived',
      title: 'Borrow Record Waived',
      message: `The borrow record for ${record.borrowerName || record.lenderName} of amount ${record.amount} has been waived by Admin ${auth.user.name}.`,
      isRead: false,
      createdAt: new Date().toISOString()
    });

    await writeDB(db);
    return res.json({ status: 'ok', borrow: record });
  } else if (auth.role === 'Treasurer') {
    // Notify Admins of Waive Request
    const admins = db.members.filter(m => m.orgId === record.orgId && m.role === 'Admin');
    const currencySymbol = CURRENCY_SYMBOLS[db.organizations[record.orgId]?.currency] || '₹';
    admins.forEach(admin => {
      db.notifications.unshift({
        id: 'not-' + uuid(),
        orgId: record.orgId,
        userId: admin.userId,
        type: 'BorrowWaiveRequest',
        title: 'Waiver Requested',
        message: `${auth.user.name} requested a waiver for borrow record: ${record.type === 'borrowed_from_union' ? record.borrowerName : record.lenderName} of ${currencySymbol}${record.amount}.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    await writeDB(db);
    return res.json({ status: 'ok', message: 'Waiver request sent to Admins' });
  } else {
    return res.status(403).json({ error: 'Only Admins and Treasurers can waive records' });
  }
});

// Delete Borrow record
app.post('/api/borrows/delete', async (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  if (auth.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Admins can delete borrow records' });
  }

  const { id } = req.body;
  const recordIndex = db.borrows.findIndex(b => b.id === id);
  if (recordIndex === -1) {
    return res.status(404).json({ error: 'Borrow record not found' });
  }

  const record = db.borrows[recordIndex];
  db.borrows.splice(recordIndex, 1);

  // Also delete associated repayments
  db.repayments = db.repayments.filter(r => r.borrowRecordId !== id);

  // Audit log
  db.audits.unshift({
    id: 'au-' + uuid(),
    orgId: record.orgId,
    userId: auth.user.id,
    userName: auth.user.name,
    action: 'borrow.deleted',
    details: `Deleted borrow record ${id} of amount ${record.amount}`,
    timestamp: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ status: 'ok' });
});

// -----------------------------------------------------
// AUDITS & NOTIFICATIONS ROUTING
// -----------------------------------------------------

// Get chronology audits
app.get('/api/audits', (req, res) => {
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  const activeOrgId = auth.user.lastActiveOrgId;
  const list = db.audits.filter(a => a.orgId === activeOrgId);

  res.json({ audits: list });
});

// Fetch user notifications list
app.get('/api/notifications', (req, res) => {
  try {
    const db = readDB();
    const auth = getAuthUser(req, db);
    if (!auth) return res.status(401).json({ error: 'Not authorized', notifications: [] });

    const activeOrgId = auth.user.lastActiveOrgId;
    
    // Return notifications belonging to active workspace and matching target criteria
    const list = (db.notifications || []).filter(n => {
      if (!n || n.orgId !== activeOrgId) return false;

      // Admin sees everything
      if (auth.role === 'Admin') return true;

      // Direct targets
      if (n.targetUserId === auth.user.id || n.userId === auth.user.id) return true;

      // Specific target role
      if (n.targetRole && n.targetRole.toLowerCase() === auth.role.toLowerCase()) return true;

      // General public/member scope
      if ((n.visibilityScope as string) === 'public_members') return true;

      // Rule 1: Treasurer relevance
      if (auth.role === 'Treasurer') {
        // - transactions they created
        if (n.relatedEntityType === 'transaction' && n.relatedEntityId) {
          const tx = db.transactions.find(t => t.id === n.relatedEntityId);
          if (tx && tx.createdByUserId === auth.user.id) return true;
        }
        // - transactions requiring their action (e.g., deletion approved/rejected, status changes of their transactions)
        if (n.type === 'TransactionDeleteApproved' || n.type === 'TransactionDeleteRejected' || n.type === 'TransactionApproved' || n.type === 'TransactionRejected') {
          return true;
        }
        // - campaigns they manage (e.g., related to campaigns in organization)
        if (n.relatedEntityType === 'campaign' || n.type === 'DonationReceived') {
          return true;
        }
      }

      // Rule 2: Auditor relevance
      if (auth.role === 'Auditor') {
        // - transactions pending approval
        if (n.relatedEntityType === 'transaction' && n.relatedEntityId) {
          const tx = db.transactions.find(t => t.id === n.relatedEntityId);
          if (tx && tx.status === 'Pending') return true;
        }
        // - transactions flagged for review (e.g., deletion requested or flagged alerts)
        if (n.type === 'TransactionDeleteRequested' || n.type === 'TransactionFlagged' || (n.title && n.title.toLowerCase().includes('delete requested'))) {
          return true;
        }
        // - audit reports generated
        if (n.type === 'AuditReportGenerated' || (n.title && n.title.toLowerCase().includes('audit'))) {
          return true;
        }
      }

      // Rule 3: Viewer relevance
      if (auth.role === 'Viewer') {
        // - general organization updates & public reports published
        if ((n.visibilityScope as string) === 'public_members' || n.type === 'ReportPublished' || n.type === 'OrgUpdate' || (n.title && n.title.toLowerCase().includes('report'))) {
          return true;
        }
      }

      return false;
    });

    res.json({ notifications: list });
  } catch (err: any) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Internal server error', notifications: [] });
  }
});

// Mark notifications read
app.post('/api/notifications/read', async (req, res) => {
  try {
    const { notificationId } = req.body;
    
    const db = readDB();
    const auth = getAuthUser(req, db);
    if (!auth) return res.status(401).json({ error: 'Not authorized' });

    if (!db.notifications) {
      db.notifications = [];
    }

    if (notificationId) {
      const notifyItem = db.notifications.find(n => n && n.id === notificationId);
      if (notifyItem) notifyItem.isRead = true;
    } else {
      // Mark ALL authorized as read
      const activeOrgId = auth.user.lastActiveOrgId;
      db.notifications.forEach(n => {
        if (!n || n.orgId !== activeOrgId) return;

        let satisfies = false;
        if (auth.role === 'Admin') {
          satisfies = true;
        } else if (n.targetUserId === auth.user.id || n.userId === auth.user.id) {
          satisfies = true;
        } else if (n.targetRole && n.targetRole.toLowerCase() === auth.role.toLowerCase()) {
          satisfies = true;
        } else if ((n.visibilityScope as string) === 'public_members') {
          satisfies = true;
        } else if (n.relatedEntityType === 'transaction' && n.relatedEntityId) {
          const tx = db.transactions.find(t => t.id === n.relatedEntityId);
          if (tx && tx.createdByUserId === auth.user.id) satisfies = true;
        }

        if (satisfies) {
          n.isRead = true;
        }
      });
    }

    await writeDB(db);
    res.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Error marking notifications read:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Organization Settings (Currency, Name, Logo)
app.post('/api/orgs/settings', async (req, res) => {
  const { name, logoUrl, currency } = req.body;
  
  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });
  if (auth.role !== 'Admin') {
    return res.status(403).json({ error: 'Only organization administrators are permitted to alter settings.' });
  }

  const activeOrgId = auth.user.lastActiveOrgId;
  if (!activeOrgId || !db.organizations[activeOrgId]) {
    return res.status(404).json({ error: 'Active organization not found' });
  }

  const org = db.organizations[activeOrgId];
  const oldCurrency = org.currency;
  const oldName = org.name;

  if (name) org.name = name;
  if (logoUrl) org.logoUrl = logoUrl;
  if (currency) org.currency = currency as OrganizationCurrency;

  // Log auditing
  db.audits.unshift({
    id: 'au-' + uuid(),
    orgId: activeOrgId,
    userId: auth.user.id,
    userName: auth.user.name,
    action: 'role_changed',
    details: `Modified organization settings. Name: "${oldName}" -> "${org.name}", Currency: "${oldCurrency}" -> "${org.currency}".`,
    timestamp: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ status: 'ok', organization: org });
});

// Update profile photo/name/details
app.post('/api/auth/profile/update', async (req, res) => {
  const { name, avatarUrl, phone, bio, preferredCurrency, notificationPreferences } = req.body;
  if (!name) return res.status(400).json({ error: 'Profile name is mandatory.' });

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  const profile = db.users[auth.user.id];
  const oldName = profile.name;
  const oldAvatar = profile.avatarUrl;

  profile.name = name;
  if (avatarUrl !== undefined) profile.avatarUrl = avatarUrl;
  if (phone !== undefined) profile.phone = phone;
  if (bio !== undefined) profile.bio = bio;
  if (preferredCurrency !== undefined) profile.preferredCurrency = preferredCurrency;
  if (notificationPreferences !== undefined) profile.notificationPreferences = notificationPreferences;

  // Update their name/avatar in public member registries for live audit accuracy
  db.members.forEach(m => {
    if (m.userId === auth.user.id) {
      m.userName = name;
      if (avatarUrl !== undefined) m.userAvatarUrl = avatarUrl;
    }
  });

  // Track user organizations to register audit logs in all of them
  const userOrgs = db.members.filter(m => m.userId === auth.user.id).map(m => m.orgId);
  userOrgs.forEach(orgId => {
    // 6. Audit Logging: Profile Updated
    db.audits.unshift({
      id: 'au-' + uuid(),
      orgId: orgId,
      userId: auth.user.id,
      userName: name,
      action: 'role_changed',
      details: `Profile updated: Edited credentials. Phone: "${phone || 'none'}", Currency: "${preferredCurrency || 'none'}".`,
      timestamp: new Date().toISOString()
    });

    // 6. Audit Logging: Avatar Changed
    if (avatarUrl !== oldAvatar) {
      db.audits.unshift({
        id: 'au-' + uuid(),
        orgId: orgId,
        userId: auth.user.id,
        userName: name,
        action: 'role_changed',
        details: `Profile avatar updated. Path synced.`,
        timestamp: new Date().toISOString()
      });
    }
  });

  await writeDB(db);
  res.json({ status: 'ok', user: profile });
});

// Change Password endpoint
app.post('/api/auth/password/change', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized' });

  const profile = db.users[auth.user.id];
  if (profile.passwordHash !== currentPassword) {
    return res.status(400).json({ error: 'Current password challenge failed.' });
  }

  profile.passwordHash = newPassword;

  // 6. Audit Logging: Password Changed
  const userOrgs = db.members.filter(m => m.userId === auth.user.id).map(m => m.orgId);
  userOrgs.forEach(orgId => {
    db.audits.unshift({
      id: 'au-' + uuid(),
      orgId: orgId,
      userId: auth.user.id,
      userName: profile.name,
      action: 'role_changed',
      details: 'Password changed successfully.',
      timestamp: new Date().toISOString()
    });
  });

  await writeDB(db);
  res.json({ status: 'ok', message: 'Password changed successfully' });
});

// Account Deletion
app.post('/api/auth/delete', async (req, res) => {
  const { password, textConfirmation } = req.body;
  if (!password || !textConfirmation) {
    return res.status(400).json({ error: 'Please submit password and typed confirmation text.' });
  }

  if (textConfirmation !== 'DELETE MY ACCOUNT') {
    return res.status(400).json({ error: 'To confirm system deletion, you must type "DELETE MY ACCOUNT" exactly.' });
  }

  const db = readDB();
  const auth = getAuthUser(req, db);
  if (!auth) return res.status(401).json({ error: 'Not authorized.' });

  // verify password
  const originalUser = db.users[auth.user.id];
  if (originalUser.passwordHash !== password) {
    return res.status(400).json({ error: 'Authentication challenge failed: Password incorrect.' });
  }

  const userId = originalUser.id;
  const userName = originalUser.name;
  const userEmail = originalUser.email;

  // 6. Audit Logging: Account deletion requested
  const userOrgs = db.members.filter(m => m.userId === userId).map(m => m.orgId);
  userOrgs.forEach(orgId => {
    db.audits.unshift({
      id: 'au-' + uuid(),
      orgId: orgId,
      userId: userId,
      userName: userName,
      action: 'role_changed',
      details: 'Account deletion requested with verification challenge.',
      timestamp: new Date().toISOString()
    });
  });

  // 5. Last Admin block check
  const userAdminOrgs = db.members.filter(m => m.userId === userId && m.role === 'Admin');
  const blockedOrgs: string[] = [];

  for (const membership of userAdminOrgs) {
    const otherAdminsInOrg = db.members.filter(m => m.orgId === membership.orgId && m.userId !== userId && m.role === 'Admin');
    if (otherAdminsInOrg.length === 0) {
      const orgName = db.organizations[membership.orgId]?.name || membership.orgId;
      blockedOrgs.push(orgName);

      // 6. Audit Logging: Deletion blocked because user is last admin
      db.audits.unshift({
        id: 'au-' + uuid(),
        orgId: membership.orgId,
        userId: userId,
        userName: userName,
        action: 'role_changed',
        details: `Deletion blocked: last Admin of organization "${orgName}".`,
        timestamp: new Date().toISOString()
      });
    }
  }

  if (blockedOrgs.length > 0) {
    await writeDB(db);
    return res.status(400).json({
      error: `You are the last Admin of one or more organizations (${blockedOrgs.join(', ')}). Transfer admin ownership or delete/archive the organization before deleting your account.`
    });
  }

  // "Do not delete financial history. Replace references with Deleted User"
  // Keep audit logs intact by replacing names
  db.audits.forEach(a => {
    if (a.userId === userId) {
      a.userName = 'Deleted User';
    }
  });

  db.transactions.forEach(t => {
    if (t.createdByUserId === userId) {
      t.createdByUserName = 'Deleted User';
    }
    if (t.approvedByUserId === userId) {
      t.approvedByUserName = 'Deleted User';
    }
  });

  // 6. Audit Logging: Account deleted
  userOrgs.forEach(orgId => {
    db.audits.unshift({
      id: 'au-' + uuid(),
      orgId: orgId,
      userId: 'system',
      userName: 'System Ledger',
      action: 'role_changed',
      details: `User account associated with ${userName} (${userEmail}) was permanently deleted. Workspace records scrubbed.`,
      timestamp: new Date().toISOString()
    });
  });

  // Remove memberships
  db.members = db.members.filter(m => m.userId !== userId);

  // Eliminate primary profile
  delete db.users[userId];

  await writeDB(db);
  res.json({ status: 'ok', message: 'Account was scrubbed and purged successfully.' });
});

// -----------------------------------------------------
// PUBLIC TRANSPARENCY ROUTING (Read-Only)
// -----------------------------------------------------
app.get('/api/transparency/:slug', (req, res) => {
  const { slug } = req.params;
  const db = readDB();

  // Find organization by slug
  const org = Object.values(db.organizations).find(o => o.slug === slug);
  if (!org) {
    return res.status(404).json({ error: 'Transparency portal not found for this organization.' });
  }

  const orgId = org.id;

  // Filter approved transactions (only show approved for public auditing!)
  const rawTx = db.transactions.filter(t => t.orgId === orgId);
  const approvedTx = rawTx.filter(t => t.status === 'Approved' && !t.deletedAt);

  // Calculate stats
  const incomeTot = approvedTx.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
  const expenseTot = approvedTx.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);

  // Fetch and construct public borrows
  const publicBorrows = (db.borrows || [])
    .filter(b => b.orgId === orgId && b.publicVisible);

  const moneyOwedToUnion = publicBorrows
    .filter(b => b.type === 'borrowed_from_union')
    .reduce((sum, b) => sum + b.balanceDue, 0);

  const moneyUnionOwes = publicBorrows
    .filter(b => b.type === 'borrowed_by_union')
    .reduce((sum, b) => sum + b.balanceDue, 0);

  const publicBorrowsMapped = publicBorrows.map(b => ({
    id: b.id,
    type: b.type,
    borrowerName: b.borrowerName,
    lenderName: b.lenderName,
    amount: b.amount,
    amountRepaid: b.amountRepaid,
    balanceDue: b.balanceDue,
    purpose: b.purpose,
    dueDate: b.dueDate,
    status: b.status,
    createdAt: b.createdAt
  }));

  // Campaigns with contributions
  const campaignsList = db.campaigns.filter(c => c.orgId === orgId).map(c => {
    const raised =approvedTx
      .filter(t => t.campaignId === c.id && t.type === 'Income')
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      ...c,
      raised,
      remaining: Math.max(0, c.goalAmount - raised),
      percentage: Math.min(100, Math.round((raised / c.goalAmount) * 100))
    };
  });

  // Public items representation
  res.json({
    organization: {
      id: org.id,
      name: org.name,
      logoUrl: org.logoUrl,
      currency: org.currency,
      createdAt: org.createdAt,
      slug: org.slug
    },
    metrics: {
      totalIncome: incomeTot,
      totalExpense: expenseTot,
      currentBalance: incomeTot - expenseTot,
      activeCampaignsCount: campaignsList.filter(c => c.status === 'Active').length,
      moneyOwedToUnion,
      moneyUnionOwes
    },
    campaigns: campaignsList,
    borrows: publicBorrowsMapped,
    transactions: approvedTx.map(t => ({
      id: t.id,
      type: t.type,
      title: t.title,
      amount: t.amount,
      category: t.category,
      date: t.date,
      description: t.description,
      createdByUserName: t.createdByUserName,
      approvedByUserName: t.approvedByUserName
    }))
  });
});

// Vite Middleware for development
async function bootstrapServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (supabaseService.isSupabaseConfigured()) {
    try {
      await loadDatabaseFromSupabase();
    } catch (e) {
      console.error('Error starting Supabase initialization synchronizer', e);
    }
  }

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Union Ledger Server running on http://0.0.0.0:${PORT}`);
    console.log(`Pre-seeded sandbox roles are active for exploration.`);
  });
}

bootstrapServer().catch((err) => {
  console.error('Error starting server', err);
});
