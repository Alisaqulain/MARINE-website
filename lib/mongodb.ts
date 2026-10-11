import dns from "node:dns";
import { MongoClient, ServerApiVersion, type Db, type MongoClientOptions } from "mongodb";
import {
  ATLAS_CONNECTOR_VERSION,
  atlasDirectOnlyOnThisRuntime,
  clientOptionsForAtlas,
  connectWithAtlasStrategy,
  nodeMajor,
  shouldTryDirectShards,
} from "@/lib/atlas-connect";
import { mongoUriFromProcessEnv, parseMongoCredentials, sanitizeEnvValue } from "@/lib/env-mongo-uri";

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

async function connectionUri(): Promise<string> {
  if (cachedUri) return cachedUri;
  if (!uriPromise) {
    uriPromise = (async () => {
      const srv = await normalizedSrvFromEnv();
      cachedUri = srv;
      return cachedUri;
    })();
  }
  return uriPromise;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
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
  await client.connect();
  return client;
}

async function connectClient(): Promise<MongoClient> {
  const srv = await normalizedSrvFromEnv();
  try {
    const { client, uri } = await connectWithAtlasStrategy(srv, tryConnect);
    cachedUri = uri;
    return client;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      global._mongoClientPromise = undefined;
    }
    cachedUri = undefined;
    uriPromise = undefined;
    throw err instanceof Error ? err : new Error("Connection failed");
  }
}

function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = connectClient();
    }
    return global._mongoClientPromise;
  }
  return connectClient();
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
  return "standard replica set";
}

function mongoEnvSummary(): {
  dbUser?: string;
  clusterHost?: string;
  passwordLength?: number;
  usesStandardUri?: boolean;
  platform?: string;
} {
  const usesStandardUri = Boolean(sanitizeEnvValue(process.env.MONGODB_URI_STANDARD));
  const raw = mongoUriFromProcessEnv();
  if (!raw) return { usesStandardUri, platform: process.platform };
  const normalized = normalizeMongoUri(raw) ?? raw;
  const parsed = parseSrvCredentials(normalized);
  if (parsed) {
    return {
      dbUser: parsed.user,
      clusterHost: parsed.host,
      passwordLength: parsed.pass.length,
      usesStandardUri,
      platform: process.platform,
    };
  }
  return { usesStandardUri, platform: process.platform };
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
};

export async function pingDatabase(): Promise<PingResult> {
  const hints: string[] = [];
  const nodeVersion = process.version;
  const envSummary = mongoEnvSummary();
  const { dbUser, clusterHost, passwordLength, usesStandardUri, platform } = envSummary;
  const runtimeEnv = process.env.NODE_ENV ?? "unknown";
  const connectorVersion = ATLAS_CONNECTOR_VERSION;
  const mongodbDirectEnv = process.env.MONGODB_DIRECT ?? "(not set, direct shards enabled)";
  let connectionMode = "unknown";

  try {
    global._mongoClientPromise = undefined;
    cachedUri = undefined;
    uriPromise = undefined;
    const client = await connectClient();
    connectionMode = describeConnectionMode(cachedUri ?? (await connectionUri()));
    await client.db(dbName).command({ ping: 1 });

    if (process.env.NODE_ENV === "development") {
      global._mongoClientPromise = Promise.resolve(client);
    } else {
      await client.close();
    }

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
    };
  } catch (e) {
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
      if (connectionMode.startsWith("SRV") || connectionMode.includes("then SRV")) {
        hints.push(
          `/test must show Connector: ${ATLAS_CONNECTOR_VERSION}. If you still see old Windows/Node 24 hints, the server is running an OLD build — git pull, npm run build, pm2 restart.`
        );
      }
      if (process.env.MONGODB_DIRECT === "0") {
        hints.push("Remove MONGODB_DIRECT=0 from production env — it disables direct shard connections.");
      }
      hints.push(
        "Deploy the latest app build — production must try direct Atlas shard hosts before mongodb+srv."
      );
      hints.push(
        "Atlas → Network Access → add your KVM public IP (or 0.0.0.0/0 for testing). SSL alert 80 often means IP not allowed."
      );
      hints.push("On the server: npm run check:mongo (must OK), then pm2 restart excelpro --update-env.");
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
    };
  }
}
