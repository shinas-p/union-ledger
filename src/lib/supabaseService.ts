import { createClient } from '@supabase/supabase-js';

let clientInst: any = null;

export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

  if (!clientInst) {
    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }
    clientInst = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false
      }
    });
  }
  return clientInst;
}

export const isSupabaseConfigured = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  return !!(supabaseUrl && supabaseAnonKey);
};

// Map database column names to App's camelCase models
function mapProfile(p: any) {
  if (!p) return null;
  return {
    id: p.id,
    email: p.email,
    name: p.name,
    avatarUrl: p.avatar_url,
    lastActiveOrgId: p.last_active_org_id,
    joinedAt: p.created_at,
    passwordHash: ""
  };
}

function mapOrg(o: any) {
  if (!o) return null;
  return {
    id: o.id,
    name: o.name,
    description: o.description,
    logoUrl: o.logo_url,
    currency: o.currency,
    transparencyEnabled: o.transparency_enabled,
    slug: o.slug,
    createdAt: o.created_at
  };
}

function mapMember(m: any) {
  if (!m) return null;
  return {
    id: m.id,
    orgId: m.org_id,
    userId: m.user_id,
    userName: m.profiles?.name || 'Unknown User',
    userEmail: m.profiles?.email || '',
    userAvatarUrl: m.profiles?.avatar_url || '',
    role: m.role,
    status: m.status,
    joinedAt: m.joined_at
  };
}

function mapCampaign(c: any) {
  if (!c) return null;
  return {
    id: c.id,
    orgId: c.org_id,
    title: c.title,
    description: c.description,
    goalAmount: Number(c.goal_amount),
    startDate: c.start_date,
    endDate: c.end_date,
    status: c.status,
    createdAt: c.created_at
  };
}

function mapTransaction(t: any) {
  if (!t) return null;
  return {
    id: t.id,
    orgId: t.org_id,
    type: t.type,
    title: t.title,
    amount: Number(t.amount),
    category: t.category,
    description: t.description,
    date: t.date,
    status: t.status,
    campaignId: t.campaign_id,
    receiptName: t.receipt_name,
    receiptData: t.receipt_url, // Maps to direct image or storage URL
    createdByUserId: t.created_by,
    createdByUserName: t.creator_profile?.name || 'Deleted User',
    approvedByUserId: t.approved_by,
    approvedByUserName: t.approver_profile?.name || undefined,
    rejectedByUserId: t.rejected_by,
    rejectedByUserName: t.rejector_profile?.name || undefined,
    approvalDate: t.approval_date,
    rejectionDate: t.rejection_date,
    createdAt: t.created_at
  };
}

function mapInvite(i: any) {
  if (!i) return null;
  return {
    id: i.id,
    orgId: i.org_id,
    role: i.role,
    code: i.code,
    expiresAt: i.expires_at,
    usageLimit: i.usage_limit,
    usageCount: i.usage_count,
    isRevoked: i.is_revoked,
    createdAt: i.created_at,
    createdBy: i.created_by
  };
}

function mapNotification(n: any) {
  if (!n) return null;
  return {
    id: n.id,
    orgId: n.org_id,
    userId: n.user_id,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.is_read,
    createdAt: n.created_at
  };
}

function mapAudit(a: any) {
  if (!a) return null;
  return {
    id: a.id,
    orgId: a.org_id,
    userId: a.user_id || 'system',
    userName: a.user_name || 'System Ledger',
    action: a.action,
    details: a.details,
    timestamp: a.timestamp
  };
}

// -------------------------------------------------------------
// ADAPTER INTERFACE METHODS
// -------------------------------------------------------------

export async function getUserByEmail(email: string) {
  const client = getSupabaseClient();
  if (!client) return null;
  
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) console.error('Error fetching profile from Supabase:', error);
  return mapProfile(data);
}

export async function getUserById(id: string) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) console.error('Error in getUserById:', error);
  return mapProfile(data);
}

export async function createUser(user: { name: string; email: string; passwordHash: string; id?: string }) {
  const client = getSupabaseClient();
  if (!client) return null;

  const newUserPayload: any = {
    email: user.email.toLowerCase().trim(),
    name: user.name
  };
  if (user.id) {
    newUserPayload.id = user.id;
  }

  const { data, error } = await client
    .from('profiles')
    .insert(newUserPayload)
    .select()
    .single();

  if (error) {
    console.error('Error in createUser on Supabase:', error);
    throw error;
  }
  return mapProfile(data);
}

