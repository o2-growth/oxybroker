

## Plan: Reset Marco's Password via Admin Edge Function

There is no existing edge function to change a user's password. We need to create one that uses the Supabase Admin API (`auth.admin.updateUserById`), then call it to set Marco's password.

### Changes

1. **Create `supabase/functions/admin-reset-password/index.ts`** — New edge function that:
   - Validates the caller is an admin (same pattern as `create-user`)
   - Accepts `user_id` and `new_password` in the request body
   - Calls `supabaseAdmin.auth.admin.updateUserById(user_id, { password })` to update the password
   - Returns success/error response

2. **Update `supabase/config.toml`** — Add `verify_jwt = false` for `admin-reset-password` (manual JWT validation inside the function, consistent with other edge functions)

3. **Call the function** to set Marco Aurelio's password to `Alterar@01`

### Technical details

- The edge function uses `SUPABASE_SERVICE_ROLE_KEY` to call `auth.admin.updateUserById`, which bypasses normal auth restrictions
- Admin role is verified by checking `user_roles` table before proceeding
- Marco's user ID (from previous query): `efaborbe-...` — will be confirmed at execution time

