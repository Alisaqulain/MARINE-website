import dns from "node:dns";
import { MongoClient, type MongoClientOptions } from "mongodb";
import { parseMongoCredentials } from "@/lib/env-mongo-uri";

/** Bump when deploy verification is needed — shown on /test */
export const ATLAS_CONNECTOR_VERSION = "direct-shards-v2";

export function nodeMajor(): number {
  const m = /^v(\d+)/.exec(process.version);
  return m ? Number(m[1]) : 0;
}

/** Node 24 + Windows: mongodb+srv TLS is broken; only direct shard URIs work. */
export function atlasDirectOnlyOnThisRuntime(): boolean {
  if (process.env.MONGODB_SKIP_SRV_FALLBACK === "1") return true;
  if (process.env.MONGODB_SKIP_SRV_FALLBACK === "0") return false;
  return process.platform === "win32" && nodeMajor() >= 24;
}

/** Direct shard URIs fix srv TLS issues on Windows Node 24 and many Linux VPS hosts. */
export function shouldTryDirectShards(srvUri: string): boolean {
  if (process.env.MONGODB_DIRECT === "0") return false;
  return srvUri.startsWith("mongodb+srv://");
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

  const opts: MongoClientOptions = {
    connectTimeoutMS: 20_000,
    serverSelectionTimeoutMS: 15_000,
    maxPoolSize: 10,
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
