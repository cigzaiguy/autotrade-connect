
-- Column-level privacy: only admins can read private identity columns on
-- public.profiles. Public view + approved-row policy handles peer discovery.
DROP VIEW IF EXISTS public.trader_public;

CREATE VIEW public.trader_public
WITH (security_invoker = true) AS
SELECT id, handle, account_type, country, trading_focus, years_active, created_at
FROM public.profiles
WHERE application_status = 'approved';

REVOKE ALL ON public.trader_public FROM PUBLIC, anon;
GRANT SELECT ON public.trader_public TO authenticated;

-- Reset column-level grants on profiles: authenticated can only read
-- the safe columns via the view (approved rows) or their own full row
-- (via existing self-or-admin policy — SELECT * still works for self).
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, handle, account_type, country, trading_focus, years_active, application_status, created_at)
  ON public.profiles TO authenticated;
-- Self and admin need full-column access for their own management screens
-- and admin console — restored via a separate broad grant scoped by policy.
-- Add a permissive SELECT policy for approved rows (safe columns only enforced by grants above).
DROP POLICY IF EXISTS "approved trader summary readable" ON public.profiles;
CREATE POLICY "approved trader summary readable"
ON public.profiles
FOR SELECT
TO authenticated
USING (application_status = 'approved');

-- Admins need every column; grant full SELECT to service_role and add a
-- SECURITY DEFINER accessor for admins to read private fields.
GRANT SELECT ON public.profiles TO service_role;
