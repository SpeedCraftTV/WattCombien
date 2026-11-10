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

-- Primary key and validated check constraints.
select
  conname,
  contype,
  convalidated,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.contact_messages'::regclass
order by conname;

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
  has_table_privilege(role_name, 'public.contact_messages', 'trigger') as can_create_trigger
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
order by role_name;

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
