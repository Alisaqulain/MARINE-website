import dns from "node:dns";
import { MongoClient, type MongoClientOptions } from "mongodb";
import { parseMongoCredentials } from "@/lib/env-mongo-uri";
import { resolveMaxPoolSize } from "@/lib/mongodb-pool";

/** Bump when deploy verification is needed — shown on /test */
export const ATLAS_CONNECTOR_VERSION = "direct-shards-v6";

export function nodeMajor(): number {
  const m = /^v(\d+)/.exec(process.version);
  return m ? Number(m[1]) : 0;
}

/** Node 24 + Windows: mongodb+srv TLS is broken; prefer direct / replica-set URIs. */
export function atlasDirectOnlyOnThisRuntime(): boolean {
  if (process.env.MONGODB_SKIP_SRV_FALLBACK === "1") return true;
  if (process.env.MONGODB_SKIP_SRV_FALLBACK === "0") return false;
  return process.platform === "win32" && nodeMajor() >= 24;
}

function replicaSetNameFromShardHost(shardHost: string): string | null {
  const m = /^ac-([a-z0-9]+)-shard-00-\d+\./i.exec(shardHost);
  if (!m) return null;
  return `atlas-${m[1]}-shard-0`;
}

/** Atlas publishes replicaSet / authSource on the cluster TXT record. */
export async function atlasSrvTxtParams(clusterHost: string): Promise<Record<string, string>> {
  try {
    const chunks = await dns.promises.resolveTxt(`_mongodb._tcp.${clusterHost}`);
    const merged = chunks.map((part) => part.join("")).join("&");
    return Object.fromEntries(new URLSearchParams(merged));
  } catch {
    return {};
  }
}

/** Multi-host replica set URI (no directConnection) — works when single-shard direct TLS fails. */
export async function replicaSetUriFromSrv(srvUri: string): Promise<string | null> {
  const parsed = parseMongoCredentials(srvUri);
  if (!parsed) return null;
  const records = await dns.promises.resolveSrv(`_mongodb._tcp.${parsed.host}`);
  if (!records.length) return null;
  const txt = await atlasSrvTxtParams(parsed.host);
  const replicaSet =
    txt.replicaSet ?? replicaSetNameFromShardHost(records[0].name);
  if (!replicaSet) return null;
  const auth = `${encodeURIComponent(parsed.user)}:${encodeURIComponent(parsed.pass)}`;
  const hosts = records.map((r) => `${r.name}:${r.port}`).join(",");
  const url = new URL(srvUri.replace(/^mongodb\+srv:/, "mongodb:"));
  const dbPath = url.pathname && url.pathname !== "/" ? url.pathname : "";
  const authSource = txt.authSource ?? "admin";
  const qs = `tls=true&authSource=${encodeURIComponent(authSource)}&replicaSet=${encodeURIComponent(replicaSet)}&retryWrites=true&w=majority`;
  return `mongodb://${auth}@${hosts}${dbPath}?${qs}`;
}

/** Direct shard URIs fix srv TLS on Windows Node 24 and many Linux VPS hosts (SSL alert 80). */
export function shouldTryDirectShards(srvUri: string): boolean {
  if (!srvUri.startsWith("mongodb+srv://")) return false;
  if (process.env.MONGODB_SRV_ONLY === "1") return false;
  // MONGODB_DIRECT=0 only disables direct on Windows; on Linux VPS, srv-only often fails — still try shards.
  if (process.env.MONGODB_DIRECT === "0" && process.platform === "win32") return false;
  return true;
}

function shardSortKey(host: string): number {
  if (host.includes("shard-00-01")) return 0;
  if (host.includes("shard-00-00")) return 1;
  if (host.includes("shard-00-02")) return 2;
  return 3;
}

export async function directUrisFromSrv(srvUri: string): Promise<string[]> {
  const parsed = parseMongoCredentials(srvUri);
  if (!parsed) return [];
  const records = await dns.promises.resolveSrv(`_mongodb._tcp.${parsed.host}`);
  if (!records.length) throw new Error("MongoDB SRV lookup returned no hosts");
  const auth = `${encodeURIComponent(parsed.user)}:${encodeURIComponent(parsed.pass)}`;
  const qs = "ssl=true&authSource=admin&directConnection=true&retryWrites=true&w=majority";
  const sorted = [...records].sort((a, b) => shardSortKey(a.name) - shardSortKey(b.name));
  return sorted.map((r) => `mongodb://${auth}@${r.name}:27017/?${qs}`);
}

export function clientOptionsForAtlas(): MongoClientOptions {
  const autoSelectFamily =
    process.env.MONGODB_AUTO_SELECT_FAMILY === "1"
      ? true
      : process.env.MONGODB_AUTO_SELECT_FAMILY === "0"
        ? false
        : process.platform === "win32"
          ? false
          : undefined;

  const maxPoolSize = resolveMaxPoolSize();

  const opts: MongoClientOptions = {
    connectTimeoutMS: 20_000,
    serverSelectionTimeoutMS: 15_000,
    maxPoolSize,
    minPoolSize: 0,
    maxIdleTimeMS: 60_000,
    ...(autoSelectFamily !== undefined ? { autoSelectFamily } : {}),
  };

  const forceIpv4 =
    process.platform === "win32" ||
    process.env.MONGODB_FORCE_IPV4 === "1" ||
    process.env.MONGODB_PREFER_IPV4 === "1";
  if (forceIpv4) {
    (opts as MongoClientOptions & { family?: number }).family = 4;
  }

  return opts;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoPreferredDirectUri: string | undefined;
}

export async function connectWithAtlasStrategy(
  srvUri: string,
  tryConnect: (uri: string) => Promise<MongoClient>
): Promise<{ client: MongoClient; uri: string }> {
  let lastError: unknown;
  const directOnly = atlasDirectOnlyOnThisRuntime();

  if (shouldTryDirectShards(srvUri)) {
    const directUris = await directUrisFromSrv(srvUri);
    const preferred = global._mongoPreferredDirectUri;
    const ordered = preferred
      ? [preferred, ...directUris.filter((u) => u !== preferred)]
      : directUris;

    for (const u of ordered) {
      try {
        const client = await tryConnect(u);
        global._mongoPreferredDirectUri = u;
        return { client, uri: u };
      } catch (err) {
        lastError = err;
      }
    }

    try {
      const replicaUri = await replicaSetUriFromSrv(srvUri);
      if (replicaUri) {
        const client = await tryConnect(replicaUri);
        return { client, uri: replicaUri };
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!directOnly) {
    try {
      const client = await tryConnect(srvUri);
      return { client, uri: srvUri };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Could not connect to MongoDB Atlas");
}
