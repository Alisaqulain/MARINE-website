import dns from "node:dns";
import { MongoClient, ServerApiVersion, type Db, type MongoClientOptions } from "mongodb";
import {
  ATLAS_CONNECTOR_VERSION,
  atlasDirectOnlyOnThisRuntime,
  clearAtlasDirectPreference,
  clientOptionsForAtlas,
  connectWithAtlasStrategy,
  nodeMajor,
  shouldTryDirectShards,
} from "@/lib/atlas-connect";
import { mongoUriFromProcessEnv, parseMongoCredentials, sanitizeEnvValue } from "@/lib/env-mongo-uri";
import { resolveMaxPoolSize } from "@/lib/mongodb-pool";

/** Atlas on Windows + OpenSSL 3 often fails on IPv6 first — prefer IPv4. */
if (process.env.MONGODB_PREFER_IPV4 !== "0") {
  dns.setDefaultResultOrder("ipv4first");
}

const dbName = process.env.MONGODB_DB_NAME ?? "marina_muse";

function normalizeMongoUri(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  let u = raw.trim();
  if (!u.includes("retryWrites=")) {
    u += u.includes("?") ? "&retryWrites=true&w=majority" : "?retryWrites=true&w=majority";
  }
  return u;
}

function parseSrvCredentials(srvUri: string) {
  return parseMongoCredentials(srvUri);
}

function isTlsError(message: string): boolean {
  return /SSL|tls|alert internal|ECONNRESET|ETIMEDOUT/i.test(message);
}

let cachedUri: string | undefined;
let uriPromise: Promise<string> | undefined;

async function normalizedSrvFromEnv(): Promise<string> {
  const fromEnv = mongoUriFromProcessEnv();
  if (!fromEnv) throw new Error("MONGODB_URI is not set");
  const srv = normalizeMongoUri(fromEnv);
  if (!srv) throw new Error("MONGODB_URI is not set");
  return srv;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function clearMongoClientCache() {
  global._mongoClientPromise = undefined;
  cachedUri = undefined;
  uriPromise = undefined;
  clearAtlasDirectPreference();
}

export function isMongoNotPrimaryError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /not primary|read-only secondary/i.test(msg);
}

/** Reconnect and run once more when a stale direct shard was a secondary. */
export async function withMongoWriteRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isMongoNotPrimaryError(err)) throw err;
    clearMongoClientCache();
    return fn();
  }
}

function clientOptions(): MongoClientOptions {
  const opts = clientOptionsForAtlas();
  if (process.env.MONGODB_SERVER_API !== "0") {
    opts.serverApi = {
      version: ServerApiVersion.v1,
      strict: false,
      deprecationErrors: false,
    };
  }
  return opts;
}

async function tryConnect(uri: string): Promise<MongoClient> {
  const client = new MongoClient(uri, clientOptions());
  try {
    await client.connect();
    return client;
  } catch (err) {
    await client.close().catch(() => {});
    throw err;
  }
}

let shutdownHooksRegistered = false;

