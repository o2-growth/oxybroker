

## Root Cause

`useAuth()` is a plain hook, not a shared context. Every component that calls it (Sidebar, TopBar, each page) creates **its own independent state** and fetches the profile separately. When you navigate between pages:

1. Components remount, creating new `useAuth()` instances
2. Each instance starts with `profile = null` and `loading = true`
3. During the brief fetch window, `isAdmin()` returns `false` → admin section disappears
4. Profile arrives → admin section reappears → **flicker**

Additionally, in `onAuthStateChange` (line 48), `setLoading(false)` fires **before** the `setTimeout` profile fetch (line 33) resolves, so there's a window where `loading = false` but `profile` is still `null`.

## Fix

Convert `useAuth` from a standalone hook into a **shared React Context** so auth state is fetched once and shared across all components.

### Step 1: Create AuthContext provider

- Create `src/contexts/AuthContext.tsx`
- Move all state (`user`, `session`, `profile`, `loading`) and logic from `useAuth.ts` into a context provider
- Fix the race condition: only set `loading = false` **after** profile is fetched
- Export `AuthProvider` and `useAuth` hook that reads from context

### Step 2: Update useAuth.ts

- Replace the full implementation with a re-export from `AuthContext` for backward compatibility

### Step 3: Wrap App with AuthProvider

- In `App.tsx`, wrap routes with `<AuthProvider>` inside `<BrowserRouter>` (needs router for `useNavigate`)

### Step 4: Fix TopBar dependency

- In `TopBar.tsx` line 93, change `[user]` to `[user?.id]` to prevent unnecessary refetches (same pattern we fixed elsewhere)

### Result

- Auth state fetched once, shared everywhere
- No more flicker on navigation — `profile` and `isAdmin()` are stable
- Admin section stays visible consistently

