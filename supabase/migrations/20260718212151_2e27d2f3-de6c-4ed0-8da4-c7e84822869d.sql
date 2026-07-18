
DROP VIEW IF EXISTS public.trader_public;

REVOKE ALL ON public.profiles FROM authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT (id, handle, account_type, country, trading_focus, years_active, application_status, applied_at, reviewed_at, created_at)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DROP POLICY IF EXISTS "own profile or admin" ON public.profiles;
DROP POLICY IF EXISTS "approved trader summary readable" ON public.profiles;

CREATE POLICY "select own or approved peer"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR application_status = 'approved');

CREATE VIEW public.trader_public
WITH (security_invoker = true) AS
SELECT id, handle, account_type, country, trading_focus, years_active, created_at
FROM public.profiles
WHERE application_status = 'approved';

REVOKE ALL ON public.trader_public FROM PUBLIC, anon;
GRANT SELECT ON public.trader_public TO authenticated;
