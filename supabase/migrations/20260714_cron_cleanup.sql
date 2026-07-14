-- hourly cleanup of expired links
create extension if not exists pg_cron;
select cron.schedule('cleanup-expired-links', '0 * * * *', $$select public.cleanup_expired()$$);
