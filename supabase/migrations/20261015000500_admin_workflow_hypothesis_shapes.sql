-- Public generators persist {text, sourceType, confirmed}; older rows may be strings.
-- Both formats identify the same hypothesis by the exact human-readable text hash.
create function public.admin_hypothesis_text(p_value jsonb) returns text
language sql immutable security invoker set search_path='' as $$
 select case jsonb_typeof(p_value)
  when 'string' then p_value #>> '{}'
  when 'object' then case when jsonb_typeof(p_value->'text')='string' then p_value->>'text' end
 end;
$$;
revoke all on function public.admin_hypothesis_text(jsonb) from public,anon,authenticated;
grant execute on function public.admin_hypothesis_text(jsonb) to service_role;
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.admin_read_workflow(uuid,uuid,jsonb)'::regprocedure);
 definition:=replace(definition,$old$h.value #>> '{}' as text$old$,$new$public.admin_hypothesis_text(h.value) as text$new$);
 definition:=replace(definition,$old$and jsonb_typeof(h.value)='string'$old$,$new$and public.admin_hypothesis_text(h.value) is not null$new$);
 execute definition;
 definition:=pg_get_functiondef('public.admin_apply_diagnostic_command(uuid,jsonb,jsonb)'::regprocedure);
 definition:=replace(definition,$old$b.initial_hypotheses->>((payload->>'hypothesisIndex')::integer)$old$,$new$public.admin_hypothesis_text(b.initial_hypotheses->((payload->>'hypothesisIndex')::integer))$new$);
 execute definition;
end $migration$;