export async function getUserOrganizations(userId: string) {
  const client = getSupabaseClient();
  if (!client) return [];

  // Query member table and fetch the linked organization structure
  const { data, error } = await client
    .from('organization_members')
    .select('*, organizations(*)')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user organizations:', error);
    return [];
  }

  return (data || []).map((m: any) => {
    const org = mapOrg(m.organizations);
    return {
      ...org,
      userRole: m.role,
      memberStatus: m.status
    };
  });
}

export async function createOrganization(org: { name: string; currency: string; logoUrl?: string }, creatorId: string) {
  const client = getSupabaseClient();
  if (!client) return null;

  const slug = org.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.floor(Math.random() * 1000);
  
  // Insert Organization
  const { data: newOrg, error: orgErr } = await client
    .from('organizations')
    .insert({
      name: org.name,
      currency: org.currency,
      logo_url: org.logoUrl,
      slug
    })
    .select()
    .single();

  if (orgErr) {
    console.error('Error creating org on Supabase:', orgErr);
    throw orgErr;
  }

  // Insert Membership as Admin
  const { error: memErr } = await client
    .from('organization_members')
    .insert({
      org_id: newOrg.id,
      user_id: creatorId,
      role: 'Admin',
      status: 'Active'
    });

  if (memErr) {
    console.error('Error creating membership on Supabase:', memErr);
    throw memErr;
  }

  // Update last active organization profile reference
  await client
    .from('profiles')
    .update({ last_active_org_id: newOrg.id })
    .eq('id', creatorId);

  return mapOrg(newOrg);
}

export async function switchActiveOrg(userId: string, orgId: string) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { error } = await client
    .from('profiles')
    .update({ last_active_org_id: orgId })
    .eq('id', userId);

  if (error) {
    console.error('Error switching active org on Supabase:', error);
    throw error;
  }
  return true;
}

export async function getOrgMembers(orgId: string) {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('organization_members')
    .select('*, profiles(*)')
    .eq('org_id', orgId);

  if (error) {
    console.error('Error fetching org members from Supabase:', error);
    return [];
  }

  return (data || []).map(mapMember);
}

export async function getOrgMembersCount(orgId: string) {
  const members = await getOrgMembers(orgId);
  return members.length;
}

export async function updateMemberRoleOrStatus(memberId: string, role?: string, status?: string) {
  const client = getSupabaseClient();
  if (!client) return null;

  const updates: any = {};
  if (role) updates.role = role;
  if (status) updates.status = status;

  const { data, error } = await client
    .from('organization_members')
    .update(updates)
    .eq('id', memberId)
    .select('*, profiles(*)')
    .single();

  if (error) {
    console.error('Error updating member in Supabase:', error);
    throw error;
  }
  return mapMember(data);
}

export async function removeMember(memberId: string) {
  const client = getSupabaseClient();
  if (!client) return false;

  const { error } = await client
    .from('organization_members')
    .delete()
    .eq('id', memberId);

  if (error) {
    console.error('Error removing member on Supabase:', error);
    throw error;
  }
  return true;
}

export async function getTransactions(orgId: string) {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('transactions')
    .select(`
      *,
      creator_profile: profiles!transactions_created_by_fkey(name),
      approver_profile: profiles!transactions_approved_by_fkey(name),
      rejector_profile: profiles!transactions_rejected_by_fkey(name)
    `)
    .eq('org_id', orgId);

  if (error) {
    console.error('Error fetching transactions from Supabase:', error);
    return [];
  }

  return (data || []).map(mapTransaction);
}

export async function createTransaction(tx: any) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('transactions')
    .insert({
      org_id: tx.orgId,
      type: tx.type,
      title: tx.title,
      amount: tx.amount,
      category: tx.category,
      description: tx.description,
      date: tx.date,
      status: tx.status,
      campaign_id: tx.campaignId || null,
      receipt_name: tx.receiptName,
      receipt_url: tx.receiptData, // Base64 or standard asset link URL
      created_by: tx.createdByUserId
    })
    .select(`
      *,
      creator_profile: profiles!transactions_created_by_fkey(name)
    `)
    .single();

  if (error) {
    console.error('Error creating transaction on Supabase:', error);
    throw error;
  }
  return mapTransaction(data);
}

