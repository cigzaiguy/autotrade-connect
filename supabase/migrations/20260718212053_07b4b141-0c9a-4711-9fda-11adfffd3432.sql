
DROP POLICY IF EXISTS "approved trader summary readable" ON public.profiles;

-- Recreate view WITHOUT security_invoker so it runs with owner privileges
-- and bypasses the strict profiles RLS. Only the whitelisted safe columns
-- are exposed; private identity fields never leave the view.
DROP VIEW IF EXISTS public.trader_public;
CREATE VIEW public.trader_public AS
SELECT
  id,
  handle,
  account_type,
  country,
  trading_focus,
  years_active,
  created_at
FROM public.profiles
WHERE application_status = 'approved';

REVOKE ALL ON public.trader_public FROM PUBLIC, anon;
GRANT SELECT ON public.trader_public TO authenticated;
