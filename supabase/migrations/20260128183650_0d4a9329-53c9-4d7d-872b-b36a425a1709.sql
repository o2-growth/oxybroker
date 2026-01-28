-- Oxy Broker de Ativos - Complete Schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE public.app_role AS ENUM ('admin', 'master_franquia', 'franquia', 'oxy_hacker');
CREATE TYPE public.asset_type AS ENUM ('lead', 'mlq', 'meeting');
CREATE TYPE public.asset_status AS ENUM ('draft', 'available', 'in_auction', 'sold', 'returned', 'disabled');
CREATE TYPE public.lot_status AS ENUM ('draft', 'live', 'ended', 'cancelled');
CREATE TYPE public.purchase_status AS ENUM ('paid', 'refunded', 'disputed');
CREATE TYPE public.wallet_transaction_type AS ENUM ('topup', 'debit_purchase', 'credit_refund', 'transfer_in', 'transfer_out', 'admin_adjust');
CREATE TYPE public.transfer_type AS ENUM ('balance', 'asset');
CREATE TYPE public.transfer_status AS ENUM ('completed', 'reversed');
CREATE TYPE public.return_status AS ENUM ('requested', 'approved', 'rejected', 'processed');
CREATE TYPE public.notification_channel AS ENUM ('in_app', 'email');

-- Table: franchise_categories
CREATE TABLE public.franchise_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  limits_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  role public.app_role NOT NULL DEFAULT 'franquia',
  franchise_category_id UUID REFERENCES public.franchise_categories(id) ON DELETE SET NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: user_roles (separate table for RBAC as per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Table: app_settings (singleton)
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_window_hours INT NOT NULL DEFAULT 72,
  bidding_extension_seconds INT NOT NULL DEFAULT 30,
  scoring_weights JSONB DEFAULT '{"sector": 1, "revenue": 2, "employees": 1, "location": 1}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.app_settings (id, return_window_hours, bidding_extension_seconds)
VALUES ('00000000-0000-0000-0000-000000000001', 72, 30);

-- Table: category_asset_availability
CREATE TABLE public.category_asset_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_category_id UUID NOT NULL REFERENCES public.franchise_categories(id) ON DELETE CASCADE,
  asset_type public.asset_type NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(franchise_category_id, asset_type)
);

-- Table: assets
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type public.asset_type NOT NULL,
  title TEXT NOT NULL,
  sector TEXT,
  revenue_range TEXT,
  employees_count INT,
  location_city TEXT,
  location_state TEXT,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  base_score INT NOT NULL DEFAULT 0,
  status public.asset_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: lots
CREATE TABLE public.lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status public.lot_status NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  min_bid_increment NUMERIC(15,2) NOT NULL DEFAULT 100.00,
  starting_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  current_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  winner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: lot_items (many-to-many between lots and assets)
CREATE TABLE public.lot_items (
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lot_id, asset_id)
);

-- Table: bids
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: purchases
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.purchase_status NOT NULL DEFAULT 'paid',
  return_deadline_at TIMESTAMPTZ
);

-- Table: wallets
CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: wallet_transactions
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.wallet_transaction_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: transfers
CREATE TABLE public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.transfer_type NOT NULL,
  amount NUMERIC(15,2),
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  status public.transfer_status NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: returns
CREATE TABLE public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  status public.return_status NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Table: notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel public.notification_channel NOT NULL DEFAULT 'in_app',
  type TEXT NOT NULL,
  title TEXT,
  payload JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================
-- SECURITY DEFINER FUNCTIONS (for RLS)
-- ========================================

-- Function: Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function: Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Function: Check if user is oxy_hacker
CREATE OR REPLACE FUNCTION public.is_oxy_hacker()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'oxy_hacker')
$$;

-- Function: Get user role from profiles
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

