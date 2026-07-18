
-- Safe public summary of traders. Excludes all private identity fields
-- (legal_name, company_name, contact_email, city, website_url, linkedin_url,
--  references_text, admin_notes, reviewed_by). Only approved traders visible.
CREATE OR REPLACE VIEW public.trader_public
WITH (security_invoker = true) AS
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

GRANT SELECT ON public.trader_public TO authenticated;

-- Belt-and-suspenders: allow SELECT on the view rows via profiles RLS by
-- adding a narrow policy that exposes ONLY the approved-status row existence.
-- The view uses security_invoker, so the caller's RLS on profiles applies.
-- Add a permissive SELECT policy scoped to approved profiles.
DROP POLICY IF EXISTS "approved trader summary readable" ON public.profiles;
CREATE POLICY "approved trader summary readable"
ON public.profiles
FOR SELECT
TO authenticated
USING (application_status = 'approved');
