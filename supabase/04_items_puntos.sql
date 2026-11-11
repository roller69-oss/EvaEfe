-- =====================================================================
-- EvaEfe · ítems de rúbrica que suman o restan puntos por cada vez
-- Ejecutar UNA vez en Supabase → SQL Editor. Se puede repetir sin problema.
-- =====================================================================
alter table public.items add column if not exists tipo text not null default 'nivel';
alter table public.items drop constraint if exists items_tipo_check;
alter table public.items add constraint items_tipo_check check (tipo in ('nivel','suma','resta'));
alter table public.items add column if not exists puntos numeric not null default 0.5 check (puntos >= 0);
