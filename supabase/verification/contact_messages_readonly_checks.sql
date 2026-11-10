-- Run these statements in Supabase SQL Editor to verify the migrated table.
-- Every statement is read-only.

-- Columns, types, nullability, and defaults.
select
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
from information_schema.columns
where table_schema = 'public'
  and table_name = 'contact_messages'
order by ordinal_position;

-- Additional required columns can prevent the Function's INSERT from succeeding.
select
  column_name,
  data_type,
  column_default,
  is_identity,
  is_generated
from information_schema.columns
where table_schema = 'public'
  and table_name = 'contact_messages'
  and column_name not in ('id', 'reason', 'email', 'message', 'status', 'created_at')
  and is_nullable = 'NO'
  and column_default is null
  and is_identity = 'NO'
  and is_generated = 'NEVER'
order by ordinal_position;

-- Aggregate only: this reports compatibility counts without returning message data.
select
  count(*) as total_rows,
  count(*) filter (where status in ('nouveau', 'en_cours', 'traite')) as legacy_status_rows,
  count(*) filter (
    where id is null
       or reason is null
       or message is null
       or status is null
       or created_at is null
       or reason not in ('question', 'calculation_error', 'privacy_request', 'other')
       or (email is not null and char_length(email) > 254)
       or char_length(btrim(message)) not between 10 and 5000
       or status not in ('new', 'in_progress', 'closed', 'nouveau', 'en_cours', 'traite')
  ) as invalid_rows_for_migration
from public.contact_messages;

-- Primary key and validated check constraints.
select
  conname,
  contype,
  convalidated,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.contact_messages'::regclass
order by conname;

-- Enabled user triggers can cause side effects during the intentional status update.
select
  trigger_record.tgname,
  trigger_record.tgenabled,
  trigger_record.tgisinternal,
  procedure.proname as trigger_function
from pg_trigger as trigger_record
join pg_proc as procedure
  on procedure.oid = trigger_record.tgfoid
where trigger_record.tgrelid = 'public.contact_messages'::regclass
order by trigger_record.tgname;

-- RLS, table owner, and table comment.
select
  pg_get_userbyid(relation.relowner) as table_owner,
  relation.relrowsecurity as rls_enabled,
  relation.relforcerowsecurity as force_rls,
  obj_description(relation.oid, 'pg_class') as table_comment
from pg_class as relation
where relation.oid = 'public.contact_messages'::regclass;

-- Explicit policies. No rows are expected for the current design.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'contact_messages'
order by policyname;

-- Effective relation privileges, which can include inherited role privileges.
select
  role_name,
  has_schema_privilege(role_name, 'public', 'usage') as has_public_schema_usage,
  has_table_privilege(role_name, 'public.contact_messages', 'select') as can_select,
  has_table_privilege(role_name, 'public.contact_messages', 'insert') as can_insert,
  has_table_privilege(role_name, 'public.contact_messages', 'update') as can_update,
  has_table_privilege(role_name, 'public.contact_messages', 'delete') as can_delete,
  has_table_privilege(role_name, 'public.contact_messages', 'truncate') as can_truncate,
  has_table_privilege(role_name, 'public.contact_messages', 'references') as can_reference,
  has_table_privilege(role_name, 'public.contact_messages', 'trigger') as can_create_trigger,
  case
    when current_setting('server_version_num')::integer >= 170000
      then has_table_privilege(role_name, 'public.contact_messages', 'MAINTAIN')
    else false
  end as can_maintain
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
order by role_name;

-- Any other non-superuser role with effective relation privileges needs explicit review.
select
  role_record.rolname,
  role_record.rolinherit,
  role_record.rolbypassrls,
  has_table_privilege(role_record.oid, 'public.contact_messages', 'select') as can_select,
  has_table_privilege(role_record.oid, 'public.contact_messages', 'insert') as can_insert,
  has_table_privilege(role_record.oid, 'public.contact_messages', 'update') as can_update,
  has_table_privilege(role_record.oid, 'public.contact_messages', 'delete') as can_delete,
  has_table_privilege(role_record.oid, 'public.contact_messages', 'truncate') as can_truncate,
  has_table_privilege(role_record.oid, 'public.contact_messages', 'references') as can_reference,
  has_table_privilege(role_record.oid, 'public.contact_messages', 'trigger') as can_create_trigger,
  case
    when current_setting('server_version_num')::integer >= 170000
      then has_table_privilege(role_record.oid, 'public.contact_messages', 'MAINTAIN')
    else false
  end as can_maintain
from pg_roles as role_record
where not role_record.rolsuper
  and role_record.rolname not in ('anon', 'authenticated', 'service_role')
  and role_record.oid <> (
    select relation.relowner
    from pg_class as relation
    where relation.oid = 'public.contact_messages'::regclass
  )
  and (
    has_table_privilege(role_record.oid, 'public.contact_messages', 'select')
    or has_table_privilege(role_record.oid, 'public.contact_messages', 'insert')
    or has_table_privilege(role_record.oid, 'public.contact_messages', 'update')
    or has_table_privilege(role_record.oid, 'public.contact_messages', 'delete')
    or has_table_privilege(role_record.oid, 'public.contact_messages', 'truncate')
    or has_table_privilege(role_record.oid, 'public.contact_messages', 'references')
    or has_table_privilege(role_record.oid, 'public.contact_messages', 'trigger')
    or (
      current_setting('server_version_num')::integer >= 170000
      and has_table_privilege(role_record.oid, 'public.contact_messages', 'MAINTAIN')
    )
  )
order by role_record.rolname;

-- Direct table ACL entries, including the owner and PUBLIC.
select
  case
    when acl.grantee = 0 then 'PUBLIC'
    else pg_get_userbyid(acl.grantee)
  end as grantee,
  acl.privilege_type,
  acl.is_grantable
from pg_class as relation
cross join lateral aclexplode(
  coalesce(relation.relacl, acldefault('r', relation.relowner))
) as acl
where relation.oid = 'public.contact_messages'::regclass
order by grantee, acl.privilege_type;

-- Role attributes and roles inherited by service_role.
select
  role_record.rolname,
  role_record.rolsuper,
  role_record.rolbypassrls,
  role_record.rolinherit,
  pg_has_role('service_role', role_record.oid, 'MEMBER') as service_role_is_member
from pg_roles as role_record
where role_record.rolname in ('service_role', 'anon', 'authenticated')
   or pg_has_role('service_role', role_record.oid, 'MEMBER')
order by role_record.rolname;

-- Check whether an API role can assume the table owner's role.
select
  owner_role.rolname as table_owner,
  pg_has_role('anon', owner_role.oid, 'MEMBER') as anon_is_owner_role_member,
  pg_has_role('authenticated', owner_role.oid, 'MEMBER') as authenticated_is_owner_role_member,
  pg_has_role('service_role', owner_role.oid, 'MEMBER') as service_role_is_owner_role_member
from pg_class as relation
join pg_roles as owner_role
  on owner_role.oid = relation.relowner
where relation.oid = 'public.contact_messages'::regclass;
