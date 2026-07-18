
-- Revert column-level grants: profile RLS (self-or-admin) is the primary
-- protection. Peer discovery goes through the whitelisted view only.
DROP POLICY IF EXISTS "approved trader summary readable" ON public.profiles;
REVOKE SELECT (id, handle, account_type, country, trading_focus, years_active, application_status, created_at)
  ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- Recreate the view as security-definer (owner-privileged) so only the
-- whitelisted safe columns of approved traders are exposed to peers.
-- private fields (legal_name, company_name, contact_email, city, website_url,
-- linkedin_url, references_text, admin_notes) remain admin/self only via
-- the existing "own profile or admin" RLS policy on profiles.
DROP VIEW IF EXISTS public.trader_public;
CREATE VIEW public.trader_public AS
SELECT id, handle, account_type, country, trading_focus, years_active, created_at
FROM public.profiles
WHERE application_status = 'approved';

REVOKE ALL ON public.trader_public FROM PUBLIC, anon;
GRANT SELECT ON public.trader_public TO authenticated;
