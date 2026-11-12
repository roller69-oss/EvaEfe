-- =====================================================================
-- EvaEfe · repetir pruebas (varios intentos por alumno)
-- Ejecutar UNA vez en Supabase → SQL Editor. Se puede repetir sin problema.
-- =====================================================================
-- Regla de cada contenido: {"modo": "no|presentados|todos", "intentos": 1, "cuenta": "mejor|ultima|media"}
alter table public.contenidos add column if not exists repeticion jsonb not null default '{"modo":"no","intentos":1,"cuenta":"mejor"}';
-- Intentos extra de cada alumno: [{"valores": {...}, "nota": null, "fecha": "2026-11-20"}]
alter table public.calificaciones add column if not exists intentos jsonb not null default '[]';
