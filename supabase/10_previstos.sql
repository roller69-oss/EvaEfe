-- EvaEfe · contenidos previstos (planificados, aún no se evalúan en los grupos)
alter table public.contenidos add column if not exists previsto boolean not null default false;
