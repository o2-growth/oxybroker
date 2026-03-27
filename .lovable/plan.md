

## Plan: Fix Build Errors and Lot Publishing

There are 3 distinct issues to fix:

### Issue 1 — Lot publishing fails: "A data de término deve ser no futuro"

The `publishMutation` in `useAdminLots.ts` (line ~190) validates `new Date(lot.ends_at) <= new Date()`. When creating/editing a lot, the `datetime-local` input value is converted via `new Date(formData.ends_at).toISOString()`. The problem is likely that the date was saved correctly but at publish time the deadline has already passed, OR there's a timezone interpretation issue.

**Fix**: In `useAdminLots.ts`, improve the validation error message to show the actual `ends_at` value for debugging. More importantly, in `AdminLots.tsx`, default `ends_at` to a future date (e.g., +7 days) and add a client-side validation before saving to warn if the date is in the past.

### Issue 2 — `useAdminReturns.ts` type error: no relation between `returns` and `profiles`

The query uses `profiles!requested_by(full_name, email)` but there is no foreign key from `returns.requested_by` to `profiles.id` in the database schema.

**Fix**: Replace the joined query with a two-step approach: fetch returns with purchases, then separately fetch the profile data. Or, change the query to use an RPC or manual join. Simplest fix: cast through `unknown` as the data does come back (PostgREST can resolve it by column name hint), or add the foreign key.

Best approach: Add a foreign key via migration from `returns.requested_by` to `profiles.id`, which makes the query valid. Alternatively, fetch profiles separately.

### Issue 3 — Edge function type mismatch in `_shared/analytics.ts`

The `SupabaseClient` type from `@supabase/supabase-js@2` (latest, ~2.57) doesn't match the one imported in `stripe-webhook` which uses `@2.100.1`. The floating version `@2` resolves to a different minor version.

**Fix**: Pin the import in `_shared/analytics.ts` to use `any` type for the client parameter instead of the imported `SupabaseClient` type, or change the parameter type to a generic. Simplest: `supabaseAdmin: any`.

### Changes

1. **`supabase/functions/_shared/analytics.ts`** — Change `logAnalyticsEvent` parameter from `SupabaseClient` to `any` to avoid cross-version type conflicts
2. **`src/hooks/useAdminReturns.ts`** — Fix the query to not use the `profiles!requested_by` hint (no FK exists), fetch profile separately or cast through `unknown`
3. **`src/hooks/useAdminLots.ts`** — Keep the publish validation but make it more resilient (the core logic is correct, the user likely set a past date)
4. **`src/pages/admin/AdminLots.tsx`** — Add client-side validation on the form to prevent saving a lot with a past `ends_at` date

