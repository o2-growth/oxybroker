/**
 * QueryKey factory centralizado para TanStack Query.
 *
 * Regras de uso:
 * - Sempre use estas keys em queryKey ao inves de strings literais
 * - Use a key de nivel superior para invalidacao cruzada:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.lots.all })
 * - Use a key especifica para invalidar apenas um recurso:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.lots.detail(id) })
 */
export const queryKeys = {
  lots: {
    all: ["lots"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["lots", "list", filters] as const,
    detail: (id: string) => ["lots", "detail", id] as const,
  },
  wallet: {
    all: ["wallet"] as const,
    balance: (userId: string) => ["wallet", "balance", userId] as const,
    transactions: (userId: string) =>
      ["wallet", "transactions", userId] as const,
  },
  categories: {
    all: ["categories"] as const,
  },
  assets: {
    all: ["assets"] as const,
  },
  users: {
    all: ["users"] as const,
    detail: (id: string) => ["users", "detail", id] as const,
  },
  bids: {
    byLot: (lotId: string) => ["bids", "lot", lotId] as const,
    userMax: (lotId: string, userId: string) =>
      ["bids", "user-max", lotId, userId] as const,
  },
  myAuctions: {
    all: ["my-auctions"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    byUser: (userId: string) => ["notifications", "user", userId] as const,
    unread: (userId: string) => ["notifications", "unread", userId] as const,
  },
  purchases: {
    all: ["purchases"] as const,
    byUser: (userId: string) => ["purchases", "user", userId] as const,
  },
  appSettings: {
    all: ["app_settings"] as const,
  },
  transfers: {
    all: ["transfers"] as const,
  },
  promotions: {
    all: ["promotions"] as const,
    active: ["promotions", "active"] as const,
  },
  leadsInbox: {
    all: ["leads_inbox"] as const,
    byStatus: (status: string) => ["leads_inbox", "status", status] as const,
    detail: (id: string) => ["leads_inbox", "detail", id] as const,
  },
} as const;
