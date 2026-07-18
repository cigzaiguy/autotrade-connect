
-- Application status enum
DO $$ BEGIN
  CREATE TYPE public.application_status AS ENUM ('pending','approved','rejected','needs_info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('individual','company');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type public.account_type,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS trading_focus text,
  ADD COLUMN IF NOT EXISTS years_active integer,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS references_text text,
  ADD COLUMN IF NOT EXISTS application_status public.application_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- Backfill: everyone currently in the system counts as approved.
UPDATE public.profiles SET application_status = 'approved' WHERE application_status = 'pending';

-- Trigger: only admins may change status/reviewer/notes fields.
CREATE OR REPLACE FUNCTION public.guard_profile_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.application_status IS DISTINCT FROM OLD.application_status
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
      OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes)
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins may modify application review fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_admin_fields ON public.profiles;
CREATE TRIGGER profiles_guard_admin_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_admin_fields();

-- Numeric value on intel_items for chart series (freight/oil/chip indexes)
ALTER TABLE public.intel_items ADD COLUMN IF NOT EXISTS value numeric;
