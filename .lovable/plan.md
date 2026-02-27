

## Plan: Fix Stability Issues Across Hooks and Pages

### Issues Found

1. **App.tsx** — `QueryClient` has zero config, causing aggressive retries and refetches on every window focus
2. **useWallet.ts** — Two `.single()` calls that throw PGRST116 if no row exists, triggering error loops with retries
3. **useWallet.ts** — `useEffect` depends on `[user]` (object reference), causing re-fetches on every auth state change
4. **useMarketplaceFilters.ts** — No cancellation on effect cleanup; stale responses can overwrite fresh data
5. **useTransfers.ts** — `useEffect` depends on `[user]` instead of `[user?.id]`, same instability
6. **useMyAuctions.ts** — Query key uses `undefined` when no user, can collide or cause unwanted caching
7. **Purchases.tsx** — `useEffect` depends on `[user]` instead of `[user?.id]`
8. **Notifications.tsx** — `useEffect` depends on `[user]` instead of `[user?.id]`

### Changes

| File | Fix |
|------|-----|
| `src/App.tsx` | Configure QueryClient: `retry: 1`, `staleTime: 30_000`, `refetchOnWindowFocus: false` |
| `src/hooks/useWallet.ts` | `.single()` → `.maybeSingle()` on both queries; dep `[user]` → `[user?.id]` |
| `src/hooks/useMarketplaceFilters.ts` | Add `AbortController` / cancelled flag on fetchLots cleanup; add 15s timeout via `AbortSignal.timeout` |
| `src/hooks/useTransfers.ts` | Dep `[user]` → `[user?.id]` |
| `src/hooks/useMyAuctions.ts` | Query key: `["my-auctions", user?.id ?? "__none__"]` |
| `src/pages/Purchases.tsx` | Dep `[user]` → `[user?.id]` |
| `src/pages/Notifications.tsx` | Dep `[user]` → `[user?.id]` |

