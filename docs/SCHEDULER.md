# Setting up the scheduler

The app has jobs that must run on a timer: creating next week's recurring
services, posting upload reminders, flagging late handoffs, and tidying up.
They all live behind one address, `/api/cron/run`, which does nothing unless
the caller presents the `CRON_SECRET`.

Two things call it:

| Scheduler | How often | Set up by |
|---|---|---|
| Supabase (`pg_cron`) | Every 15 minutes | You, once, with the SQL below |
| Vercel Cron | Once a day | Automatic, from `vercel.json` |

The Supabase one is what makes reminders arrive on time. The Vercel one is a
free safety net: if the Supabase schedule ever stops, services are still
created and alerts still go out, just up to a day late. Why two, and why not
only Vercel, is explained in [DECISIONS.md](DECISIONS.md).

## One-time setup in Supabase

1. Open your project at supabase.com and go to **SQL Editor**.
2. Find your `CRON_SECRET` value in `.env.local` (or in Vercel's environment
   variables). It must be the same value Vercel has.
3. Paste the SQL below, replace `PASTE_CRON_SECRET_HERE` with that value, and
   click **Run**.

```sql
-- Extensions: pg_cron runs things on a timer, pg_net makes web requests.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Keep the secret in Supabase Vault (encrypted), not in the schedule itself.
select vault.create_secret('PASTE_CRON_SECRET_HERE', 'rcw_cron_secret');

-- Call the app every 15 minutes.
select cron.schedule(
  'rcw-media-jobs',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://church-media-hub-khaki.vercel.app/api/cron/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'rcw_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
```

## Checking it works

Wait up to 15 minutes, then open **Admin → Schedule** in the app. "Automatic
jobs" should say **Running** with a recent "Last ran" time.

To look from the database side, run these in the SQL Editor:

```sql
-- The schedule exists and is active.
select jobname, schedule, active from cron.job;

-- The last few calls and the app's replies. 200 is success; 401 means the
-- secret in Vault does not match CRON_SECRET in Vercel.
select created, status_code, left(content, 200) as reply
from net._http_response
order by created desc
limit 5;
```

## Changing things later

```sql
-- Stop the schedule.
select cron.unschedule('rcw-media-jobs');

-- Change the secret (after changing CRON_SECRET in Vercel and redeploying).
select vault.update_secret(
  (select id from vault.secrets where name = 'rcw_cron_secret'),
  'NEW_SECRET_VALUE'
);
```

If the app's address changes (for example a custom domain), unschedule and run
the `cron.schedule` statement again with the new address.
