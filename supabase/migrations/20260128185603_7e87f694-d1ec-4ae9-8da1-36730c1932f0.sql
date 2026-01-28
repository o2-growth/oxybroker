-- =============================================
-- HARDENING RLS POLICIES - OXY BROKER
-- Deny by default, strict user isolation
-- =============================================

-- Drop existing policies that need to be fixed
-- We'll recreate with proper PERMISSIVE/RESTRICTIVE configuration

-- =============================================
-- WALLETS - User isolation
-- =============================================
DROP POLICY IF EXISTS "Admin can manage wallets" ON public.wallets;
DROP POLICY IF EXISTS "Admin can view all wallets" ON public.wallets;
DROP POLICY IF EXISTS "Oxy hacker can view all wallets" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can view their own wallet" ON public.wallets;

-- Recreate with explicit PERMISSIVE (default, combines with OR)
CREATE POLICY "wallets_select_own"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "wallets_select_admin"
  ON public.wallets FOR SELECT
  USING (is_admin());

CREATE POLICY "wallets_insert_own"
  ON public.wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wallets_update_admin"
  ON public.wallets FOR UPDATE
  USING (is_admin());

CREATE POLICY "wallets_delete_admin"
  ON public.wallets FOR DELETE
  USING (is_admin());

-- =============================================
-- WALLET_TRANSACTIONS - User isolation (NO oxy_hacker access)
-- =============================================
DROP POLICY IF EXISTS "Admin can manage transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admin can view all transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Oxy hacker can view all transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.wallet_transactions;

CREATE POLICY "wallet_tx_select_own"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "wallet_tx_select_admin"
  ON public.wallet_transactions FOR SELECT
  USING (is_admin());

CREATE POLICY "wallet_tx_insert_admin"
  ON public.wallet_transactions FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "wallet_tx_update_admin"
  ON public.wallet_transactions FOR UPDATE
  USING (is_admin());

CREATE POLICY "wallet_tx_delete_admin"
  ON public.wallet_transactions FOR DELETE
  USING (is_admin());

-- =============================================
-- PURCHASES - User isolation (oxy_hacker read-only)
-- =============================================
DROP POLICY IF EXISTS "Admin can manage purchases" ON public.purchases;
DROP POLICY IF EXISTS "Admin can view all purchases" ON public.purchases;
DROP POLICY IF EXISTS "Oxy hacker can view all purchases" ON public.purchases;
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.purchases;

CREATE POLICY "purchases_select_own"
  ON public.purchases FOR SELECT
  USING (auth.uid() = buyer_user_id);

CREATE POLICY "purchases_select_admin"
  ON public.purchases FOR SELECT
  USING (is_admin());

CREATE POLICY "purchases_select_oxy_hacker"
  ON public.purchases FOR SELECT
  USING (is_oxy_hacker());

CREATE POLICY "purchases_insert_admin"
  ON public.purchases FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "purchases_update_admin"
  ON public.purchases FOR UPDATE
  USING (is_admin());

CREATE POLICY "purchases_delete_admin"
  ON public.purchases FOR DELETE
  USING (is_admin());

-- =============================================
-- RETURNS - User isolation (oxy_hacker read-only)
-- =============================================
DROP POLICY IF EXISTS "Admin can manage returns" ON public.returns;
DROP POLICY IF EXISTS "Admin can view all returns" ON public.returns;
DROP POLICY IF EXISTS "Oxy hacker can view all returns" ON public.returns;
DROP POLICY IF EXISTS "Users can request returns" ON public.returns;
DROP POLICY IF EXISTS "Users can view their returns" ON public.returns;

CREATE POLICY "returns_select_own"
  ON public.returns FOR SELECT
  USING (auth.uid() = requested_by);

CREATE POLICY "returns_select_admin"
  ON public.returns FOR SELECT
  USING (is_admin());

CREATE POLICY "returns_select_oxy_hacker"
  ON public.returns FOR SELECT
  USING (is_oxy_hacker());

CREATE POLICY "returns_insert_own"
  ON public.returns FOR INSERT
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "returns_update_admin"
  ON public.returns FOR UPDATE
  USING (is_admin());

CREATE POLICY "returns_delete_admin"
  ON public.returns FOR DELETE
  USING (is_admin());

-- =============================================
-- TRANSFERS - User isolation (oxy_hacker read-only)
-- =============================================
DROP POLICY IF EXISTS "Admin can manage transfers" ON public.transfers;
DROP POLICY IF EXISTS "Admin can view all transfers" ON public.transfers;
DROP POLICY IF EXISTS "Oxy hacker can view all transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can create transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can view their transfers" ON public.transfers;

CREATE POLICY "transfers_select_own"
  ON public.transfers FOR SELECT
  USING ((auth.uid() = from_user_id) OR (auth.uid() = to_user_id));

CREATE POLICY "transfers_select_admin"
  ON public.transfers FOR SELECT
  USING (is_admin());

CREATE POLICY "transfers_select_oxy_hacker"
  ON public.transfers FOR SELECT
  USING (is_oxy_hacker());

CREATE POLICY "transfers_insert_own"
  ON public.transfers FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "transfers_update_admin"
  ON public.transfers FOR UPDATE
  USING (is_admin());

CREATE POLICY "transfers_delete_admin"
  ON public.transfers FOR DELETE
  USING (is_admin());

-- =============================================
-- PROFILES - Stricter isolation
-- =============================================
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Oxy hacker can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "profiles_select_oxy_hacker"
  ON public.profiles FOR SELECT
  USING (is_oxy_hacker());

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (is_admin());

-- =============================================
-- NOTIFICATIONS - Strict user isolation
-- =============================================
DROP POLICY IF EXISTS "Admin can manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;

CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_select_admin"
  ON public.notifications FOR SELECT
  USING (is_admin());

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_admin"
  ON public.notifications FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "notifications_delete_admin"
  ON public.notifications FOR DELETE
  USING (is_admin());

-- =============================================
-- BIDS - Fix to ensure proper isolation
-- =============================================
DROP POLICY IF EXISTS "Admin can manage bids" ON public.bids;
DROP POLICY IF EXISTS "Users can create bids" ON public.bids;
DROP POLICY IF EXISTS "Users can view bids on live lots" ON public.bids;

-- All authenticated can view bids (needed for auction transparency)
CREATE POLICY "bids_select_authenticated"
  ON public.bids FOR SELECT
  USING (true);

-- Users can only insert bids for themselves
CREATE POLICY "bids_insert_own"
  ON public.bids FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only admin can update/delete bids
CREATE POLICY "bids_update_admin"
  ON public.bids FOR UPDATE
  USING (is_admin());

CREATE POLICY "bids_delete_admin"
  ON public.bids FOR DELETE
  USING (is_admin());

-- =============================================
-- USER_ROLES - Admin only management
-- =============================================
DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "user_roles_select_own"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_roles_select_admin"
  ON public.user_roles FOR SELECT
  USING (is_admin());

CREATE POLICY "user_roles_insert_admin"
  ON public.user_roles FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "user_roles_update_admin"
  ON public.user_roles FOR UPDATE
  USING (is_admin());

CREATE POLICY "user_roles_delete_admin"
  ON public.user_roles FOR DELETE
  USING (is_admin());