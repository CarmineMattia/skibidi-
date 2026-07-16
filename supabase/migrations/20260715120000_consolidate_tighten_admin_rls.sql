-- Consolidate and tighten RLS around admin/kitchen access.
--
-- Fixes, in order:
--   1. Harden search_path on existing SECURITY DEFINER / trigger functions
--      (function_search_path_mutable advisory).
--   2. handle_new_user(): stop trusting client-supplied `role` in signup
--      metadata — anyone could sign up with {data:{role:"admin"}} and be
--      granted admin. New signups are always 'customer'; role changes must
--      go through an admin.
--   3. profiles: block self-service privilege escalation. orders_update /
--      profiles_update already scope by row ownership, but RLS can't
--      restrict which *columns* an owner changes — a customer could still
--      update their own profile.role to 'admin', or their own order.status
--      to bypass the kitchen. Triggers enforce the column-level restriction
--      RLS can't express. Server-side/dashboard sessions (auth.role() not
--      'anon'/'authenticated') are exempt so migrations and admin SQL scripts
--      keep working.
--   4. orders_insert / order_items_insert were `WITH CHECK (true)` — fully
--      open. Scope them to the inserting user's own rows (or NULL
--      customer_id for guest/kiosk checkout), and pin new orders to
--      status='pending' / fiscal_status='pending' unless admin.
--   5. companies had no UPDATE policy at all, silently blocking legitimate
--      admin settings writes (AppSettingsContext). Add one, scoped to admin
--      + own company.

-- 1. search_path hardening -----------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable security definer
set search_path = public
as $function$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$function$;

create or replace function public.get_my_company_id()
returns uuid
language sql
stable security definer
set search_path = public
as $function$
  select company_id from public.profiles where id = auth.uid()
$function$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.sync_fiscal_company_id()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  select company_id into new.company_id
  from public.orders where id = new.order_id;
  return new;
end;
$function$;

-- 2. handle_new_user: never trust client-supplied role at signup ---------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (id, email, full_name, role, company_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    'customer'::public.user_role,
    (new.raw_user_meta_data->>'company_id')::uuid
  )
  on conflict (id) do update set
    email      = excluded.email,
    full_name  = excluded.full_name,
    company_id = coalesce(excluded.company_id, profiles.company_id);
  return new;
end;
$function$;

-- 3a. profiles: block self-service role/company_id escalation ------------

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Trusted server-side context (migrations, SQL editor, service_role): skip.
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'customer'::public.user_role then
      raise exception 'Cannot self-assign role %', new.role;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role or new.company_id is distinct from old.company_id then
      raise exception 'Only an admin can change role or company_id';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_prevent_profile_privilege_escalation on public.profiles;
create trigger trg_prevent_profile_privilege_escalation
  before insert or update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

-- 3b. orders: block customer/guest tampering with status & ownership -----

create or replace function public.prevent_customer_order_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.decline_reason_preset is distinct from old.decline_reason_preset
     or new.decline_reason_note is distinct from old.decline_reason_note
     or new.declined_at is distinct from old.declined_at
     or new.company_id is distinct from old.company_id
     or new.customer_id is distinct from old.customer_id
     or new.total_amount is distinct from old.total_amount
  then
    raise exception 'Only an admin can change order status, ownership, or total';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_prevent_customer_order_tampering on public.orders;
create trigger trg_prevent_customer_order_tampering
  before update on public.orders
  for each row execute function public.prevent_customer_order_tampering();

-- 4. tighten orders_insert / order_items_insert ---------------------------

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert
  with check (
    (public.is_admin() and company_id = public.get_my_company_id())
    or (
      (customer_id is null or customer_id = auth.uid())
      and status = 'pending'
      and fiscal_status = 'pending'
    )
  );

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          (public.is_admin() and o.company_id = public.get_my_company_id())
          or o.customer_id = auth.uid()
          or o.customer_id is null
        )
    )
  );

-- 5. companies: add the missing admin-scoped UPDATE policy ---------------

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update
  using (public.is_admin() and id = public.get_my_company_id())
  with check (public.is_admin() and id = public.get_my_company_id());

-- 6. trigger functions are invoked implicitly by Postgres, never directly
--    by clients — revoke the PostgREST-default anon/authenticated EXECUTE
--    grant so they aren't listed as callable RPC endpoints.

revoke execute on function public.prevent_customer_order_tampering() from anon, authenticated, public;
revoke execute on function public.prevent_profile_privilege_escalation() from anon, authenticated, public;
