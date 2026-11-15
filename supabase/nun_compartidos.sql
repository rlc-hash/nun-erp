-- v5.01 (15 nov 2026) — PDFs que se mandan por WhatsApp como liga (el teléfono de Rafa no deja compartir archivos). Nunca se borran.
create table if not exists nun_compartidos (
  k       text primary key,              -- 32 hex al azar: la liga
  nombre  text,
  mime    text,
  tam     int,
  datos   text not null,                 -- base64
  quien   text,
  creado  timestamptz not null default now(),
  vistas  int not null default 0
);
alter table nun_compartidos enable row level security;
revoke all on nun_compartidos from anon, authenticated;