-- ========================================
-- ROW LEVEL SECURITY POLICIES
-- ========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchise_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_asset_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Oxy hacker can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_oxy_hacker());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- USER_ROLES policies
CREATE POLICY "Admin can manage roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin());

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- FRANCHISE_CATEGORIES policies
CREATE POLICY "Authenticated users can view categories"
  ON public.franchise_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage categories"
  ON public.franchise_categories FOR ALL
  USING (public.is_admin());

-- APP_SETTINGS policies
CREATE POLICY "Authenticated users can view settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage settings"
  ON public.app_settings FOR ALL
  USING (public.is_admin());

-- CATEGORY_ASSET_AVAILABILITY policies
CREATE POLICY "Authenticated users can view availability"
  ON public.category_asset_availability FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage availability"
  ON public.category_asset_availability FOR ALL
  USING (public.is_admin());

-- ASSETS policies
CREATE POLICY "Authenticated users can view available assets"
  ON public.assets FOR SELECT
  TO authenticated
  USING (status != 'draft' OR public.is_admin());

CREATE POLICY "Admin can manage assets"
  ON public.assets FOR ALL
  USING (public.is_admin());

-- LOTS policies
CREATE POLICY "Authenticated users can view non-draft lots"
  ON public.lots FOR SELECT
  TO authenticated
  USING (status != 'draft' OR public.is_admin());

CREATE POLICY "Admin can manage lots"
  ON public.lots FOR ALL
  USING (public.is_admin());

-- LOT_ITEMS policies
CREATE POLICY "Authenticated users can view lot items"
  ON public.lot_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage lot items"
  ON public.lot_items FOR ALL
  USING (public.is_admin());

-- BIDS policies
CREATE POLICY "Users can view bids on live lots"
  ON public.bids FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create bids"
  ON public.bids FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can manage bids"
  ON public.bids FOR ALL
  USING (public.is_admin());

-- PURCHASES policies
CREATE POLICY "Users can view their own purchases"
  ON public.purchases FOR SELECT
  USING (auth.uid() = buyer_user_id);

CREATE POLICY "Admin can view all purchases"
  ON public.purchases FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Oxy hacker can view all purchases"
  ON public.purchases FOR SELECT
  USING (public.is_oxy_hacker());

CREATE POLICY "Admin can manage purchases"
  ON public.purchases FOR ALL
  USING (public.is_admin());

-- WALLETS policies
CREATE POLICY "Users can view their own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all wallets"
  ON public.wallets FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Oxy hacker can view all wallets"
  ON public.wallets FOR SELECT
  USING (public.is_oxy_hacker());

CREATE POLICY "Users can insert their own wallet"
  ON public.wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can manage wallets"
  ON public.wallets FOR ALL
  USING (public.is_admin());

-- WALLET_TRANSACTIONS policies
CREATE POLICY "Users can view their own transactions"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all transactions"
  ON public.wallet_transactions FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Oxy hacker can view all transactions"
  ON public.wallet_transactions FOR SELECT
  USING (public.is_oxy_hacker());

CREATE POLICY "Admin can manage transactions"
  ON public.wallet_transactions FOR ALL
  USING (public.is_admin());

-- TRANSFERS policies
CREATE POLICY "Users can view their transfers"
  ON public.transfers FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Admin can view all transfers"
  ON public.transfers FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Oxy hacker can view all transfers"
  ON public.transfers FOR SELECT
  USING (public.is_oxy_hacker());

CREATE POLICY "Users can create transfers"
  ON public.transfers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Admin can manage transfers"
  ON public.transfers FOR ALL
  USING (public.is_admin());

-- RETURNS policies
CREATE POLICY "Users can view their returns"
  ON public.returns FOR SELECT
  USING (auth.uid() = requested_by);

CREATE POLICY "Admin can view all returns"
  ON public.returns FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Oxy hacker can view all returns"
  ON public.returns FOR SELECT
  USING (public.is_oxy_hacker());

CREATE POLICY "Users can request returns"
  ON public.returns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Admin can manage returns"
  ON public.returns FOR ALL
  USING (public.is_admin());

-- NOTIFICATIONS policies
CREATE POLICY "Users can view their notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage notifications"
  ON public.notifications FOR ALL
  USING (public.is_admin());

