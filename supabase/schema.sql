-- CareLoop database schema. Run in the Supabase SQL editor.
-- Staff accounts are created in Supabase Auth; each needs a row in profiles.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  clinic_id uuid not null,
  full_name text,
  role text not null check (role in ('coordinator', 'clinician', 'admin'))
);

create table if not exists public.clinic_referrals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  patient_code text not null,            -- anonymized code, never a name
  age int not null check (age between 0 and 120),
  result text not null check (result in ('borderline', 'positive')),
  suggested_urgency text not null check (suggested_urgency in ('routine', 'urgent')),
  confirmed_urgency text check (confirmed_urgency in ('routine', 'urgent')),
  screened_on date not null,
  due_by date,
  contact_available boolean not null default true,
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation', 'open', 'attended', 'treated', 'lost')),
  reminders int not null default 0,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper functions read the caller's clinic and role.
create or replace function public.my_clinic_id() returns uuid
language sql stable security definer set search_path = public as $$
  select clinic_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.profiles enable row level security;
alter table public.clinic_referrals enable row level security;

create policy "read own profile" on public.profiles
  for select using (id = auth.uid());

create policy "clinic reads referrals" on public.clinic_referrals
  for select using (clinic_id = public.my_clinic_id());

create policy "clinic creates referrals" on public.clinic_referrals
  for insert with check (clinic_id = public.my_clinic_id() and created_by = auth.uid());

create policy "clinic updates referrals" on public.clinic_referrals
  for update using (clinic_id = public.my_clinic_id())
  with check (clinic_id = public.my_clinic_id());

-- Only clinicians and admins may confirm or change urgency. Enforced in the
-- database, so it cannot be bypassed from the browser.
create or replace function public.guard_referral_update() returns trigger
language plpgsql as $$
begin
  if new.confirmed_urgency is distinct from old.confirmed_urgency
     and public.my_role() not in ('clinician', 'admin') then
    raise exception 'Only a clinician or admin can confirm urgency';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_referral_update on public.clinic_referrals;
create trigger guard_referral_update
  before update on public.clinic_referrals
  for each row execute function public.guard_referral_update();

-- Atomic reminder counter, called by the SMS function with the service role.
create or replace function public.increment_reminders(ref_id uuid) returns int
language sql security definer set search_path = public as $$
  update public.clinic_referrals set reminders = reminders + 1
  where id = ref_id
  returning reminders
$$;
revoke all on function public.increment_reminders(uuid) from public, anon, authenticated;
