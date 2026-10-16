-- Domain conflicts are application errors, not PostgreSQL transaction-retry signals.
-- SQLSTATE 40001 can cause the API transaction layer to retry the whole RPC.
-- Keep the stable STATE_CONFLICT / STALE_STATE messages mapped to HTTP 409 by Edge.
do $migration$
declare signature text; definition text;
begin
 foreach signature in array array[
  'public.admin_prepare_workflow_command(uuid,jsonb)',
  'public.admin_apply_diagnostic_command(uuid,jsonb,jsonb)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  definition:=replace(definition,'errcode=''40001''','errcode=''P0001''');
  -- FK checks on idempotency rows hold KEY SHARE on the diagnostic. NO KEY UPDATE
  -- still serializes writers without creating a lock-upgrade cycle between claims.
  definition:=replace(definition,'where id=did and archived_at is null for update','where id=did and archived_at is null for no key update');
  execute definition;
 end loop;
end $migration$;