function registerShutdownHooksOnce() {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;
  const onSignal = () => {
    void closeMongoClient();
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
}

async function connectClient(): Promise<MongoClient> {
  const srv = await normalizedSrvFromEnv();
  const { client, uri } = await connectWithAtlasStrategy(srv, tryConnect);
  cachedUri = uri;
  registerShutdownHooksOnce();
  return client;
}

/** One MongoClient + pool per Node.js process (dev and production). */
function getClientPromise(): Promise<MongoClient> {
  if (global._mongoClientPromise) {
    return global._mongoClientPromise;
  }
  let pending!: Promise<MongoClient>;
  pending = connectClient().catch((err) => {
    if (global._mongoClientPromise === pending) {
      clearMongoClientCache();
    }
    throw err;
  });
  global._mongoClientPromise = pending;
  return pending;
}

/** Graceful shutdown — closes the shared client without dropping Atlas data. */
export async function closeMongoClient(): Promise<void> {
  const pending = global._mongoClientPromise;
  clearMongoClientCache();
  if (!pending) return;
  const client = await pending.catch(() => null);
  if (client) await client.close().catch(() => {});
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}

function describeConnectionMode(u: string): string {
  if (u.startsWith("mongodb+srv")) return "SRV (mongodb+srv)";
  if (u.includes("directConnection=true")) {
    const shard = u.match(/@([^/?]+)/)?.[1] ?? "shard";
    if (atlasDirectOnlyOnThisRuntime()) {
      return `direct (${shard}, Node ${nodeMajor()} Windows)`;
    }
    return process.env.MONGODB_DIRECT === "1"
      ? `direct (${shard}, MONGODB_DIRECT=1)`
      : `direct (${shard}, Windows)`;
  }
  if (u.includes("replicaSet=atlas-")) {
    const rs = u.match(/replicaSet=(atlas-[^&]+)/)?.[1] ?? "replica set";
    return `replica set (${rs})`;
  }
  return "standard replica set";
}

function mongoEnvSummary(): {
  dbUser?: string;
  clusterHost?: string;
  passwordLength?: number;
  usesStandardUri?: boolean;
  platform?: string;
  maxPoolSize?: number;
} {
  const usesStandardUri = Boolean(sanitizeEnvValue(process.env.MONGODB_URI_STANDARD));
  const raw = mongoUriFromProcessEnv();
  const base = { usesStandardUri, platform: process.platform, maxPoolSize: resolveMaxPoolSize() };
  if (!raw) return base;
  const normalized = normalizeMongoUri(raw) ?? raw;
  const parsed = parseSrvCredentials(normalized);
  if (parsed) {
    return {
      dbUser: parsed.user,
      clusterHost: parsed.host,
      passwordLength: parsed.pass.length,
      ...base,
    };
  }
  return base;
}

export type PingResult = {
  ok: boolean;
  message: string;
  nodeVersion?: string;
  hints?: string[];
  connectionMode?: string;
  dbUser?: string;
  clusterHost?: string;
  runtimeEnv?: string;
  passwordLength?: number;
  usesStandardUri?: boolean;
  platform?: string;
  connectorVersion?: string;
  mongodbDirectEnv?: string;
  maxPoolSize?: number;
};

/** Health check — reuses the shared client; does not open a second pool or close production connections. */
export async function pingDatabase(): Promise<PingResult> {
  const hints: string[] = [];
  const nodeVersion = process.version;
  const envSummary = mongoEnvSummary();
  const { dbUser, clusterHost, passwordLength, usesStandardUri, platform, maxPoolSize } = envSummary;
  const runtimeEnv = process.env.NODE_ENV ?? "unknown";
  const connectorVersion = ATLAS_CONNECTOR_VERSION;
  const mongodbDirectEnv = process.env.MONGODB_DIRECT ?? "(not set, direct shards enabled)";
  let connectionMode = "unknown";

  try {
    const client = await getClientPromise();
    if (cachedUri) {
      connectionMode = describeConnectionMode(cachedUri);
    } else {
      const srv = await normalizedSrvFromEnv();
      connectionMode = describeConnectionMode(srv);
    }
    await client.db(dbName).command({ ping: 1 });

    return {
      ok: true,
      message: `Connected to ${dbName}`,
      nodeVersion,
      connectionMode,
      dbUser,
      clusterHost,
      runtimeEnv,
      passwordLength,
      usesStandardUri,
      platform,
      connectorVersion,
      mongodbDirectEnv,
      maxPoolSize,
    };
  } catch (e) {
    clearMongoClientCache();
    const message = e instanceof Error ? e.message : "Connection failed";
    if (connectionMode === "unknown") {
      try {
        const srv = await normalizedSrvFromEnv();
        if (cachedUri) {
          connectionMode = describeConnectionMode(cachedUri);
        } else if (shouldTryDirectShards(srv)) {
          connectionMode = "direct shards tried, then SRV (all failed)";
        } else {
          connectionMode = describeConnectionMode(srv);
        }
      } catch {
        connectionMode = "could not build URI (check MONGODB_URI)";
      }
    }
    if (isTlsError(message)) {
      if (/SSL alert number 80|alert internal error/i.test(message)) {
        hints.push(
          "SSL alert 80 means Atlas closed TLS before login — usually your IP is not on the Atlas Network Access list, OR the free-tier connection limit is full (see Atlas Overview → Connections)."
        );
      }
      if (/connection.*limit|too many connections|blocked/i.test(message)) {
        hints.push(
          "Atlas M0 connection limit: set MONGODB_NODE_PROCESSES to the number of PM2 Node apps sharing this cluster, use one PM2 instance per app (fork mode), deploy this build, then pause/resume the cluster if needed."
        );
      }
      if (platform === "win32" && runtimeEnv === "development") {
        hints.push(
          "Fix on your PC: MongoDB Atlas → Network Access → Add IP Address → Add Current IP Address (or 0.0.0.0/0 for testing). Wait 1–2 minutes."
        );
        hints.push(
          "Atlas → Database → ensure the cluster is Running (not Paused). Then in the project folder run npm run check:mongo until it prints OK."
        );
        hints.push(
          "Restart dev after .env changes: stop the old server on port 3000, then npm run dev (use the port it prints)."
        );
        hints.push(
          "Optional: Atlas → Connect → Drivers → copy the Standard connection string into MONGODB_URI_STANDARD in .env.local."
        );
        if (nodeMajor() >= 24) {
          hints.push(
            "Optional on Windows: install Node 20 LTS (fnm-windows or nvm-windows) if your IP is already allowed and it still fails."
          );
        }
      } else {
        if (process.env.MONGODB_DIRECT === "0") {
          hints.push("Remove MONGODB_DIRECT=0 from production env — it disables direct shard connections.");
        }
        hints.push("Atlas → Network Access → add your server public IP (or 0.0.0.0/0 for testing).");
        hints.push(
          "On the KVM: set MONGODB_NODE_PROCESSES in .env.production.local, npm run check:mongo (must OK), pm2 restart excelpro --update-env (instances: 1, fork mode)."
        );
      }
    }
    if (/bad auth|Authentication failed|auth failed/i.test(message)) {
      hints.push(
        "On the KVM: SSH in, cd to the app folder, run npm run check:mongo — it must say OK using the same password length as local /test."
      );
      hints.push(
        "pm2/systemd often injects an OLD MONGODB_URI that overrides .env files. Run pm2 show your-app and remove duplicate env, then pm2 restart your-app --update-env."
      );
      hints.push(
        "Use one line, no quotes: MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.... Put it in .env.production.local or .env on the server (same folder as package.json), not only on your PC."
      );
      if (usesStandardUri) {
        hints.push("MONGODB_URI_STANDARD is set on this server — it overrides MONGODB_URI. Update or remove it.");
      }
    }
    if (message.includes("MONGODB_URI is not set")) {
      hints.push("Add MONGODB_URI to .env.local in the project root and restart the dev server.");
    }
    if (/not primary|read-only secondary/i.test(message)) {
      hints.push(
        "The app connected to a read-only Atlas secondary. Restart the dev server after updating — direct shard connections now skip non-primary hosts."
      );
      hints.push(
        "Optional: set MONGODB_URI_STANDARD to Atlas Connect → Drivers → Standard connection string (multi-host replica set)."
      );
    }
    return {
      ok: false,
      message,
      nodeVersion,
      hints,
      connectionMode,
      dbUser,
      clusterHost,
      runtimeEnv,
      passwordLength,
      usesStandardUri,
      platform,
      connectorVersion,
      mongodbDirectEnv,
      maxPoolSize,
    };
  }
}
