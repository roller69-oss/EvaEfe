-- EvaEfe · opciones del diario
-- falta_cero: los días sin cara cuentan 0 en la media (si no, no cuentan)
-- usar_minimo: exigir el % mínimo de asistencia (si no llega: 0 y debe trabajo)
alter table public.contenidos add column if not exists falta_cero boolean not null default false;
alter table public.contenidos add column if not exists usar_minimo boolean not null default true;
