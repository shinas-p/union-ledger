import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// -------------------------------------------------------------
// TYPE DEFINITIONS matching Supabase schema & App's local models
// -------------------------------------------------------------
export interface SupabaseProfile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  last_active_org_id: string | null;
  created_at: string;
}

export interface SupabaseOrganization {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  currency: string;
  transparency_enabled: boolean;
  slug: string;
  created_at: string;
}

export interface SupabaseMember {
  id: string;
  org_id: string;
  user_id: string;
  role: 'Admin' | 'Treasurer' | 'Auditor' | 'Viewer';
  status: 'Active' | 'Suspended';
  joined_at: string;
  profile?: SupabaseProfile;
}

export interface SupabaseTransaction {
  id: string;
  org_id: string;
  type: 'Income' | 'Expense';
  title: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  campaign_id: string | null;
  receipt_name: string | null;
  receipt_url: string | null;
  created_by: string | null;
  approved_by: string | null;
  rejected_by: string | null;
  approval_date: string | null;
  rejection_date: string | null;
  created_at: string;
}

export interface SupabaseCampaign {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  goal_amount: number;
  start_date: string | null;
  end_date: string | null;
  status: 'Active' | 'Completed' | 'Draft';
  created_at: string;
  raised_amount?: number;
  progress_percentage?: number;
}

// -------------------------------------------------------------
// 1. Hook for User Organizations Switcher Context
// -------------------------------------------------------------
export function useOrganizations() {
  const [organizations, setOrganizations] = useState<SupabaseOrganization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('organizations')
        .select('*');
      
      if (dbErr) throw dbErr;
      setOrganizations(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to sync organizations from Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  const createOrganization = async (name: string, currency: string = 'INR', logoUrl?: string) => {
    setError(null);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.floor(Math.random() * 1000);
      const { data, error: dbErr } = await supabase
        .from('organizations')
        .insert({ name, currency, logo_url: logoUrl, slug })
        .select()
        .single();

      if (dbErr) throw dbErr;

      // Automatically join newly created organization as Admin member
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        const { error: memErr } = await supabase
          .from('organization_members')
          .insert({
            org_id: data.id,
            user_id: user.id,
            role: 'Admin',
            status: 'Active'
          });
        if (memErr) throw memErr;
      }

      await fetchOrganizations();
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to create organization in Supabase.');
      throw err;
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  return { organizations, loading, error, refetch: fetchOrganizations, createOrganization };
}

// -------------------------------------------------------------
// 2. Hook for Transactions Management
// -------------------------------------------------------------
export function useTransactions(orgId: string | null | undefined) {
  const [transactions, setTransactions] = useState<SupabaseTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('transactions')
        .select('*')
        .eq('org_id', orgId);
      
      if (dbErr) throw dbErr;
      setTransactions(data || []);
    } catch (err: any) {
      setError(err.message || 'Error occurred while loading ledger transactions.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const addTransaction = async (tx: Partial<SupabaseTransaction>) => {
    if (!orgId) return;
    setError(null);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const { data, error: dbErr } = await supabase
        .from('transactions')
        .insert({
          ...tx,
          org_id: orgId,
          created_by: user?.id,
          status: tx.status || 'Pending'
        })
        .select()
        .single();
      
      if (dbErr) throw dbErr;
      await fetchTransactions();
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to propose transaction in Supabase.');
      throw err;
    }
  };

  const updateTransactionStatus = async (txId: string, status: 'Approved' | 'Rejected') => {
    setError(null);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const updates: any = { status };
      if (status === 'Approved') {
        updates.approved_by = user?.id;
        updates.approval_date = new Date().toISOString();
      } else {
        updates.rejected_by = user?.id;
        updates.rejection_date = new Date().toISOString();
      }

      const { data, error: dbErr } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', txId)
        .select()
        .single();

      if (dbErr) throw dbErr;
      await fetchTransactions();
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to update transaction state.');
      throw err;
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, loading, error, refetch: fetchTransactions, addTransaction, updateTransactionStatus };
}

// -------------------------------------------------------------
// 3. Hook for Campaigns Tracker
// -------------------------------------------------------------
export function useCampaigns(orgId: string | null | undefined) {
  const [campaigns, setCampaigns] = useState<SupabaseCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      // Query the views to fetch pre-calculated progression aggregates
      const { data, error: dbErr } = await supabase
        .from('campaigns_progress')
        .select('*')
        .eq('org_id', orgId);

      if (dbErr) throw dbErr;
      
      const parsedCampaigns: SupabaseCampaign[] = (data || []).map((c: any) => ({
        id: c.campaign_id,
        org_id: c.org_id,
        title: c.title,
        description: c.description,
        goal_amount: Number(c.goal_amount),
        status: c.status,
        start_date: c.start_date,
        end_date: c.end_date,
        raised_amount: Number(c.raised_amount),
        progress_percentage: Number(c.progress_percentage),
        created_at: new Date().toISOString()
      }));

      setCampaigns(parsedCampaigns);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch campaigns statistics.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const addCampaign = async (campaign: Partial<SupabaseCampaign>) => {
    if (!orgId) return;
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('campaigns')
        .insert({
          ...campaign,
          org_id: orgId,
          status: 'Active'
        })
        .select()
        .single();

      if (dbErr) throw dbErr;
      await fetchCampaigns();
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to launch fundraising campaign.');
      throw err;
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return { campaigns, loading, error, refetch: fetchCampaigns, addCampaign };
}
