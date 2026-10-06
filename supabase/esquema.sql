-- NUN en Supabase. Cada hoja de la antigua "Copia de NUN ERP" (Google) es un renglón con todas sus celdas.
-- Nadie entra a estas tablas desde internet directo (RLS prendido y sin permisos): solo la función "nun".
create table if not exists nun_hojas (
  nombre      text primary key,
  filas       jsonb not null default '[]'::jsonb,
  version     bigint not null default 1,
  actualizado timestamptz not null default now()
);
create table if not exists nun_historial (       -- copia de respaldo de cada hoja antes de cambiarla (cada 2 horas)
  id     bigserial primary key,
  nombre text not null,
  filas  jsonb not null,
  fecha  timestamptz not null default now(),
  motivo text
);
create index if not exists nun_historial_nombre_fecha on nun_historial (nombre, fecha desc);
create table if not exists nun_props (k text primary key, v text);
create table if not exists nun_sesiones (h text primary key, admin boolean, hasta timestamptz not null);  -- solo la huella (sha256) del código, nunca el código
create table if not exists nun_log (id bigserial primary key, fecha timestamptz not null default now(), accion text, ms int, ok boolean, error text);
alter table nun_hojas enable row level security;
alter table nun_historial enable row level security;
alter table nun_props enable row level security;
alter table nun_sesiones enable row level security;
alter table nun_log enable row level security;
revoke all on nun_hojas, nun_historial, nun_props, nun_sesiones, nun_log from anon, authenticated;
