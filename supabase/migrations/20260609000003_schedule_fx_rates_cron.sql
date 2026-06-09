-- Schedule daily exchange rate fetch.
-- Runs at 11:00 UTC = 08:00 Buenos Aires (UTC-3, no DST).
-- Calls the fetch-fx-rates Edge Function deployed with --no-verify-jwt
-- (the function only writes public market data, no auth needed).
select cron.schedule(
  'fetch-fx-rates-daily',
  '0 11 * * *',
  $$
    select net.http_post(
      url     := 'https://fwzzsnczcoztadfvksft.supabase.co/functions/v1/fetch-fx-rates',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    )
  $$
);
