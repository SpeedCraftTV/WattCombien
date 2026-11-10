begin;

do $$
declare
  table_oid regclass := to_regclass('public.contact_messages');
  column_record record;
  id_attnum smallint;
  status_attnum smallint;
  constraint_name text;
  table_owner text;
begin
  if table_oid is null then
    raise exception 'public.contact_messages does not exist; review the existing table before applying this migration';
  end if;

  for column_record in
    select expected.column_name, expected.data_type
    from (values
      ('id', 'uuid'),
      ('reason', 'text'),
      ('email', 'text'),
      ('message', 'text'),
      ('status', 'text'),
      ('created_at', 'timestamp with time zone')
    ) as expected(column_name, data_type)
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contact_messages'
        and information_schema.columns.column_name = column_record.column_name
        and information_schema.columns.data_type = column_record.data_type
    ) then
      raise exception 'public.contact_messages.% is missing or has an unexpected type; inspect the schema before retrying',
        column_record.column_name;
    end if;
  end loop;

  select attribute.attnum
  into id_attnum
  from pg_attribute as attribute
  where attribute.attrelid = table_oid
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  if not exists (
    select 1
    from pg_constraint as constraint_record
    where constraint_record.conrelid = table_oid
      and constraint_record.contype = 'p'
      and cardinality(constraint_record.conkey) = 1
      and id_attnum = any(constraint_record.conkey)
  ) then
    raise exception 'public.contact_messages must have its primary key on id; inspect existing constraints before retrying';
  end if;

  select attribute.attnum
  into status_attnum
  from pg_attribute as attribute
  where attribute.attrelid = table_oid
    and attribute.attname = 'status'
    and not attribute.attisdropped;

  if exists (
    select 1
    from public.contact_messages
    where id is null
       or reason is null
       or message is null
       or status is null
       or created_at is null
       or reason not in ('question', 'calculation_error', 'privacy_request', 'other')
       or (email is not null and char_length(email) > 254)
       or char_length(btrim(message)) not between 10 and 5000
       or status not in ('new', 'in_progress', 'closed', 'nouveau', 'en_cours', 'traite')
  ) then
    raise exception 'public.contact_messages contains rows outside the expected constraints; inspect and resolve them before retrying';
  end if;

  select pg_get_userbyid(relation.relowner)
  into table_owner
  from pg_class as relation
  where relation.oid = table_oid;

  if table_owner in ('anon', 'authenticated', 'service_role') then
    raise exception 'a public API role or service_role owns public.contact_messages and cannot be restricted by table grants; review table ownership before retrying';
  end if;

  for constraint_name in
    select constraint_record.conname
    from pg_constraint as constraint_record
    where constraint_record.conrelid = table_oid
      and constraint_record.contype = 'c'
      and cardinality(constraint_record.conkey) = 1
      and status_attnum = any(constraint_record.conkey)
  loop
    execute format('alter table public.contact_messages drop constraint %I', constraint_name);
  end loop;
end;
$$;

update public.contact_messages
set status = case status
  when 'nouveau' then 'new'
  when 'en_cours' then 'in_progress'
  when 'traite' then 'closed'
  else status
end
where status in ('nouveau', 'en_cours', 'traite');

alter table public.contact_messages
  alter column id set default gen_random_uuid(),
  alter column id set not null,
  alter column reason set not null,
  alter column email drop not null,
  alter column message set not null,
  alter column status set default 'new',
  alter column status set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.contact_messages
  drop constraint if exists contact_messages_reason_check,
  drop constraint if exists contact_messages_email_check,
  drop constraint if exists contact_messages_message_check,
  drop constraint if exists contact_messages_status_check;

alter table public.contact_messages
  add constraint contact_messages_reason_check
    check (reason in ('question', 'calculation_error', 'privacy_request', 'other')),
  add constraint contact_messages_email_check
    check (email is null or char_length(email) <= 254),
  add constraint contact_messages_message_check
    check (char_length(btrim(message)) between 10 and 5000),
  add constraint contact_messages_status_check
    check (status in ('new', 'in_progress', 'closed'));

alter table public.contact_messages enable row level security;

revoke all on table public.contact_messages from public, anon, authenticated, service_role;
grant usage on schema public to service_role;
grant insert on table public.contact_messages to service_role;

comment on table public.contact_messages is
  'Private contact requests. Public API roles have no table privileges; inserts are performed by the server-side Cloudflare Pages Function.';

commit;
