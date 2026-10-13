/** Can open /wholesale and /wholesale/quote (logged-in retail customers cannot). */
export function canAccessWholesale(user?: { role?: string } | null): boolean {
  if (!user) return false;
  return user.role === "wholesale" || user.role === "admin" || user.role === "staff";
}

export function isRetailCustomer(user?: { role?: string } | null): boolean {
  return Boolean(user && user.role === "customer");
}

/** Wholesale links are visible for everyone (retail clicks open the account-switch popup). */
export function showWholesaleNavigation(_user?: { role?: string } | null): boolean {
  return true;
}
