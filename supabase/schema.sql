begin;
create schema if not exists private;
create table if not exists public.store_owners (
  email text primary key check (email = lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  created_at timestamptz not null default now()
);
insert into public.store_owners(email) values ('nutriescomercial@gmail.com') on conflict do nothing;
alter table public.store_owners enable row level security;
create or replace function private.is_store_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.store_owners o join auth.users u
  on lower(u.email) = o.email where u.id = (select auth.uid()) and u.email_confirmed_at is not null);
$$;
revoke all on function private.is_store_owner() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_store_owner() to anon, authenticated;
create policy owner_list on public.store_owners for select to authenticated using ((select private.is_store_owner()));
create policy owner_invite on public.store_owners for insert to authenticated with check ((select private.is_store_owner()));
revoke all on public.store_owners from anon, authenticated;
grant select, insert on public.store_owners to authenticated;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  description text not null default '' check (length(description) <= 1200),
  category text not null check (category in ('vitaminas','suplementos','naturais')),
  price numeric(12,2) not null check (price > 0 and price <= 999999),
  offer_type text not null default 'none' check (offer_type in ('none','percent','fixed')),
  offer_value numeric(12,2) not null default 0,
  offer_label text not null default '' check (length(offer_label) <= 60),
  image_url text not null check (image_url ~ '^https://' or image_url ~ '^/assets/[a-zA-Z0-9._-]+$'),
  checkout_url text not null default '' check (checkout_url = '' or (checkout_url ~ '^https://' and checkout_url !~ '^https://[^/]*@')),
  published boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((offer_type = 'none' and offer_value = 0) or (offer_type = 'percent' and offer_value > 0 and offer_value < 100) or (offer_type = 'fixed' and offer_value > 0 and offer_value < price)),
  check (round(case when offer_type = 'percent' then price * (1 - offer_value / 100) when offer_type = 'fixed' then price - offer_value else price end, 2) >= 0.01)
);
alter table public.products enable row level security;
create policy products_read on public.products for select to anon, authenticated using (published or (select private.is_store_owner()));
create policy products_insert on public.products for insert to authenticated with check ((select private.is_store_owner()));
create policy products_update on public.products for update to authenticated using ((select private.is_store_owner())) with check ((select private.is_store_owner()));
revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update on public.products to authenticated;
create index if not exists products_catalog on public.products(position, created_at) where published;
create or replace function private.touch_product() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger product_updated before update on public.products for each row execute function private.touch_product();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy product_images_read on storage.objects for select to authenticated using (bucket_id = 'product-images' and (select private.is_store_owner()));
create policy product_images_insert on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and (select private.is_store_owner()));
create policy product_images_delete on storage.objects for delete to authenticated using (bucket_id = 'product-images' and (select private.is_store_owner()));

insert into public.products(id,name,description,category,price,image_url,checkout_url,published,position) values
('10000000-0000-4000-8000-000000000001','Vitaxon C Efervescente','Vitamina C com zinco para imunidade e energia no dia a dia.','vitaminas',29.90,'/assets/produto-vendas-1.jpeg','https://www.mercadolivre.com.br/suplemento-nutricional-vitamina-c-airela-efervescente-laranja-10-comprimidos/p/MLB19708218?pdp_filters=item_id%3AMLB4679975577&matt_tool=38524122#origin=share&sid=share&wid=MLB4679975577&action=copy',true,1),
('10000000-0000-4000-8000-000000000002','Coenzima Q10 100mg','Suporte antioxidante e cardiovascular com alta percepcao de valor.','suplementos',79.90,'/assets/produto-vendas-2.jpeg','https://produto.mercadolivre.com.br/MLB-6775682984-suplemento-alimentar-coenzima-q10-100mg-60-capsulas-airela-_JM?matt_tool=38524122#origin=share&sid=share&action=copy',true,2),
('10000000-0000-4000-8000-000000000003','Soro Flux Isotonico','Reposicao rapida, sem acucar e excelente giro no ponto de venda.','naturais',18.90,'/assets/produto-vendas-3.jpeg','https://produto.mercadolivre.com.br/MLB-4632212955-soroflux-isotnico-500ml-eletrolitos-hidrataco-energia-rep-_JM?matt_tool=38524122#origin=share&sid=share&action=copy',true,3),
('10000000-0000-4000-8000-000000000004','Condroflan Curcuma Artix','Foco em mobilidade e saude articular para publico adulto.','suplementos',89.90,'/assets/produto-vendas-4.jpeg','https://produto.mercadolivre.com.br/MLB-6777039048-suplemento-colageno-tipo-2-acido-hialurnico-c30-airela-_JM?matt_tool=38524122#origin=share&sid=share&action=copy',true,4),
('10000000-0000-4000-8000-000000000005','Leflora Probiotico','Equilibrio intestinal com forte demanda e recompra frequente.','vitaminas',42.90,'/assets/produto-vendas-5.jpeg','https://www.mercadolivre.com.br/leflora-lac-airela-12-capsulas/p/MLB45753103?pdp_filters=item_id%3AMLB4680148781&matt_tool=38524122#origin=share&sid=share&wid=MLB4680148781&action=copy',true,5),
('10000000-0000-4000-8000-000000000006','B12 Concentrado','Metilcobalamina de alta dose para energia e suporte neurologico.','naturais',54.90,'/assets/produto-vendas-6.jpeg','https://www.mercadolivre.com.br/metilcobalamina-b12-concentrado-c60-capsulas-airela-sabor-sem-sabor/p/MLB51698366?pdp_filters=item_id%3AMLB6777466114&matt_tool=38524122#origin=share&sid=share&wid=MLB6777466114&action=copy',true,6)
on conflict(id) do nothing;
commit;
