-- =====================================================================
-- EvaEfe · criterios de evaluación y competencias específicas
-- Ejecutar UNA vez en Supabase → SQL Editor, después de schema.sql.
-- Se puede volver a ejecutar sin romper nada.
-- =====================================================================

create table if not exists public.competencias (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  curso_id    uuid not null references public.cursos(id) on delete cascade,
  codigo      text not null,                 -- "CE1"
  descripcion text not null default '',
  orden       int not null default 0,
  unique (curso_id, codigo)
);

create table if not exists public.criterios (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  curso_id       uuid not null references public.cursos(id) on delete cascade,
  competencia_id uuid references public.competencias(id) on delete set null,
  codigo         text not null,              -- "2.2"
  descripcion    text not null default '',
  peso           numeric not null default 1 check (peso >= 0),  -- peso dentro de su competencia
  orden          int not null default 0,
  unique (curso_id, codigo)
);

-- Criterios que evalúa cada herramienta:
-- [{"criterio_id": "...", "pct": 100, "peso": null}]
--   pct  = % de la nota de la herramienta que va a ese criterio
--   peso = peso de la herramienta en ese criterio (null = su carga en la evaluación)
alter table public.contenidos add column if not exists criterios jsonb not null default '[]';

create index if not exists competencias_curso_idx on public.competencias(curso_id);
create index if not exists criterios_curso_idx on public.criterios(curso_id);

do $$
declare t text;
begin
  foreach t in array array['competencias','criterios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo lo mio" on public.%I', t);
    execute format(
      'create policy "solo lo mio" on public.%I for all to authenticated
         using (owner_id = (select auth.uid()))
         with check (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

grant select, insert, update, delete on public.competencias, public.criterios to authenticated;
revoke all on public.competencias, public.criterios from anon;
