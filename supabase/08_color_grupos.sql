-- EvaEfe · color elegido para cada grupo (1–8; vacío = automático)
alter table public.grupos add column if not exists color smallint check (color between 1 and 8);
