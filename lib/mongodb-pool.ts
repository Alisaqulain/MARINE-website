/**
 * Atlas M0 free tier ≈500 connections — budget across every Node process that opens a pool.
 *
 * PM2 on this VPS (typical):
 * - excelpro — Next.js, uses MongoDB
 * - marina-muse — Next.js, uses MongoDB
 * - marina-upload — upload service, usually does NOT use this app's MongoClient
 *
 * Set MONGODB_NODE_PROCESSES to the count of PM2 apps that share MONGODB_URI (usually 2, not 3).
 * Optional MONGODB_EXTERNAL_CLIENTS reserves headroom for Compass, check:mongo, etc.
 */
export function resolveMaxPoolSize(): number {
  const explicit = Number(process.env.MONGODB_MAX_POOL_SIZE);
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.min(Math.max(1, Math.floor(explicit)), 50);
  }

  const budgetRaw = Number(process.env.MONGODB_CONNECTION_BUDGET);
  const budget = Number.isFinite(budgetRaw) && budgetRaw > 0 ? budgetRaw : 320;

  const externalRaw = Number(process.env.MONGODB_EXTERNAL_CLIENTS);
  const external =
    Number.isFinite(externalRaw) && externalRaw >= 0 ? Math.floor(externalRaw) : 40;

  const nodeProcesses = Number(process.env.MONGODB_NODE_PROCESSES);
  if (Number.isFinite(nodeProcesses) && nodeProcesses > 0) {
    const perProcess = Math.floor((budget - external) / nodeProcesses);
    return Math.max(2, Math.min(5, perProcess));
  }

  return process.env.NODE_ENV === "production" ? 3 : 5;
}