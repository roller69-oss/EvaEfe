-- =====================================================================
-- EvaEfe · esquema de base de datos para Supabase
-- Pégalo entero en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

-- ---------- Tablas ----------

create table if not exists public.cursos (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre      text not null,
  etapa       text not null default 'ESO' check (etapa in ('ESO','BACH','OTRO')),
  -- regla de redondeo: desde ,5 sube; en Bach además desde umbral_diez se pone 10
  redondeo    jsonb not null default '{"mitad_sube": true, "umbral_diez": null}',
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.grupos (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  curso_id    uuid not null references public.cursos(id) on delete cascade,
  nombre      text not null,
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.alumnos (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  grupo_id      uuid not null references public.grupos(id) on delete cascade,
  nombre        text not null,
  observaciones text not null default '',
  orden         int not null default 0,
  created_at    timestamptz not null default now()
);

-- Contenido de un curso (Voleibol, Teórico 1…), común a todos sus grupos
create table if not exists public.contenidos (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  curso_id    uuid not null references public.cursos(id) on delete cascade,
  evaluacion  smallint not null check (evaluacion between 1 and 3),
  nombre      text not null,
  tipo        text not null default 'rubrica' check (tipo in ('nota','rubrica')),
  peso        numeric not null default 0 check (peso >= 0),       -- % en la nota de la evaluación
  escala_max  numeric not null default 5 check (escala_max > 0),  -- rúbricas: 0 a escala_max
  -- campos que solo se anotan, no puntúan: [{"id":"x1","nombre":"Modalidad","opciones":["Pie","Mano","Raqueta"]}]
  anotaciones jsonb not null default '[]',
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);

-- Ítems de una rúbrica (gestos, apartados…)
create table if not exists public.items (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contenido_id  uuid not null references public.contenidos(id) on delete cascade,
  nombre        text not null,
  peso          numeric not null default 1 check (peso >= 0),
  orden         int not null default 0
);

-- Una fila por alumno y contenido
create table if not exists public.calificaciones (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  alumno_id     uuid not null references public.alumnos(id) on delete cascade,
  contenido_id  uuid not null references public.contenidos(id) on delete cascade,
  nota          numeric check (nota between 0 and 10),        -- contenidos de nota directa
  valores       jsonb not null default '{}',                  -- rúbricas: {"<item_id>": 4, ...}
  estado        text not null default 'normal' check (estado in ('normal','compensatorio','exento','np')),
  -- trabajo compensatorio: {"nota": 7, "motivo": "Lesión de tobillo", "descripcion": "...", "fecha": "2026-11-10"}
  compensatorio jsonb,
  anotaciones   jsonb not null default '{}',                  -- {"<anotacion_id>": "Raqueta"}
  updated_at    timestamptz not null default now(),
  unique (alumno_id, contenido_id)
);

-- Nota de boletín puesta a mano (evaluación '1','2','3' o 'final')
create table if not exists public.ajustes_boletin (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  alumno_id   uuid not null references public.alumnos(id) on delete cascade,
  evaluacion  text not null check (evaluacion in ('1','2','3','final')),
  nota        numeric not null check (nota between 0 and 10),
  motivo      text not null default '',
  updated_at  timestamptz not null default now(),
  unique (alumno_id, evaluacion)
);

-- ---------- Índices ----------
create index if not exists grupos_curso_idx        on public.grupos(curso_id);
create index if not exists alumnos_grupo_idx       on public.alumnos(grupo_id);
create index if not exists contenidos_curso_idx    on public.contenidos(curso_id);
create index if not exists items_contenido_idx     on public.items(contenido_id);
create index if not exists calif_contenido_idx     on public.calificaciones(contenido_id);
create index if not exists ajustes_alumno_idx      on public.ajustes_boletin(alumno_id);

-- ---------- updated_at automático ----------
create or replace function public.tocar_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists calif_updated on public.calificaciones;
create trigger calif_updated before update on public.calificaciones
  for each row execute function public.tocar_updated_at();

drop trigger if exists ajustes_updated on public.ajustes_boletin;
create trigger ajustes_updated before update on public.ajustes_boletin
  for each row execute function public.tocar_updated_at();

-- ---------- Seguridad: cada usuario solo ve y toca lo suyo ----------
do $$
declare t text;
begin
  foreach t in array array['cursos','grupos','alumnos','contenidos','items','calificaciones','ajustes_boletin'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo lo mio" on public.%I', t);
    execute format(
      'create policy "solo lo mio" on public.%I for all to authenticated
         using (owner_id = (select auth.uid()))
         with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Permisos explícitos (el proyecto se crea con "Automatically expose new tables" desactivado):
-- solo los usuarios con sesión iniciada acceden a las tablas, y RLS limita a sus propias filas.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.cursos, public.grupos, public.alumnos, public.contenidos,
              public.items, public.calificaciones, public.ajustes_boletin to authenticated;

-- Nadie sin iniciar sesión puede leer ni escribir nada
revoke all on public.cursos, public.grupos, public.alumnos, public.contenidos,
              public.items, public.calificaciones, public.ajustes_boletin from anon;
