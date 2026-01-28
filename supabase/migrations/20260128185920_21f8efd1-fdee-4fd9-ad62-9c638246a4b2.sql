-- =============================================
-- ATOMIC BID PLACEMENT FUNCTION
-- Handles concurrency, anti-sniping, and notifications
-- =============================================

CREATE OR REPLACE FUNCTION public.place_bid_atomic(
  p_lot_id uuid,
  p_user_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot RECORD;
  v_settings RECORD;
  v_previous_bid RECORD;
  v_new_bid_id uuid;
  v_was_extended boolean := false;
  v_new_ends_at timestamptz;
  v_bid_count integer;
  v_seconds_remaining integer;
BEGIN
  -- Lock the lot row for update (prevents race conditions)
  SELECT * INTO v_lot
  FROM public.lots
  WHERE id = p_lot_id
  FOR UPDATE;

  -- Validate lot exists
  IF v_lot IS NULL THEN
    RETURN jsonb_build_object(
      'error_code', 'LOT_NOT_FOUND',
      'error_message', 'Lote não encontrado'
    );
  END IF;

  -- Validate lot is live
  IF v_lot.status != 'live' THEN
    RETURN jsonb_build_object(
      'error_code', 'LOT_NOT_LIVE',
      'error_message', 'Este leilão não está ativo'
    );
  END IF;

  -- Validate lot hasn't ended
  IF v_lot.ends_at IS NOT NULL AND v_lot.ends_at < now() THEN
    RETURN jsonb_build_object(
      'error_code', 'LOT_ENDED',
      'error_message', 'Este leilão já foi encerrado'
    );
  END IF;

  -- Validate bid amount meets minimum
  IF p_amount < (v_lot.current_price + v_lot.min_bid_increment) THEN
    RETURN jsonb_build_object(
      'error_code', 'BID_TOO_LOW',
      'error_message', format('Lance mínimo é %s', 
        to_char(v_lot.current_price + v_lot.min_bid_increment, 'FM999G999G999D00'))
    );
  END IF;

  -- Get previous highest bid for outbid notification
  SELECT b.*, p.full_name as bidder_name INTO v_previous_bid
  FROM public.bids b
  LEFT JOIN public.profiles p ON b.user_id = p.id
  WHERE b.lot_id = p_lot_id
  ORDER BY b.amount DESC
  LIMIT 1;

  -- Get app settings for anti-sniping
  SELECT * INTO v_settings
  FROM public.app_settings
  LIMIT 1;

  -- Calculate seconds remaining
  IF v_lot.ends_at IS NOT NULL THEN
    v_seconds_remaining := EXTRACT(EPOCH FROM (v_lot.ends_at - now()))::integer;
  ELSE
    v_seconds_remaining := 9999;
  END IF;

  -- Anti-sniping: extend auction if bid in last X seconds
  v_new_ends_at := v_lot.ends_at;
  IF v_settings IS NOT NULL 
     AND v_settings.bidding_extension_seconds > 0 
     AND v_seconds_remaining <= v_settings.bidding_extension_seconds 
     AND v_seconds_remaining > 0 THEN
    v_new_ends_at := v_lot.ends_at + (v_settings.bidding_extension_seconds || ' seconds')::interval;
    v_was_extended := true;
  END IF;

  -- Insert the bid
  INSERT INTO public.bids (lot_id, user_id, amount, created_at)
  VALUES (p_lot_id, p_user_id, p_amount, now())
  RETURNING id INTO v_new_bid_id;

  -- Update lot with new price and potentially extended end time
  UPDATE public.lots
  SET 
    current_price = p_amount,
    ends_at = v_new_ends_at,
    updated_at = now()
  WHERE id = p_lot_id;

  -- Get updated bid count
  SELECT count(*) INTO v_bid_count
  FROM public.bids
  WHERE lot_id = p_lot_id;

  -- Return success with all necessary data
  RETURN jsonb_build_object(
    'success', true,
    'bid_id', v_new_bid_id,
    'lot_title', v_lot.title,
    'ends_at', v_new_ends_at,
    'was_extended', v_was_extended,
    'bid_count', v_bid_count,
    'previous_bidder_id', v_previous_bid.user_id,
    'previous_amount', v_previous_bid.amount
  );
END;
$$;

-- Grant execute to authenticated users (the function uses SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.place_bid_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_bid_atomic TO service_role;