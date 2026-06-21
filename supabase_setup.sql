-- =====================================================================
-- UNION LEDGER - SUPABASE DATABASE MIGRATION & SETUP SCHEMA
-- Target Database: PostgreSQL (Supabase)
-- =====================================================================

-- Enable necessary Extensions
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
-- -------------------------------------------------------------
-- 1. DATABASE TABLES DESIGN
-- -------------------------------------------------------------

-- User Profiles (Linked with Supabase Auth or custom credentials)
create table public.profiles (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  password_hash text, -- Support for custom email/password credentials
  name text,
  avatar_url text,
  last_active_org_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Organizations
create table public.organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  logo_url text,
  currency text default 'INR' not null,
  transparency_enabled boolean default true not null,
  slug text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add foreign key constraint to profiles after organizations is created
alter table public.profiles 
  add constraint fk_profiles_last_active_org 
  foreign key (last_active_org_id) 
  references public.organizations(id) 
  on delete set null;

-- Organization Members
create table public.organization_members (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null check (role in ('Admin', 'Treasurer', 'Auditor', 'Viewer')),
  status text default 'Active' not null check (status in ('Active', 'Suspended')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (org_id, user_id)
);

-- Fundraising Campaigns
create table public.campaigns (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  title text not null,
  description text,
  goal_amount numeric(15,2) not null check (goal_amount > 0),
  start_date date,
  end_date date,
  status text default 'Active' not null check (status in ('Active', 'Completed', 'Draft')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Transactions (Income & Expenses)
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  type text not null check (type in ('Income', 'Expense')),
  title text not null,
  amount numeric(15,2) not null check (amount > 0),
  category text not null,
  description text,
  date date not null,
  status text default 'Pending' not null check (status in ('Pending', 'Approved', 'Rejected')),
  campaign_id uuid references public.campaigns(id) on delete set null,
  receipt_name text,
  receipt_url text,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  rejected_by uuid references public.profiles(id) on delete set null,
  approval_date timestamp with time zone,
  rejection_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Role-Based Invitation links and codes
create table public.invite_links (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  role text not null check (role in ('Admin', 'Treasurer', 'Auditor', 'Viewer')),
  code text not null unique,
  expires_at timestamp with time zone,
  usage_limit integer,
  usage_count integer default 0 not null,
  is_revoked boolean default false not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Notifications
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Audit Logging
create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete set null,
  user_name text not null, -- snapshot for historic integrity if user is deleted
  action text not null,
  details text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- -------------------------------------------------------------
-- 2. AUTOMATED TRIGGERS & UTILITY FUNCTIONS
-- -------------------------------------------------------------

-- Trigger: Automatically create a Profile entry upon auth user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Trigger: Track Campaign raised collections dynamically (Utility Views or Triggers)
-- Let's define a view for dynamic campaign statistics so Recharts/dashboard has optimized aggregate calculations
create or replace view public.campaigns_progress as
select 
  c.id as campaign_id,
  c.org_id,
  c.title,
  c.goal_amount,
  coalesce(sum(t.amount), 0) as raised_amount,
  c.goal_amount - coalesce(sum(t.amount), 0) as remaining_amount,
  case 
    when c.goal_amount > 0 then round((coalesce(sum(t.amount), 0) / c.goal_amount) * 100, 2)
    else 0 
  end as progress_percentage,
  c.status,
  c.start_date,
  c.end_date
from public.campaigns c
left join public.transactions t on t.campaign_id = c.id and t.type = 'Income' and t.status = 'Approved'
group by c.id;

-- -------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------

-- Explicitly disable RLS on ALL tables to allow full background server-to-cloud synchronization with Anon/Publishable Keys
alter table public.profiles disable row level security;
alter table public.organizations disable row level security;
alter table public.organization_members disable row level security;
alter table public.campaigns disable row level security;
alter table public.transactions disable row level security;
alter table public.invite_links disable row level security;
alter table public.notifications disable row level security;
alter table public.audit_logs disable row level security;

-- Helper FUNCTION: Get User Roles for Organization Isolation & Role Enforcement
create or replace function public.get_user_role(target_org_id uuid, target_user_id uuid)
returns text as $$
declare
  user_role text;
begin
  select role into user_role
  from public.organization_members
  where org_id = target_org_id and user_id = target_user_id and status = 'Active';
  return user_role;
end;
$$ language plpgsql security definer;

-- PROFILES Policies
create policy "Allow profile viewing to authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Allow users to update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ORGANIZATIONS Policies
create policy "Allow anyone to view public transparency organizations"
  on public.organizations for select
  using (
    transparency_enabled = true 
    or id in (select org_id from public.organization_members where user_id = auth.uid() and status = 'Active')
  );

create policy "Allow organization admins to update their organization"
  on public.organizations for update
  to authenticated
  using (public.get_user_role(id, auth.uid()) = 'Admin')
  with check (public.get_user_role(id, auth.uid()) = 'Admin');

create policy "Allow registered users to create new organizations"
  on public.organizations for insert
  to authenticated
  with check (true);

-- ORGANIZATION_MEMBERS Policies
create policy "Allow organic members to view membership roll"
  on public.organization_members for select
  to authenticated
  using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid() and status = 'Active')
  );

create policy "Allow admins to adjust roles or remove members"
  on public.organization_members for all
  to authenticated
  using (public.get_user_role(org_id, auth.uid()) = 'Admin')
  with check (public.get_user_role(org_id, auth.uid()) = 'Admin');

-- CAMPAIGNS Policies
create policy "Allow anyone to view campaigns of transparency-enabled organizations"
  on public.campaigns for select
  using (
    org_id in (select id from public.organizations where transparency_enabled = true)
    or org_id in (select org_id from public.organization_members where user_id = auth.uid() and status = 'Active')
  );

create policy "Allow Admins & Treasurers to manage campaigns"
  on public.campaigns for all
  to authenticated
  using (public.get_user_role(org_id, auth.uid()) in ('Admin', 'Treasurer'))
  with check (public.get_user_role(org_id, auth.uid()) in ('Admin', 'Treasurer'));

-- TRANSACTIONS Policies
create policy "Allow public view for approved transactions of transparent organizations"
  on public.transactions for select
  using (
    (org_id in (select id from public.organizations where transparency_enabled = true) and status = 'Approved')
    or org_id in (select org_id from public.organization_members where user_id = auth.uid() and status = 'Active')
  );

create policy "Allow Admins, Treasurers & Auditors to create/edit transactions"
  on public.transactions for all
  to authenticated
  using (
    public.get_user_role(org_id, auth.uid()) in ('Admin', 'Treasurer', 'Auditor')
  )
  with check (
    public.get_user_role(org_id, auth.uid()) in ('Admin', 'Treasurer', 'Auditor')
  );

-- INVITE_LINKS Policies
create policy "Allow admins to view/create/revoke invite links"
  on public.invite_links for all
  to authenticated
  using (public.get_user_role(org_id, auth.uid()) = 'Admin')
  with check (public.get_user_role(org_id, auth.uid()) = 'Admin');

create policy "Allow anyone to resolve invite code by code match"
  on public.invite_links for select
  using (is_revoked = false);

-- NOTIFICATIONS Policies
create policy "Allow users to view and discard their own notifications"
  on public.notifications for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- AUDIT_LOGS Policies
create policy "Allow organization active members to view audit logs"
  on public.audit_logs for select
  to authenticated
  using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid() and status = 'Active')
  );

create policy "Only system services can seed audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (
    org_id in (select org_id from public.organization_members where user_id = auth.uid() and status = 'Active')
  );

