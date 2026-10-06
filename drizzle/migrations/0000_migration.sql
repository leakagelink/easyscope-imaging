
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  doctor_name text not null default '',
  qualification text not null default '',
  registration_number text not null default '',
  signature_url text,
  stamp_url text,
  clinic_stamp_url text,
  show_signature boolean not null default true,
  show_stamp boolean not null default false,
  show_clinic_stamp boolean not null default false,
  show_disclaimer boolean not null default true,
  disclaimer_text text not null default 'This report is based on the clinical examination performed and should be interpreted by a qualified medical professional.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  clinic_name text not null default '',
  logo_url text,
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.clinic_locations (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  location_name text not null,
  address text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  patient_id text,
  name text not null,
  age integer not null check (age >= 0 and age <= 150),
  gender text not null,
  phone text,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  clinic_id uuid references public.clinics(id) on delete set null,
  clinic_location_id uuid references public.clinic_locations(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  report_number text not null,
  report_date date not null default current_date,
  examination_date date,
  diagnosis_findings text not null default '',
  additional_notes text not null default '',
  pdf_url text,
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.clinical_media (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  report_id uuid references public.reports(id) on delete set null,
  file_url text not null,
  file_type text not null default 'image/jpeg',
  file_name text not null default '',
  capture_source text not null default 'import',
  captured_at timestamptz not null default now(),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index on public.patients(doctor_id);
create index on public.reports(doctor_id);
create index on public.reports(patient_id);
create index on public.clinical_media(patient_id);
create index on public.clinical_media(report_id);

do $$ declare t text; begin
  foreach t in array array['doctors','clinics','clinic_locations','patients','reports','clinical_media'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
  foreach t in array array['clinics','clinic_locations','patients','reports','clinical_media'] loop
    execute format('create policy "own rows" on public.%I for all to authenticated using (doctor_id = auth.uid()) with check (doctor_id = auth.uid())', t);
  end loop;
  foreach t in array array['doctors','clinics','clinic_locations','patients','reports'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
create policy "own profile" on public.doctors for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "clinical own read" on storage.objects for select to authenticated using (bucket_id = 'clinical' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "clinical own insert" on storage.objects for insert to authenticated with check (bucket_id = 'clinical' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "clinical own update" on storage.objects for update to authenticated using (bucket_id = 'clinical' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "clinical own delete" on storage.objects for delete to authenticated using (bucket_id = 'clinical' and (storage.foldername(name))[1] = auth.uid()::text);