export async function approveOrRejectTransaction(txId: string, status: 'Approved' | 'Rejected', userId: string) {
  const client = getSupabaseClient();
  if (!client) return null;

  const updates: any = { status };
  if (status === 'Approved') {
    updates.approved_by = userId;
    updates.approval_date = new Date().toISOString();
  } else {
    updates.rejected_by = userId;
    updates.rejection_date = new Date().toISOString();
  }

  const { data, error } = await client
    .from('transactions')
    .update(updates)
    .eq('id', txId)
    .select(`
      *,
      creator_profile: profiles!transactions_created_by_fkey(name),
      approver_profile: profiles!transactions_approved_by_fkey(name),
      rejector_profile: profiles!transactions_rejected_by_fkey(name)
    `)
    .single();

  if (error) {
    console.error('Error approving transaction on Supabase:', error);
    throw error;
  }
  return mapTransaction(data);
}

export async function editTransaction(tx: any) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('transactions')
    .update({
      title: tx.title,
      amount: tx.amount,
      category: tx.category,
      description: tx.description,
      date: tx.date,
      campaign_id: tx.campaignId || null
    })
    .eq('id', tx.id)
    .select(`
      *,
      creator_profile: profiles!transactions_created_by_fkey(name),
      approver_profile: profiles!transactions_approved_by_fkey(name),
      rejector_profile: profiles!transactions_rejected_by_fkey(name)
    `)
    .single();

  if (error) {
    console.error('Error updating transaction in Supabase:', error);
    throw error;
  }
  return mapTransaction(data);
}

export async function getCampaigns(orgId: string) {
  const client = getSupabaseClient();
  if (!client) return [];

  // Fetch campaigns with raised counts from public views
  const { data, error } = await client
    .from('campaigns_progress')
    .select('*')
    .eq('org_id', orgId);

  if (error) {
    // Fall back to campaigns baseline table if view does not exist yet
    const { data: campData, error: dbErr } = await client
      .from('campaigns')
      .select('*')
      .eq('org_id', orgId);
    
    if (dbErr) {
      console.error('Error fetching campaigns catalog:', dbErr);
      return [];
    }
    return (campData || []).map(mapCampaign);
  }

  return (data || []).map((c: any) => ({
    id: c.campaign_id,
    orgId: c.org_id,
    title: c.title,
    description: c.description,
    goalAmount: Number(c.goal_amount),
    status: c.status,
    startDate: c.start_date,
    endDate: c.end_date,
    raisedAmount: Number(c.raised_amount),
    remainingAmount: Number(c.remaining_amount),
    progressPercentage: Number(c.progress_percentage),
    createdAt: new Date().toISOString()
  }));
}

export async function createCampaign(camp: any) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('campaigns')
    .insert({
      org_id: camp.orgId,
      title: camp.title,
      description: camp.description,
      goal_amount: camp.goalAmount,
      start_date: camp.startDate,
      end_date: camp.endDate,
      status: camp.status || 'Active'
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating campaign in Supabase:', error);
    throw error;
  }
  return mapCampaign(data);
}

export async function updateCampaign(camp: any) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('campaigns')
    .update({
      title: camp.title,
      description: camp.description,
      goal_amount: camp.goalAmount,
      start_date: camp.startDate,
      end_date: camp.endDate,
      status: camp.status
    })
    .eq('id', camp.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating campaign on Supabase:', error);
    throw error;
  }
  return mapCampaign(data);
}

export async function getAuditLogs(orgId: string) {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('audit_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Error querying audit logs on Supabase:', error);
    return [];
  }
  return (data || []).map(mapAudit);
}

export async function createAuditLog(log: any) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('audit_logs')
    .insert({
      org_id: log.orgId,
      user_id: log.userId !== 'system' && log.userId !== 'Deleted User' ? log.userId : null,
      user_name: log.userName,
      action: log.action,
      details: log.details
    })
    .select()
    .single();

  if (error) {
    console.error('Error logging audit activity on Supabase:', error);
  }
  return mapAudit(data);
}

export async function getInvites(orgId: string) {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('invite_links')
    .select('*')
    .eq('org_id', orgId);

  if (error) {
    console.error('Error querying invites catalog from Supabase:', error);
    return [];
  }
  return (data || []).map(mapInvite);
}

