-- Un solo pegado: esquema + RLS + catalogos
-- Ejecutar en Supabase SQL Editor

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  email text unique,
  rol text check (rol in ('comercial', 'admin')) default 'comercial'
);

create table if not exists public.visitas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.perfiles(id) not null,
  fecha date not null,
  isla text not null,
  localidad text,
  establecimiento text not null,
  contacto text,
  tipo_visita text,
  gama text,
  resultado text,
  proxima_accion text,
  fecha_proxima date,
  observaciones text,
  created_at timestamptz default now()
);

create index if not exists visitas_user_fecha_idx on public.visitas (user_id, fecha desc);
create index if not exists visitas_establecimiento_idx on public.visitas (establecimiento);

create table if not exists public.catalogos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  valor text not null,
  orden int default 0,
  unique (tipo, valor)
);

create index if not exists catalogos_tipo_idx on public.catalogos (tipo, orden);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre, rol)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    'comercial'
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

alter table public.perfiles enable row level security;
alter table public.visitas enable row level security;
alter table public.catalogos enable row level security;

drop policy if exists "perfiles_select" on public.perfiles;
create policy "perfiles_select" on public.perfiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists "perfiles_update_own" on public.perfiles;
create policy "perfiles_update_own" on public.perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "visitas_select" on public.visitas;
create policy "visitas_select" on public.visitas for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "visitas_insert" on public.visitas;
create policy "visitas_insert" on public.visitas for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "visitas_update" on public.visitas;
create policy "visitas_update" on public.visitas for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "visitas_delete" on public.visitas;
create policy "visitas_delete" on public.visitas for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "catalogos_select" on public.catalogos;
create policy "catalogos_select" on public.catalogos for select to authenticated using (true);
drop policy if exists "catalogos_admin_write" on public.catalogos;
create policy "catalogos_admin_write" on public.catalogos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.catalogos (tipo, valor, orden) values
  ('isla', 'Tenerife', 1), ('isla', 'Gran Canaria', 2), ('isla', 'Lanzarote', 3),
  ('isla', 'Fuerteventura', 4), ('isla', 'La Palma', 5), ('isla', 'La Gomera', 6), ('isla', 'El Hierro', 7),
  ('localidad', 'Santa Cruz de Tenerife', 1), ('localidad', 'La Laguna', 2), ('localidad', 'Adeje', 3),
  ('localidad', 'Arona', 4), ('localidad', 'Puerto de la Cruz', 5), ('localidad', 'Los Cristianos', 6),
  ('localidad', 'Las Palmas de Gran Canaria', 7), ('localidad', 'Telde', 8), ('localidad', 'Maspalomas', 9),
  ('localidad', 'Arrecife', 10), ('localidad', 'Puerto del Rosario', 11), ('localidad', 'Santa Cruz de La Palma', 12),
  ('localidad', 'San Sebastian de La Gomera', 13), ('localidad', 'Valverde', 14),
  ('tipo_visita', 'Primera visita', 1), ('tipo_visita', 'Seguimiento', 2), ('tipo_visita', 'Toma de pedido', 3),
  ('tipo_visita', 'Presentacion de gama', 4), ('tipo_visita', 'Entrega / merchandising', 5),
  ('tipo_visita', 'Reclamacion', 6), ('tipo_visita', 'Cobro', 7),
  ('gama', 'Helados y sorbetes', 1), ('gama', 'Tartas y entremets', 2), ('gama', 'Petit fours', 3),
  ('gama', 'Navidad / temporada', 4), ('gama', 'Flor de la Pasion', 5), ('gama', 'Salado / foie', 6), ('gama', 'Novedades', 7),
  ('resultado', 'Pedido', 1), ('resultado', 'Interesado', 2), ('resultado', 'Pendiente', 3),
  ('resultado', 'No interesado', 4), ('resultado', 'Cerrado', 5), ('resultado', 'No localizado', 6),
  ('proxima_accion', 'Visitar', 1), ('proxima_accion', 'Llamar', 2), ('proxima_accion', 'Enviar oferta', 3),
  ('proxima_accion', 'Enviar muestras', 4), ('proxima_accion', 'Seguir pedido', 5), ('proxima_accion', 'Cerrar', 6)
on conflict (tipo, valor) do nothing;
