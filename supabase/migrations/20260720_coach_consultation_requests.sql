-- Public coach consultation leads.
-- Visitors may submit a request only for a published coach profile.
-- Only the coach who owns that profile and Tyfit admins may read requests.

create table if not exists public.coach_consultation_requests (
    id uuid primary key default gen_random_uuid(),
    coach_profile_id uuid not null references public.coach_marketing_profiles(id) on delete cascade,
    full_name text not null check (char_length(trim(full_name)) between 2 and 120),
    email text not null check (char_length(trim(email)) between 3 and 320),
    contact_method text not null check (contact_method in ('whatsapp', 'email', 'either')),
    phone_country_code text,
    whatsapp_number text,
    help_topic text not null check (char_length(trim(help_topic)) between 2 and 100),
    notes text check (notes is null or char_length(notes) <= 1000),
    status text not null default 'new' check (status in ('new', 'contacted', 'closed', 'spam')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint coach_consultation_whatsapp_required check (
        contact_method = 'email'
        or (phone_country_code is not null and char_length(trim(phone_country_code)) > 0
            and whatsapp_number is not null and char_length(trim(whatsapp_number)) > 0)
    )
);

create index if not exists coach_consultation_requests_coach_created_idx
    on public.coach_consultation_requests (coach_profile_id, created_at desc);

create index if not exists coach_consultation_requests_status_idx
    on public.coach_consultation_requests (status, created_at desc);

create or replace function public.set_coach_consultation_request_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_coach_consultation_request_updated_at on public.coach_consultation_requests;
create trigger set_coach_consultation_request_updated_at
before update on public.coach_consultation_requests
for each row execute function public.set_coach_consultation_request_updated_at();

alter table public.coach_consultation_requests enable row level security;

drop policy if exists "public can request published coach consultation" on public.coach_consultation_requests;
create policy "public can request published coach consultation"
on public.coach_consultation_requests
for insert
to anon, authenticated
with check (
    status = 'new'
    and exists (
        select 1
        from public.coach_marketing_profiles coach
        where coach.id = coach_profile_id
          and coach.is_published = true
    )
);

drop policy if exists "coach can view own consultation requests" on public.coach_consultation_requests;
create policy "coach can view own consultation requests"
on public.coach_consultation_requests
for select
to authenticated
using (
    exists (
        select 1
        from public.coach_marketing_profiles coach
        where coach.id = coach_profile_id
          and coach.coach_user_id = auth.uid()
    )
);

drop policy if exists "admin can view all consultation requests" on public.coach_consultation_requests;
create policy "admin can view all consultation requests"
on public.coach_consultation_requests
for select
to authenticated
using (
    exists (
        select 1
        from public.profiles profile
        where profile.id = auth.uid()
          and lower(coalesce(profile.role, '')) = 'admin'
    )
);

-- Status changes are intentionally restricted to the owning coach and admins.
drop policy if exists "coach can update own consultation requests" on public.coach_consultation_requests;
create policy "coach can update own consultation requests"
on public.coach_consultation_requests
for update
to authenticated
using (
    exists (
        select 1 from public.coach_marketing_profiles coach
        where coach.id = coach_profile_id and coach.coach_user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.coach_marketing_profiles coach
        where coach.id = coach_profile_id and coach.coach_user_id = auth.uid()
    )
);

drop policy if exists "admin can update consultation requests" on public.coach_consultation_requests;
create policy "admin can update consultation requests"
on public.coach_consultation_requests
for update
to authenticated
using (
    exists (
        select 1 from public.profiles profile
        where profile.id = auth.uid()
          and lower(coalesce(profile.role, '')) = 'admin'
    )
)
with check (
    exists (
        select 1 from public.profiles profile
        where profile.id = auth.uid()
          and lower(coalesce(profile.role, '')) = 'admin'
    )
);