export async function createInvite(invite: any) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('invite_links')
    .insert({
      org_id: invite.orgId,
      role: invite.role,
      code: invite.code,
      expires_at: invite.expiresAt,
      usage_limit: invite.usageLimit,
      usage_count: invite.usageCount || 0,
      is_revoked: invite.isRevoked || false,
      created_by: invite.createdBy
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating invite link in Supabase:', error);
    throw error;
  }
  return mapInvite(data);
}

export async function revokeInvite(code: string, orgId: string) {
  const client = getSupabaseClient();
  if (!client) return false;

  const { error } = await client
    .from('invite_links')
    .update({ is_revoked: true })
    .eq('code', code)
    .eq('org_id', orgId);

  if (error) {
    console.error('Error revoking invitation in Supabase:', error);
    throw error;
  }
  return true;
}

export async function findInviteByCode(code: string) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('invite_links')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (error) {
    console.error('Error looking up invite by code matching:', error);
    return null;
  }
  return mapInvite(data);
}

export async function incrementInviteUsage(code: string) {
  const client = getSupabaseClient();
  if (!client) return false;

  const invite = await findInviteByCode(code);
  if (!invite) return false;

  const { error } = await client
    .from('invite_links')
    .update({ usage_count: invite.usageCount + 1 })
    .eq('code', code);

  if (error) {
    console.error('Error incrementing usage in Supabase:', error);
  }
  return true;
}

export async function createMembership(orgId: string, userId: string, role: string, status: string = 'Active') {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('organization_members')
    .insert({
      org_id: orgId,
      user_id: userId,
      role,
      status
    })
    .select(`
      *,
      profiles(*)
    `)
    .single();

  if (error) {
    console.error('Error adding membership on Supabase:', error);
    throw error;
  }
  return mapMember(data);
}

export async function getNotifications(userId: string, orgId: string) {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('org_id', orgId)
    .or(`user_id.eq.${userId},user_id.eq.user-admin`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notifications in Supabase:', error);
    return [];
  }
  return (data || []).map(mapNotification);
}

export async function createNotification(n: any) {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from('notifications')
    .insert({
      org_id: n.orgId,
      user_id: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      is_read: n.isRead || false
    })
    .select()
    .single();

  if (error) {
    console.error('Error outputting notifications in Supabase:', error);
  }
  return mapNotification(data);
}

export async function markNotificationsAsRead(userId: string, orgId: string, notificationId?: string) {
  const client = getSupabaseClient();
  if (!client) return false;

  let query = client
    .from('notifications')
    .update({ is_read: true })
    .eq('org_id', orgId);

  if (notificationId) {
    query = query.eq('id', notificationId);
  } else {
    query = query.or(`user_id.eq.${userId},user_id.eq.user-admin`);
  }

  const { error } = await query;
  if (error) {
    console.error('Error dismissing notifications in Supabase:', error);
    return false;
  }
  return true;
}

export async function updateOrganizationSettings(orgId: string, payload: { name?: string; logoUrl?: string; currency?: string }) {
  const client = getSupabaseClient();
  if (!client) return null;

  const updates: any = {};
  if (payload.name) updates.name = payload.name;
  if (payload.logoUrl) updates.logo_url = payload.logoUrl;
  if (payload.currency) updates.currency = payload.currency;

  const { data, error } = await client
    .from('organizations')
    .update(updates)
    .eq('id', orgId)
    .select()
    .single();

  if (error) {
    console.error('Error modifying settings on Supabase:', error);
    throw error;
  }
  return mapOrg(data);
}

export async function deleteUserAccount(userId: string) {
  const client = getSupabaseClient();
  if (!client) return false;

  // Let public.execute_account_deletion function in Postgres handle clean cascading scrub
  const { error } = await client.rpc('execute_account_deletion', { target_user_id: userId });

  if (error) {
    // Fall back to direct deletion if Postgres function is not uploaded
    console.warn('RPC deletion fallback:', error);
    
    // Manual scrub for historic references
    await client
      .from('audit_logs')
      .update({ user_name: 'Deleted User', user_id: null })
      .eq('user_id', userId);

    await client
      .from('transactions')
      .update({ created_by: null })
      .eq('created_by', userId);

    const { error: delErr } = await client
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (delErr) {
      console.error('Scrub deletion workflow failed:', delErr);
      throw delErr;
    }
  }
  return true;
}
