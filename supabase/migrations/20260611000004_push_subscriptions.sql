-- ============================================================
-- Push notification subscriptions (one row per browser/device per user)
-- ============================================================

create table push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  endpoint   text        not null,
  p256dh     text        not null,
  auth_key   text        not null,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_uq unique (endpoint)
);

alter table push_subscriptions enable row level security;

-- Each user manages only their own subscriptions
create policy "push_subscriptions: own"
  on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
