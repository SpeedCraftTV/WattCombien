begin;

do $$
declare
  table_oid regclass := to_regclass('public.contact_messages');
  column_record record;
  check_record record;
  id_attnum smallint;
  table_owner text;
  service_role_is_superuser boolean;
  normalized_expression text;
begin
  if table_oid is null then
    raise exception 'public.contact_messages does not exist; inspect the schema before applying this migration';
  end if;

  lock table public.contact_messages in access exclusive mode;

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

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contact_messages'
      and column_name in ('reason', 'email', 'message')
      and column_default is not null
  ) then
    raise exception 'reason, email, or message has an unexpected default; inspect it before retrying';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contact_messages'
      and column_name not in ('id', 'reason', 'email', 'message', 'status', 'created_at')
      and is_nullable = 'NO'
      and column_default is null
      and is_identity = 'NO'
      and is_generated = 'NEVER'
  ) then
    raise exception 'public.contact_messages has an additional required column without a default; inspect it before retrying';
  end if;

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

  if exists (
    select 1
    from pg_constraint as constraint_record
    where constraint_record.conrelid = table_oid
      and constraint_record.contype = 'c'
      and not constraint_record.convalidated
  ) then
    raise exception 'public.contact_messages has an unvalidated CHECK constraint; inspect it before retrying';
  end if;

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
    raise exception 'public.contact_messages contains rows outside the expected values; inspect and resolve them before retrying';
  end if;

  if exists (
    select 1
    from pg_trigger
    where tgrelid = table_oid
      and not tgisinternal
      and tgenabled <> 'D'
  ) then
    raise exception 'public.contact_messages has an enabled user trigger; inspect its effects before retrying';
  end if;

  select pg_get_userbyid(relation.relowner)
  into table_owner
  from pg_class as relation
  where relation.oid = table_oid;

  if table_owner in ('anon', 'authenticated', 'service_role') then
    raise exception 'a public API role or service_role owns public.contact_messages; review table ownership before retrying';
  end if;

  if pg_has_role('anon', table_owner, 'MEMBER')
    or pg_has_role('authenticated', table_owner, 'MEMBER')
    or pg_has_role('service_role', table_owner, 'MEMBER') then
    raise exception 'an API role can assume the table owner role; review role memberships before retrying';
  end if;

  select role_record.rolsuper
  into service_role_is_superuser
  from pg_roles as role_record
  where role_record.rolname = 'service_role';

  if service_role_is_superuser is null or service_role_is_superuser then
    raise exception 'service_role is missing or has superuser privileges; review role configuration before retrying';
  end if;

  for check_record in
    select constraint_record.conname, constraint_record.conbin, constraint_record.conrelid
    from pg_constraint as constraint_record
    where constraint_record.conrelid = table_oid
      and constraint_record.contype = 'c'
  loop
    normalized_expression := regexp_replace(
      replace(
        replace(lower(pg_get_expr(check_record.conbin, check_record.conrelid)), '::text[]', ''),
        '::text',
        ''
      ),
      '[[:space:]()]',
      '',
      'g'
    );

    if normalized_expression = any (array[
      'status=anyarray[''nouveau'',''en_cours'',''traite'']',
      'status=anyarray[''nouveau'',''traite'',''en_cours'']',
      'status=anyarray[''en_cours'',''nouveau'',''traite'']',
      'status=anyarray[''en_cours'',''traite'',''nouveau'']',
      'status=anyarray[''traite'',''nouveau'',''en_cours'']',
      'status=anyarray[''traite'',''en_cours'',''nouveau'']'
    ]) then
      execute format(
        'alter table public.contact_messages drop constraint %I',
        check_record.conname
      );
    end if;
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

do $$
declare
  table_oid regclass := 'public.contact_messages'::regclass;
  check_record record;
  existing_expression text;
  normalized_expression text;
  expected_normalized text;
