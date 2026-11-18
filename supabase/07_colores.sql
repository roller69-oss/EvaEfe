-- EvaEfe · color elegido para cada contenido (1–8; vacío = automático)
alter table public.contenidos add column if not exists color smallint check (color between 1 and 8);
