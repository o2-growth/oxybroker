-- ============================================
-- SECURITY FIX: Remove oxy_hacker role access
-- ============================================
-- Admin already has full access, so oxy_hacker policies are redundant and risky

-- Drop oxy_hacker policies that expose sensitive data
DROP POLICY IF EXISTS profiles_select_oxy_hacker ON public.profiles;
DROP POLICY IF EXISTS withdrawals_select_oxy_hacker ON public.withdrawals;
DROP POLICY IF EXISTS purchases_select_oxy_hacker ON public.purchases;
DROP POLICY IF EXISTS returns_select_oxy_hacker ON public.returns;
DROP POLICY IF EXISTS transfers_select_oxy_hacker ON public.transfers;

-- Update bids policy to remove oxy_hacker access (keep lot_participants logic)
DROP POLICY IF EXISTS bids_select_lot_participants ON public.bids;
CREATE POLICY "bids_select_lot_participants"
  ON public.bids FOR SELECT
  USING (user_has_bid_on_lot(lot_id) OR is_admin());

-- ============================================
-- SECURITY FIX: Profiles email exposure
-- ============================================
-- Create a sanitized view without email for non-admin access
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT 
    id,
    full_name,
    avatar_url,
    role,
    franchise_category_id,
    created_at,
    updated_at,
    can_withdraw,
    suspended_at
  FROM public.profiles;
-- Note: email column excluded

-- Grant access to the view
GRANT SELECT ON public.profiles_public TO authenticated;

-- ============================================
-- SECURITY FIX: Withdrawals bank_info exposure  
-- ============================================
-- Create a sanitized view for users without bank_info
CREATE OR REPLACE VIEW public.withdrawals_user
WITH (security_invoker = on) AS
  SELECT 
    id,
    user_id,
    amount,
    status,
    requested_at,
    processed_at,
    notes
  FROM public.withdrawals
  WHERE user_id = auth.uid();
-- Note: bank_info column excluded, user can only see their own

-- Grant access to the view
GRANT SELECT ON public.withdrawals_user TO authenticated;