begin
  for check_record in
    select *
    from (values
      (
        'wc_contact_messages_reason_v1_check',
        'check (reason in (''question'', ''calculation_error'', ''privacy_request'', ''other''))',
        'reason=anyarray[''question'',''calculation_error'',''privacy_request'',''other'']'
      ),
      (
        'wc_contact_messages_email_v1_check',
        'check (email is null or char_length(email) <= 254)',
        'emailisnullorchar_length(email)<=254'
      ),
      (
        'wc_contact_messages_message_v1_check',
        'check (char_length(btrim(message)) between 10 and 5000)',
        'char_length(btrim(message))>=10andchar_length(btrim(message))<=5000'
      ),
      (
        'wc_contact_messages_status_v1_check',
        'check (status in (''new'', ''in_progress'', ''closed''))',
        'status=anyarray[''new'',''in_progress'',''closed'']'
      )
    ) as expected(constraint_name, definition, normalized_definition)
  loop
    select pg_get_expr(constraint_record.conbin, constraint_record.conrelid)
    into existing_expression
    from pg_constraint as constraint_record
    where constraint_record.conrelid = table_oid
      and constraint_record.conname = check_record.constraint_name
      and constraint_record.contype = 'c';

    if found then
      normalized_expression := regexp_replace(
        replace(
          replace(lower(existing_expression), '::text[]', ''),
          '::text',
          ''
        ),
        '[[:space:]()]',
        '',
        'g'
      );
      expected_normalized := regexp_replace(
        replace(
          replace(lower(check_record.normalized_definition), '::text[]', ''),
          '::text',
          ''
        ),
        '[[:space:]()]',
        '',
        'g'
      );
      if normalized_expression <> expected_normalized then
        raise exception 'constraint % exists with an unexpected definition; inspect it before retrying',
          check_record.constraint_name;
      end if;
    elsif exists (
      select 1
      from pg_constraint as constraint_record
      where constraint_record.conrelid = table_oid
        and constraint_record.conname = check_record.constraint_name
    ) then
      raise exception 'constraint name % is already used by a non-CHECK constraint',
        check_record.constraint_name;
    else
      execute format(
        'alter table public.contact_messages add constraint %I %s',
        check_record.constraint_name,
        check_record.definition
      );
    end if;
  end loop;
end;
$$;

alter table public.contact_messages enable row level security;

revoke all on table public.contact_messages from public, anon, authenticated, service_role;
grant usage on schema public to service_role;
grant insert on table public.contact_messages to service_role;

do $$
declare
  table_oid regclass := 'public.contact_messages'::regclass;
begin
  if has_table_privilege('anon', table_oid, 'select')
    or has_table_privilege('anon', table_oid, 'insert')
    or has_table_privilege('anon', table_oid, 'update')
    or has_table_privilege('anon', table_oid, 'delete')
    or has_table_privilege('anon', table_oid, 'truncate')
    or has_table_privilege('anon', table_oid, 'references')
    or has_table_privilege('anon', table_oid, 'trigger')
    or has_table_privilege('authenticated', table_oid, 'select')
    or has_table_privilege('authenticated', table_oid, 'insert')
    or has_table_privilege('authenticated', table_oid, 'update')
    or has_table_privilege('authenticated', table_oid, 'delete')
    or has_table_privilege('authenticated', table_oid, 'truncate')
    or has_table_privilege('authenticated', table_oid, 'references')
    or has_table_privilege('authenticated', table_oid, 'trigger') then
    raise exception 'anon or authenticated retains effective privileges on contact_messages; review inherited grants before retrying';
  end if;

  if not has_table_privilege('service_role', table_oid, 'insert')
    or has_table_privilege('service_role', table_oid, 'select')
    or has_table_privilege('service_role', table_oid, 'update')
    or has_table_privilege('service_role', table_oid, 'delete')
    or has_table_privilege('service_role', table_oid, 'truncate')
    or has_table_privilege('service_role', table_oid, 'references')
    or has_table_privilege('service_role', table_oid, 'trigger')
    or not has_schema_privilege('service_role', 'public', 'usage') then
    raise exception 'service_role effective privileges are not limited to INSERT; review ownership and inherited grants before retrying';
  end if;
end;
$$;

commit;
