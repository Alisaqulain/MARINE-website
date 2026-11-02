/**
 * Sale dates are calendar days in the shop's own time zone (India, UTC+05:30 by default),
 * so a sale chosen for "2 Nov – 4 Nov" runs from 2 Nov 00:00 to 4 Nov 23:59:59 shop time.
 * No imports: used by the server (lib/sales.ts) and by admin screens in the browser.
 */
const OFFSET = /^[+-]\d{2}:\d{2}$/.test(process.env.NEXT_PUBLIC_SHOP_UTC_OFFSET || "")
  ? (process.env.NEXT_PUBLIC_SHOP_UTC_OFFSET as string)
  : "+05:30";

export function saleStartMs(startsAt: string) {
  return Date.parse(`${startsAt.slice(0, 10)}T00:00:00.000${OFFSET}`);
}

export function saleEndMs(endsAt: string) {
  return Date.parse(`${endsAt.slice(0, 10)}T23:59:59.999${OFFSET}`);
}

/** End of the sale as an ISO instant, for countdowns. */
export function saleEndIso(endsAt: string) {
  const ms = saleEndMs(endsAt);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : `${endsAt.slice(0, 10)}T23:59:59.999Z`;
}

export function saleWindowLive(sale: { startsAt: string; endsAt: string }, now = Date.now()) {
  return saleStartMs(sale.startsAt) <= now && now <= saleEndMs(sale.endsAt);
}

export function saleWindowPast(sale: { endsAt: string }, now = Date.now()) {
  return now > saleEndMs(sale.endsAt);
}
