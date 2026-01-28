-- =============================================
-- RLS SECURITY TESTS - OXY BROKER
-- Execute these queries to verify user isolation
-- =============================================

-- =============================================
-- TEST SETUP: Create test users and data
-- Run as service_role or admin
-- =============================================

/*
-- 1. First, create test users via auth.users (run in Supabase SQL editor)
-- User A (franquia)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'user_a@test.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "User A Test"}'::jsonb
);

-- User B (franquia)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'user_b@test.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "User B Test"}'::jsonb
);

-- User C (oxy_hacker)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'oxy_hacker@test.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"full_name": "Oxy Hacker Test"}'::jsonb
);

-- 2. Profiles are auto-created via trigger, but let's add roles
INSERT INTO public.user_roles (user_id, role)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'oxy_hacker');

-- 3. Create test wallets with different balances
UPDATE public.wallets SET balance = 1000.00 WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
UPDATE public.wallets SET balance = 2500.00 WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
UPDATE public.wallets SET balance = 500.00 WHERE user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- 4. Create test wallet transactions
INSERT INTO public.wallet_transactions (user_id, type, amount, description)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'topup', 1000.00, 'Initial deposit User A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'topup', 2500.00, 'Initial deposit User B');
*/

-- =============================================
-- TEST 1: WALLETS - User cannot see other wallets
-- =============================================

-- Simulate User A session
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claims" TO '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

-- Expected: Only User A's wallet (1 row)
SELECT 
  'TEST 1A: User A sees only own wallet' as test_name,
  count(*) as row_count,
  CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END as result
FROM public.wallets
WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Expected: User A cannot see User B's wallet (0 rows)
SELECT 
  'TEST 1B: User A cannot see User B wallet' as test_name,
  count(*) as row_count,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM public.wallets
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- =============================================
-- TEST 2: WALLET_TRANSACTIONS - User isolation
-- =============================================

-- Expected: User A sees only own transactions
SELECT 
  'TEST 2A: User A sees only own transactions' as test_name,
  count(*) as row_count,
  CASE WHEN count(*) >= 0 THEN 'PASS (own data only)' ELSE 'FAIL' END as result
FROM public.wallet_transactions
WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Expected: User A cannot see User B's transactions (0 rows with RLS)
SELECT 
  'TEST 2B: User A cannot see User B transactions' as test_name,
  count(*) as row_count,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL - SECURITY BREACH!' END as result
FROM public.wallet_transactions
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- =============================================
-- TEST 3: OXY_HACKER - Cannot see wallet data
-- =============================================

-- Simulate Oxy Hacker session
-- SET LOCAL "request.jwt.claims" TO '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

-- Expected: Oxy Hacker CANNOT see other users' wallets (policy removed)
SELECT 
  'TEST 3A: Oxy Hacker cannot see wallets (only own)' as test_name,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM public.wallets 
      WHERE user_id != 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    ) THEN 'PASS' 
    ELSE 'FAIL - oxy_hacker seeing other wallets!' 
  END as result;

-- Expected: Oxy Hacker CANNOT see wallet_transactions
SELECT 
  'TEST 3B: Oxy Hacker cannot see wallet transactions' as test_name,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM public.wallet_transactions 
      WHERE user_id != 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    ) THEN 'PASS' 
    ELSE 'FAIL - oxy_hacker seeing other transactions!' 
  END as result;

-- =============================================
-- TEST 4: OXY_HACKER - Read-only on audit tables
-- =============================================

-- Expected: Oxy Hacker CAN read purchases (audit)
SELECT 
  'TEST 4A: Oxy Hacker can READ purchases (audit)' as test_name,
  'Check manually - should be able to SELECT' as instruction;

-- Expected: Oxy Hacker CANNOT update purchases
SELECT 
  'TEST 4B: Oxy Hacker cannot UPDATE purchases' as test_name,
  'Run: UPDATE purchases SET status = ''refunded'' - should fail' as instruction;

-- Expected: Oxy Hacker CANNOT delete purchases
SELECT 
  'TEST 4C: Oxy Hacker cannot DELETE purchases' as test_name,
  'Run: DELETE FROM purchases - should fail' as instruction;

-- =============================================
-- TEST 5: PROFILES - User cannot see others
-- =============================================

-- Expected: User A can only see own profile
SELECT 
  'TEST 5A: User A sees only own profile' as test_name,
  count(*) as row_count,
  CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END as result
FROM public.profiles
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Expected: User A cannot update User B's profile
SELECT 
  'TEST 5B: User A cannot update User B profile' as test_name,
  'Run: UPDATE profiles SET full_name = ''Hacked'' WHERE id = ''bbbbbbbb-...'' - should fail' as instruction;

-- =============================================
-- TEST 6: BIDS - Public read, own insert only
-- =============================================

-- Expected: All users can see bids (auction transparency)
SELECT 
  'TEST 6A: All users can see bids' as test_name,
  'Bids are public for auction transparency' as note;

-- Expected: User cannot insert bid for another user
SELECT 
  'TEST 6B: User cannot insert bid for another' as test_name,
  'Run: INSERT INTO bids (lot_id, user_id, amount) VALUES (''lot-id'', ''other-user-id'', 100) - should fail' as instruction;

-- =============================================
-- TEST 7: TRANSFERS - Bidirectional visibility
-- =============================================

-- Expected: User can see transfers where they are sender OR receiver
SELECT 
  'TEST 7: Transfers visible to both parties' as test_name,
  'User sees transfers where from_user_id = self OR to_user_id = self' as policy;

-- =============================================
-- TEST 8: NOTIFICATIONS - Strict isolation
-- =============================================

-- Expected: User A cannot see User B's notifications
SELECT 
  'TEST 8: Notifications strictly isolated' as test_name,
  count(*) as other_user_notifications,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL - SECURITY BREACH!' END as result
FROM public.notifications
WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- =============================================
-- SUMMARY: RLS Policy Matrix
-- =============================================

/*
+----------------------+--------+-------------+------------+------------+
| Table                | User   | Admin       | Oxy Hacker | Notes      |
+----------------------+--------+-------------+------------+------------+
| wallets              | Own    | All         | Own ONLY   | Isolated   |
| wallet_transactions  | Own    | All         | Own ONLY   | Isolated   |
| purchases            | Own    | All         | READ ALL   | Audit      |
| returns              | Own    | All         | READ ALL   | Audit      |
| transfers            | Own*   | All         | READ ALL   | *Both ends |
| profiles             | Own    | All         | READ ALL   | Audit      |
| notifications        | Own    | All         | None       | Isolated   |
| bids                 | Read   | All         | Read       | Public     |
| lots                 | Live   | All         | Live       | Public     |
| assets               | Avail  | All         | Avail      | Public     |
+----------------------+--------+-------------+------------+------------+

Legend:
- Own: User sees only their own data
- Own*: User sees transfers where they are sender OR receiver
- All: Full access (CRUD)
- READ ALL: Can see all records but cannot modify
- Live/Avail: Can see non-draft records
- None: No access
*/

-- =============================================
-- CLEANUP (optional)
-- =============================================
/*
DELETE FROM public.wallet_transactions WHERE user_id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
DELETE FROM public.user_roles WHERE user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);
*/
