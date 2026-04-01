

## Plan: Fix forwardRef Warnings on LotDetail Page

Five components need `React.forwardRef` wrapping to eliminate the console warnings. All are plain function components receiving refs from parent renders in `LotDetail`.

### Changes

1. **`src/components/ui/badge.tsx`** — Wrap `Badge` with `React.forwardRef`
2. **`src/components/auction/AuctionStatusBadge.tsx`** — Wrap with `React.forwardRef`
3. **`src/components/auction/CountdownTimer.tsx`** — Wrap with `React.forwardRef`
4. **`src/components/auction/BuyNowButton.tsx`** — Wrap with `React.forwardRef`
5. **`src/components/auction/BidPanel.tsx`** — Wrap with `React.forwardRef`

Each component will be updated to use the pattern:
```tsx
const Component = React.forwardRef<HTMLDivElement, Props>(({ ...props }, ref) => {
  // existing logic
});
Component.displayName = "Component";
export { Component };
```

