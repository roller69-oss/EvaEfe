-- =====================================================================
-- EvaEfe · contenidos dados por terminados en cada grupo
-- Ejecutar UNA vez en Supabase → SQL Editor. Se puede repetir sin problema.
-- =====================================================================
-- {"<contenido_id>": "2026-11-12", ...}: en esos contenidos, quien no tenga nota cuenta 0
alter table public.grupos add column if not exists terminados jsonb not null default '{}';