-- ========================================
-- TRIGGERS
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_franchise_categories_updated
  BEFORE UPDATE ON public.franchise_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_app_settings_updated
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_assets_updated
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_lots_updated
  BEFORE UPDATE ON public.lots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_wallets_updated
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to create profile and wallet on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'franquia'
  );
  
  -- Create wallet with 0 balance
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0.00);
  
  -- Assign default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'franquia');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- ENABLE REALTIME
-- ========================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ========================================
-- SEED DATA
-- ========================================

-- Insert franchise categories
INSERT INTO public.franchise_categories (name, limits_json) VALUES
  ('Premium', '{"max_bids_per_day": 50, "max_lot_value": 100000}'),
  ('Standard', '{"max_bids_per_day": 20, "max_lot_value": 50000}'),
  ('Basic', '{"max_bids_per_day": 10, "max_lot_value": 20000}');

-- Insert sample assets
INSERT INTO public.assets (asset_type, title, sector, revenue_range, employees_count, location_city, location_state, base_score, status) VALUES
  ('lead', 'TechCorp Solutions', 'Tecnologia', 'R$ 1M - 5M', 50, 'São Paulo', 'SP', 85, 'available'),
  ('lead', 'Indústria Metalúrgica ABC', 'Indústria', 'R$ 5M - 10M', 120, 'Campinas', 'SP', 92, 'available'),
  ('mlq', 'Consultoria Financeira XYZ', 'Financeiro', 'R$ 500K - 1M', 25, 'Rio de Janeiro', 'RJ', 78, 'available'),
  ('mlq', 'E-commerce Fashion Store', 'Varejo', 'R$ 2M - 5M', 35, 'Belo Horizonte', 'MG', 81, 'available'),
  ('meeting', 'Agência de Marketing Digital', 'Marketing', 'R$ 200K - 500K', 15, 'Curitiba', 'PR', 65, 'available'),
  ('meeting', 'Clínica Médica Premium', 'Saúde', 'R$ 1M - 2M', 40, 'Porto Alegre', 'RS', 88, 'available'),
  ('lead', 'Construtora Horizonte', 'Construção', 'R$ 10M - 20M', 200, 'Brasília', 'DF', 95, 'available'),
  ('mlq', 'Logística Express', 'Logística', 'R$ 3M - 5M', 80, 'Salvador', 'BA', 83, 'available'),
  ('lead', 'Farmacêutica BioLife', 'Farmacêutico', 'R$ 5M - 10M', 100, 'Recife', 'PE', 90, 'available'),
  ('meeting', 'Escola de Idiomas Global', 'Educação', 'R$ 500K - 1M', 30, 'Fortaleza', 'CE', 72, 'available');

-- Insert sample lots
INSERT INTO public.lots (title, description, status, starts_at, ends_at, min_bid_increment, starting_price, current_price) VALUES
  ('Lote Premium Tech', 'Leads de alta qualidade do setor de tecnologia', 'live', now(), now() + interval '2 days', 500.00, 5000.00, 5000.00),
  ('Lote Indústria', 'Ativos industriais com alto potencial', 'live', now(), now() + interval '3 days', 1000.00, 10000.00, 10000.00),
  ('Lote Serviços', 'Mix de leads e MLQs de serviços', 'draft', now() + interval '1 day', now() + interval '4 days', 250.00, 2500.00, 2500.00);

-- Link assets to lots
INSERT INTO public.lot_items (lot_id, asset_id)
SELECT l.id, a.id FROM public.lots l, public.assets a
WHERE l.title = 'Lote Premium Tech' AND a.title IN ('TechCorp Solutions', 'Agência de Marketing Digital');

INSERT INTO public.lot_items (lot_id, asset_id)
SELECT l.id, a.id FROM public.lots l, public.assets a
WHERE l.title = 'Lote Indústria' AND a.title IN ('Indústria Metalúrgica ABC', 'Construtora Horizonte', 'Logística Express');