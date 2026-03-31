-- ============================================================
--  MyAfroDNA Dashboard — Supabase Schema
--  Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";


-- ============================================================
--  TABLES
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
-- One row per authenticated user; id mirrors auth.users.id
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  full_name         text,
  role              text not null default 'coordinator'
                      check (role in ('admin', 'coordinator', 'provider')),
  assigned_studies  text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── studies ──────────────────────────────────────────────────
create table public.studies (
  id                  text primary key,           -- e.g. "CLOP1", "ENTH"
  name                text not null,
  description         text,
  column_definitions  jsonb not null default '[]', -- [{key, label, type, required}]
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── providers ────────────────────────────────────────────────
create table public.providers (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  specialty               text,
  facility                text,
  phone                   text,
  email                   text,
  preferred_contact_method text not null default 'Email'
                             check (preferred_contact_method in ('Email', 'Phone', 'WhatsApp', 'In Person')),
  created_at              timestamptz not null default now()
);

-- ── patients ─────────────────────────────────────────────────
create table public.patients (
  id                    uuid primary key default gen_random_uuid(),
  study_id              text not null references public.studies (id) on delete restrict,
  myafrodna_id          text not null,             -- e.g. "CTR 001"
  -- Common demographic fields
  age                   integer,
  gender                text,
  lga                   text,
  tribe                 text,
  language              text,
  -- Contact
  contact_pathway       text check (contact_pathway in ('direct', 'provider', 'both', 'none')),
  phone                 text,
  email                 text,
  -- Assignment
  assigned_provider_id  uuid references public.providers (id) on delete set null,
  -- Study-specific columns stored as flexible JSON
  study_data            jsonb not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (study_id, myafrodna_id)
);

-- ── recontact_rules ──────────────────────────────────────────
create table public.recontact_rules (
  id               uuid primary key default gen_random_uuid(),
  study_id         text not null references public.studies (id) on delete cascade,
  column_name      text not null,   -- key in study_data (or common field)
  operator         text not null    -- 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'in'
                     check (operator in ('eq', 'neq', 'gt', 'lt', 'contains', 'in')),
  value            text not null,   -- comparison value (cast at eval time)
  priority         text not null default 'Medium'
                     check (priority in ('High', 'Medium')),
  reason_template  text not null,   -- e.g. "Patient has *17/*17 genotype"
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ── recontact_events ─────────────────────────────────────────
create table public.recontact_events (
  id                    uuid primary key default gen_random_uuid(),
  patient_id            uuid not null references public.patients (id) on delete cascade,
  study_id              text not null references public.studies (id) on delete restrict,
  -- Status / classification
  status                text not null default 'flagged'
                          check (status in (
                            'flagged', 'under_review', 'provider_notified',
                            'patient_contacted', 'followup_complete', 'closed'
                          )),
  reason                text,
  priority              text not null default 'Medium'
                          check (priority in ('High', 'Medium')),
  contact_pathway       text check (contact_pathway in ('direct', 'provider', 'both', 'none')),
  assigned_provider_id  uuid references public.providers (id) on delete set null,
  flagged_by            text not null default 'auto'
                          check (flagged_by in ('auto', 'manual')),
  -- Stage entry timestamps (null = stage not yet reached)
  flagged_at            timestamptz,
  under_review_at       timestamptz,
  provider_notified_at  timestamptz,
  patient_contacted_at  timestamptz,
  followup_complete_at  timestamptz,
  closed_at             timestamptz,
  -- Free-form notes
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- One active event per patient at a time
  unique (patient_id)
);

-- ── notes ────────────────────────────────────────────────────
create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  text        text not null,
  note_type   text not null default 'manual'
                check (note_type in ('manual', 'system')),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);


-- ============================================================
--  INDEXES
-- ============================================================

create index on public.patients (study_id);
create index on public.patients (assigned_provider_id);
create index on public.patients using gin (study_data);
create index on public.recontact_events (patient_id);
create index on public.recontact_events (study_id);
create index on public.recontact_events (status);
create index on public.recontact_rules (study_id);
create index on public.notes (patient_id);
create index on public.notes (created_at desc);


-- ============================================================
--  UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_studies_updated_at
  before update on public.studies
  for each row execute function public.set_updated_at();

create trigger trg_patients_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

create trigger trg_recontact_events_updated_at
  before update on public.recontact_events
  for each row execute function public.set_updated_at();


-- ============================================================
--  AUTO-CREATE PROFILE ON SIGN-UP
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'coordinator')
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
--  ROW-LEVEL SECURITY
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.studies            enable row level security;
alter table public.providers          enable row level security;
alter table public.patients           enable row level security;
alter table public.recontact_rules    enable row level security;
alter table public.recontact_events   enable row level security;
alter table public.notes              enable row level security;


