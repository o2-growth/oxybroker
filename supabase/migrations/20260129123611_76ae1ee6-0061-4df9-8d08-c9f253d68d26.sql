-- 1. Criar função SECURITY DEFINER para verificar participação no lote
CREATE OR REPLACE FUNCTION public.user_has_bid_on_lot(_lot_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bids
    WHERE lot_id = _lot_id
      AND user_id = auth.uid()
  )
$$;

-- 2. Recriar política RLS sem recursão
DROP POLICY IF EXISTS "bids_select_lot_participants" ON public.bids;

CREATE POLICY "bids_select_lot_participants"
ON public.bids
FOR SELECT
USING (
  public.user_has_bid_on_lot(lot_id)
  OR public.is_admin()
  OR public.is_oxy_hacker()
);