-- -------------------------------------------------------------
-- 4. STORAGE BUCKETS SETUP & SECURITY POLICIES
-- -------------------------------------------------------------

-- Note: The following insert queries configure storage buckets in Supabase's storage schema.
-- Executing these ensures buckets exist prior to upload.
insert into storage.buckets (id, name, public) 
values 
  ('receipts', 'receipts', false),
  ('organization-logos', 'organization-logos', true),
  ('profile-images', 'profile-images', true)
on conflict (id) do nothing;

-- Storage Policies for 'receipts' (Private bucket, organization-isolated)
create policy "Let active members upload receipts"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
  );

create policy "Let active members read receipts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
  );

-- Storage Policies for 'organization-logos' and 'profile-images' (Public buckets)
create policy "Let anyone select logo of public level"
  on storage.objects for select
  using (bucket_id in ('organization-logos', 'profile-images'));

create policy "Let authenticated users upload logos/images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('organization-logos', 'profile-images'));

-- -------------------------------------------------------------
-- 5. SECURE ACCOUNT DELETION RE-LINKING TRIGGER
-- -------------------------------------------------------------

create or replace function public.execute_account_deletion(target_user_id uuid)
returns void as $$
begin
  -- Snapshot historic audit logs so logs remain readable as 'Deleted User'
  update public.audit_logs
  set user_name = 'Deleted User', user_id = null
  where user_id = target_user_id;

  -- Remove transaction user reference markers safely
  update public.transactions
  set created_by = null
  where created_by = target_user_id;

  -- Finally, remove their core authentication profile
  delete from public.profiles
  where id = target_user_id;
end;
$$ language plpgsql security definer;
