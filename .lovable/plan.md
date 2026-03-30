

## Plan: Fix Checkout 401 Error and forwardRef Warnings

There are two issues to fix:

### Issue 1 — create-checkout returns 401 (Invalid JWT)

The `create-checkout` edge function has `verify_jwt = true` in `supabase/config.toml`. The platform-level JWT verification is rejecting the token before the function code even runs. The runtime error confirms: `{"code":401,"message":"Invalid JWT"}`.

**Fix**: Follow the recommended edge function pattern:
1. In `supabase/config.toml`, set `verify_jwt = false` for `create-checkout`
2. In `supabase/functions/create-checkout/index.ts`, update the auth handling to extract the token manually and validate in code (matching the pattern used in the Stripe implementation guide): extract token from `Authorization` header, call `supabase.auth.getUser(token)`, and use `npm:` import for supabase client instead of `esm.sh`

### Issue 2 — forwardRef warnings on Skeleton and DialogHeader

`Skeleton` and `DialogHeader` are plain function components that don't accept refs, but Radix/React is passing refs to them.

**Fix**:
1. `src/components/ui/skeleton.tsx` — Wrap with `React.forwardRef`
2. `src/components/ui/dialog.tsx` — Wrap `DialogHeader` with `React.forwardRef` (line 54)

### Files changed

1. **`supabase/config.toml`** — Change `create-checkout` to `verify_jwt = false`
2. **`supabase/functions/create-checkout/index.ts`** — Extract token manually, validate with `getUser(token)`, use `npm:` import
3. **`src/components/ui/skeleton.tsx`** — Add `React.forwardRef`
4. **`src/components/ui/dialog.tsx`** — Wrap `DialogHeader` with `React.forwardRef`

