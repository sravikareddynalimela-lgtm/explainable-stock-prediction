-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Creates each user's watchlist, locked down with Row Level Security so
-- users can only ever read and change their own rows.

create table if not exists public.watchlist (
  user_id    uuid        not null references auth.users (id) on delete cascade default auth.uid(),
  symbol     text        not null check (char_length(symbol) between 1 and 20),
  position   int         not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

alter table public.watchlist enable row level security;

drop policy if exists "Users read own watchlist"   on public.watchlist;
drop policy if exists "Users add to own watchlist" on public.watchlist;
drop policy if exists "Users update own watchlist" on public.watchlist;
drop policy if exists "Users delete own watchlist" on public.watchlist;

create policy "Users read own watchlist"   on public.watchlist for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add to own watchlist" on public.watchlist for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own watchlist" on public.watchlist for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own watchlist" on public.watchlist for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.watchlist to authenticated;
