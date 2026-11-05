-- =====================================================================
-- EvaEfe · contenido tipo "Diario" (valoración diaria con caras 1–5)
-- Ejecutar UNA vez en Supabase → SQL Editor. Se puede repetir sin problema.
-- =====================================================================

-- Nuevo tipo de contenido
alter table public.contenidos drop constraint if exists contenidos_tipo_check;
alter table public.contenidos add constraint contenidos_tipo_check check (tipo in ('nota','rubrica','diario'));

-- % mínimo de asistencia para que el diario cuente (si no, trabajo)
alter table public.contenidos add column if not exists min_asistencia numeric not null default 80
  check (min_asistencia between 0 and 100);

-- Datos extra de una calificación: {"notas_dia": {"<sesion_id>": "texto"}, "excepcion": "Lesión"}
alter table public.calificaciones add column if not exists extra jsonb not null default '{}';

-- Días valorados: cada grupo tiene los suyos
create table if not exists public.sesiones_diario (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contenido_id  uuid not null references public.contenidos(id) on delete cascade,
  grupo_id      uuid not null references public.grupos(id) on delete cascade,
  fecha         date not null,
  created_at    timestamptz not null default now(),
  unique (contenido_id, grupo_id, fecha)
);
create index if not exists sesiones_grupo_idx on public.sesiones_diario(grupo_id);

alter table public.sesiones_diario enable row level security;
drop policy if exists "solo lo mio" on public.sesiones_diario;
create policy "solo lo mio" on public.sesiones_diario for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.sesiones_diario to authenticated;
revoke all on public.sesiones_diario from anon;