-- ── Helper: current user's role ──────────────────────────────
create or replace function public.current_user_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ── Helper: studies the current user can access ──────────────
create or replace function public.user_can_access_study(study text)
returns boolean language sql stable security definer as $$
  select
    role = 'admin'
    or study = any(assigned_studies)
  from public.profiles
  where id = auth.uid();
$$;


-- ── profiles ─────────────────────────────────────────────────
-- Users can read/update their own profile; admins can read all
create policy "profiles: own row"
  on public.profiles for all
  using (id = auth.uid());

create policy "profiles: admin read all"
  on public.profiles for select
  using (public.current_user_role() = 'admin');


-- ── studies ──────────────────────────────────────────────────
-- All authenticated users can read studies they're assigned to
create policy "studies: read assigned"
  on public.studies for select
  using (public.user_can_access_study(id));

-- Only admins can create/update/delete studies
create policy "studies: admin insert"
  on public.studies for insert
  with check (public.current_user_role() = 'admin');

create policy "studies: admin update"
  on public.studies for update
  using (public.current_user_role() = 'admin');

create policy "studies: admin delete"
  on public.studies for delete
  using (public.current_user_role() = 'admin');


-- ── providers ────────────────────────────────────────────────
-- All authenticated users can read providers
create policy "providers: authenticated read"
  on public.providers for select
  using (auth.uid() is not null);

-- Admins and coordinators can write providers
create policy "providers: coord+ write"
  on public.providers for all
  using (public.current_user_role() in ('admin', 'coordinator'));


-- ── patients ─────────────────────────────────────────────────
create policy "patients: read assigned study"
  on public.patients for select
  using (public.user_can_access_study(study_id));

create policy "patients: insert assigned study"
  on public.patients for insert
  with check (public.user_can_access_study(study_id));

create policy "patients: update assigned study"
  on public.patients for update
  using (public.user_can_access_study(study_id));

create policy "patients: delete assigned study"
  on public.patients for delete
  using (public.user_can_access_study(study_id));


-- ── recontact_rules ──────────────────────────────────────────
create policy "rules: read assigned study"
  on public.recontact_rules for select
  using (public.user_can_access_study(study_id));

create policy "rules: admin write"
  on public.recontact_rules for all
  using (public.current_user_role() = 'admin');


-- ── recontact_events ─────────────────────────────────────────
create policy "events: read assigned study"
  on public.recontact_events for select
  using (public.user_can_access_study(study_id));

create policy "events: insert assigned study"
  on public.recontact_events for insert
  with check (public.user_can_access_study(study_id));

create policy "events: update assigned study"
  on public.recontact_events for update
  using (public.user_can_access_study(study_id));

create policy "events: delete assigned study"
  on public.recontact_events for delete
  using (public.user_can_access_study(study_id));


-- ── notes ────────────────────────────────────────────────────
-- Notes are readable if the user can access the patient's study
create policy "notes: read via patient study"
  on public.notes for select
  using (
    exists (
      select 1 from public.patients p
      where p.id = notes.patient_id
        and public.user_can_access_study(p.study_id)
    )
  );

create policy "notes: insert via patient study"
  on public.notes for insert
  with check (
    exists (
      select 1 from public.patients p
      where p.id = notes.patient_id
        and public.user_can_access_study(p.study_id)
    )
  );

create policy "notes: update via patient study"
  on public.notes for update
  using (
    exists (
      select 1 from public.patients p
      where p.id = notes.patient_id
        and public.user_can_access_study(p.study_id)
    )
  );

create policy "notes: delete via patient study"
  on public.notes for delete
  using (
    exists (
      select 1 from public.patients p
      where p.id = notes.patient_id
        and public.user_can_access_study(p.study_id)
    )
  );
