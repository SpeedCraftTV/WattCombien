import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath = new URL(
  "../supabase/migrations/20261111001000_reconcile_contact_messages_schema.sql",
  import.meta.url
);
const verificationPath = new URL(
  "../supabase/verification/contact_messages_readonly_checks.sql",
  import.meta.url
);

test("the corrective migration maps legacy statuses and validates the contact schema", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /^begin;/i);
  assert.match(migration, /commit;\s*$/i);
  assert.match(migration, /when 'nouveau' then 'new'/i);
  assert.match(migration, /when 'en_cours' then 'in_progress'/i);
  assert.match(migration, /when 'traite' then 'closed'/i);
  assert.match(migration, /contact_messages_reason_check/i);
  assert.match(migration, /contact_messages_email_check/i);
  assert.match(migration, /contact_messages_message_check/i);
  assert.match(migration, /char_length\(email\) <= 254/i);
  assert.match(migration, /char_length\(btrim\(message\)\) between 10 and 5000/i);
  assert.match(migration, /contact_messages_status_check/i);
  assert.match(migration, /status in \('new', 'in_progress', 'closed'\)/i);
  assert.match(migration, /alter column id set default gen_random_uuid\(\)/i);
  assert.match(migration, /alter column created_at set default now\(\)/i);
  assert.match(migration, /alter column status set default 'new'/i);
  assert.match(migration, /alter column reason set not null/i);
  assert.match(migration, /alter column email drop not null/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /table_owner in \('anon', 'authenticated', 'service_role'\)/i);
  assert.match(migration, /revoke all on table public\.contact_messages from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant insert on table public\.contact_messages to service_role/i);
  assert.doesNotMatch(migration, /drop table|truncate table|delete from/i);
  assert.doesNotMatch(migration, /create policy/i);
});

test("the read-only Supabase verification file checks schema, constraints, policies, and effective privileges", async () => {
  const verification = await readFile(verificationPath, "utf8");

  assert.match(verification, /information_schema\.columns/i);
  assert.match(verification, /pg_constraint/i);
  assert.match(verification, /pg_policies/i);
  assert.match(verification, /has_table_privilege/i);
  assert.match(verification, /aclexplode/i);
  assert.match(verification, /pg_has_role/i);
  assert.doesNotMatch(verification, /^\s*(insert|update|delete|alter|drop|create|grant|revoke|truncate)\b/im);
});
