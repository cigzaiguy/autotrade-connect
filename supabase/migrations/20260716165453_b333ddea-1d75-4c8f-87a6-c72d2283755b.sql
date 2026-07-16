
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'trader');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL UNIQUE,
  company_name TEXT,
  contact_email TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- A trader sees their own full profile; admin sees all.
CREATE POLICY "own profile or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile with random handle on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, handle, contact_email)
  VALUES (
    NEW.id,
    'TRADER-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6)),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'trader');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ LISTINGS (Deal Room) ============
CREATE TYPE public.listing_category AS ENUM ('vehicles', 'spare_parts', 'storage', 'chips', 'manufacturing');
CREATE TYPE public.listing_status AS ENUM ('active', 'brokering', 'closed', 'withdrawn');

CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_code TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.listing_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  quantity INTEGER,
  quantity_unit TEXT,
  origin_location TEXT,
  destination_scope TEXT,
  price_min NUMERIC,
  price_max NUMERIC,
  currency TEXT DEFAULT 'USD',
  lead_time_days INTEGER,
  status public.listing_status NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX listings_status_idx ON public.listings(status);
CREATE INDEX listings_category_idx ON public.listings(category);
CREATE INDEX listings_owner_idx ON public.listings(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Any authenticated trader reads all active/brokering listings; owner reads all their own.
CREATE POLICY "read active listings" ON public.listings
  FOR SELECT TO authenticated
  USING (
    status IN ('active', 'brokering')
    OR auth.uid() = owner_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "traders insert own listings" ON public.listings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owner or admin updates listings" ON public.listings
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "owner or admin deletes listings" ON public.listings
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- Auto listing_code (e.g. AI-8832-X)
CREATE OR REPLACE FUNCTION public.set_listing_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.listing_code IS NULL OR NEW.listing_code = '' THEN
    NEW.listing_code := 'AI-' || LPAD((FLOOR(RANDOM() * 9000) + 1000)::TEXT, 4, '0')
      || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 1));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER listings_set_code
BEFORE INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.set_listing_code();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER listings_touch BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ INTERESTS ============
CREATE TYPE public.interest_status AS ENUM ('submitted', 'reviewing', 'matched', 'declined');

CREATE TABLE public.interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  trader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bid_price NUMERIC,
  quantity_wanted INTEGER,
  message TEXT,
  status public.interest_status NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, trader_id)
);

CREATE INDEX interests_listing_idx ON public.interests(listing_id);
CREATE INDEX interests_trader_idx ON public.interests(trader_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interests TO authenticated;
GRANT ALL ON public.interests TO service_role;
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;

-- The submitting trader sees their own interest; the listing owner sees counts only via
-- server function; admin sees everything.
CREATE POLICY "trader reads own interests" ON public.interests
  FOR SELECT TO authenticated
  USING (auth.uid() = trader_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "trader submits interest" ON public.interests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = trader_id);

CREATE POLICY "trader withdraws own interest" ON public.interests
  FOR DELETE TO authenticated USING (auth.uid() = trader_id);

CREATE POLICY "admin updates interest status" ON public.interests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
