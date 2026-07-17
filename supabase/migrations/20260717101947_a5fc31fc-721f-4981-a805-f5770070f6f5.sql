
-- DEALS
CREATE TYPE deal_status AS ENUM ('open','closed','cancelled');

CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  agreed_price numeric,
  currency text DEFAULT 'USD',
  commission_pct numeric NOT NULL DEFAULT 2.5,
  commission_amount numeric GENERATED ALWAYS AS (COALESCE(agreed_price,0) * commission_pct / 100) STORED,
  status deal_status NOT NULL DEFAULT 'open',
  notes text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages deals" ON public.deals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER deals_touch BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- TRADER BILLING
CREATE TYPE fee_status AS ENUM ('paid','due','overdue','trial');

CREATE TABLE public.trader_billing (
  user_id uuid PRIMARY KEY,
  yearly_fee_status fee_status NOT NULL DEFAULT 'trial',
  fee_due_at date,
  last_paid_at date,
  suspended boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trader_billing TO authenticated;
GRANT ALL ON public.trader_billing TO service_role;
ALTER TABLE public.trader_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages billing" ON public.trader_billing FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "trader reads own billing" ON public.trader_billing FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE TRIGGER billing_touch BEFORE UPDATE ON public.trader_billing
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- INTEL SOURCES
CREATE TYPE intel_tag AS ENUM ('news','oem','freight','oil','chips');

CREATE TABLE public.intel_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  tag intel_tag NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intel_sources TO authenticated;
GRANT ALL ON public.intel_sources TO service_role;
ALTER TABLE public.intel_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manages sources" ON public.intel_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.intel_sources (name, url, tag) VALUES
  ('Reuters Autos','https://www.reuters.com/business/autos-transportation/','news'),
  ('Automotive News','https://www.autonews.com/','news'),
  ('Just Auto','https://www.just-auto.com/','news'),
  ('Toyota Newsroom','https://global.toyota/en/newsroom/','oem'),
  ('VW Group News','https://www.volkswagen-group.com/en/news-18258','oem'),
  ('Stellantis Media','https://www.stellantis.com/en/news','oem'),
  ('BYD News','https://www.bydglobal.com/en/BydNewsList.html','oem'),
  ('Ford Media','https://media.ford.com/','oem'),
  ('GM News','https://news.gm.com/','oem'),
  ('Drewry WCI','https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry','freight'),
  ('Baltic Exchange','https://www.balticexchange.com/en/index.html','freight'),
  ('OilPrice','https://oilprice.com/','oil'),
  ('SIA News','https://www.semiconductors.org/news/','chips'),
  ('TrendForce','https://www.trendforce.com/news/','chips');

-- INTEL ITEMS
CREATE TABLE public.intel_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.intel_sources(id) ON DELETE SET NULL,
  source_name text NOT NULL,
  source_url text NOT NULL,
  item_url text,
  tag intel_tag NOT NULL,
  headline text NOT NULL,
  ai_summary text,
  impact text,
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX intel_items_tag_fetched_idx ON public.intel_items (tag, fetched_at DESC);
CREATE INDEX intel_items_fetched_idx ON public.intel_items (fetched_at DESC);
GRANT SELECT ON public.intel_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intel_items TO authenticated;
GRANT ALL ON public.intel_items TO service_role;
ALTER TABLE public.intel_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads intel" ON public.intel_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin writes intel" ON public.intel_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
