do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contact_messages'
      and column_name = 'received_at'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contact_messages'
      and column_name = 'created_at'
  ) then
    alter table public.contact_messages rename column received_at to created_at;
  end if;
end;
$$;

comment on table public.contact_messages is
  'Private contact requests. Public API roles have no table privileges; inserts are performed by the server-side Cloudflare Pages Function.';
