-- A confirmed diagnostic can expire while completion artifacts are pending.
-- Cleanup must be able to close that state without reopening abandonment.

create or replace function public.valid_diagnostic_transition(
  old_status public.diagnostic_status,
  new_status public.diagnostic_status
) returns boolean
language sql immutable strict
set search_path = ''
as $$
  select old_status = new_status or (old_status, new_status) in (
    ('INTRODUCTION', 'PRIVACY_CONSENT'),
    ('PRIVACY_CONSENT', 'COMMERCIAL_CONSENT'),
    ('PRIVACY_CONSENT', 'BLOCKED'),
    ('COMMERCIAL_CONSENT', 'IDENTIFICATION'),
    ('IDENTIFICATION', 'CHALLENGE'),
    ('CHALLENGE', 'CURRENT_PROCESS'),
    ('CURRENT_PROCESS', 'IMPACT'),
    ('IMPACT', 'BUYING_CONTEXT'),
    ('BUYING_CONTEXT', 'REVIEW_GENERATING'),
    ('REVIEW_GENERATING', 'REVIEW_PENDING'),
    ('REVIEW_GENERATING', 'BLOCKED'),
    ('REVIEW_PENDING', 'REVIEW_EDITING'),
    ('REVIEW_EDITING', 'REVIEW_GENERATING'),
    ('REVIEW_PENDING', 'COMPLETING'),
    ('COMPLETING', 'COMPLETED'),
    ('COMPLETING', 'COMPLETED_NO_CONTACT'),
    ('INTRODUCTION', 'ABANDONED'),
    ('PRIVACY_CONSENT', 'ABANDONED'),
    ('COMMERCIAL_CONSENT', 'ABANDONED'),
    ('IDENTIFICATION', 'ABANDONED'),
    ('CHALLENGE', 'ABANDONED'),
    ('CURRENT_PROCESS', 'ABANDONED'),
    ('IMPACT', 'ABANDONED'),
    ('BUYING_CONTEXT', 'ABANDONED'),
    ('REVIEW_GENERATING', 'ABANDONED'),
    ('REVIEW_PENDING', 'ABANDONED'),
    ('REVIEW_EDITING', 'ABANDONED'),
    ('INTRODUCTION', 'EXPIRED'),
    ('PRIVACY_CONSENT', 'EXPIRED'),
    ('COMMERCIAL_CONSENT', 'EXPIRED'),
    ('IDENTIFICATION', 'EXPIRED'),
    ('CHALLENGE', 'EXPIRED'),
    ('CURRENT_PROCESS', 'EXPIRED'),
    ('IMPACT', 'EXPIRED'),
    ('BUYING_CONTEXT', 'EXPIRED'),
    ('REVIEW_GENERATING', 'EXPIRED'),
    ('REVIEW_PENDING', 'EXPIRED'),
    ('REVIEW_EDITING', 'EXPIRED'),
    ('COMPLETING', 'EXPIRED'),
    ('IDENTIFICATION', 'BLOCKED'),
    ('CHALLENGE', 'BLOCKED'),
    ('CURRENT_PROCESS', 'BLOCKED'),
    ('IMPACT', 'BLOCKED'),
    ('BUYING_CONTEXT', 'BLOCKED'),
    ('REVIEW_PENDING', 'BLOCKED')
  );
$$;
