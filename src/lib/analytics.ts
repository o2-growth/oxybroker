export function getAmountBucket(amount: number): string {
  if (amount < 100) return "0-100";
  if (amount < 500) return "100-500";
  if (amount < 1000) return "500-1000";
  if (amount < 5000) return "1000-5000";
  return "5000+";
}
