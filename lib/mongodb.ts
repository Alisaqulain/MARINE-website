import dns from "node:dns";
import { MongoClient, ServerApiVersion, type Db, type MongoClientOptions } from "mongodb";
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

/** Windows + Node 24 often breaks mongodb+srv TLS; direct to first SRV host works. */
async function srvToDirectUri(srvUri: string): Promise<string> {
  const parsed = parseSrvCredentials(srvUri);
  if (!parsed) return srvUri;
  const records = await dns.promises.resolveSrv(`_mongodb._tcp.${parsed.host}`);
  const first = records[0]?.name;
  if (!first) throw new Error("MongoDB SRV lookup returned no hosts");
  const auth = `${encodeURIComponent(parsed.user)}:${encodeURIComponent(parsed.pass)}`;
  return `mongodb://${auth}@${first}:27017/?ssl=true&authSource=admin&directConnection=true&retryWrites=true&w=majority`;
}

let cachedUri: string | undefined;
let uriPromise: Promise<string> | undefined;

async function connectionUri(): Promise<string> {
  if (cachedUri) return cachedUri;
  if (!uriPromise) {
    uriPromise = (async () => {
      const fromEnv = mongoUriFromProcessEnv();
      if (!fromEnv) throw new Error("MONGODB_URI is not set");
      const srv = normalizeMongoUri(fromEnv);
      if (!srv) throw new Error("MONGODB_URI is not set");

      const wantDirect =
        process.env.MONGODB_DIRECT === "1" ||
        (process.platform === "win32" && process.env.MONGODB_DIRECT !== "0");

      if (wantDirect && srv.startsWith("mongodb+srv://")) {
        try {
          cachedUri = await srvToDirectUri(srv);
          return cachedUri;
        } catch {
          cachedUri = srv;
          return cachedUri;
        }
      }
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
    serverSelectionTimeoutMS: 20_000,
    maxPoolSize: 10,
    ...(autoSelectFamily !== undefined ? { autoSelectFamily } : {}),
  };
  if (process.env.MONGODB_SERVER_API !== "0") {
    opts.serverApi = {
      version: ServerApiVersion.v1,
      strict: false,
      deprecationErrors: false,
    };
  }
  return opts;
}

async function connectClient(): Promise<MongoClient> {
  const u = await connectionUri();
  const client = new MongoClient(u, clientOptions());
  return client.connect().catch((err) => {
    if (process.env.NODE_ENV === "development") {
      global._mongoClientPromise = undefined;
    }
    cachedUri = undefined;
    uriPromise = undefined;
    return Promise.reject(err);
  });
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
    return process.env.MONGODB_DIRECT === "1"
      ? "direct single-node (MONGODB_DIRECT=1)"
      : "direct single-node (Windows TLS workaround)";
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
};

export async function pingDatabase(): Promise<PingResult> {
  const hints: string[] = [];
  const nodeVersion = process.version;
  const envSummary = mongoEnvSummary();
  const { dbUser, clusterHost, passwordLength, usesStandardUri, platform } = envSummary;
  const runtimeEnv = process.env.NODE_ENV ?? "unknown";
  let connectionMode = "unknown";

  try {
    global._mongoClientPromise = undefined;
    cachedUri = undefined;
    uriPromise = undefined;
    const u = await connectionUri();
    connectionMode = describeConnectionMode(u);

    const client = await connectClient();
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
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Connection failed";
    if (connectionMode === "unknown") {
      try {
        connectionMode = describeConnectionMode(await connectionUri());
      } catch {
        connectionMode = "could not build URI (check MONGODB_URI)";
      }
    }
    if (message.includes("SSL") || message.includes("tls") || message.includes("alert internal")) {
      hints.push(
        "Restart the dev server after changing .env.local. On Windows, MONGODB_DIRECT=1 should be set (auto unless MONGODB_DIRECT=0)."
      );
      hints.push(
        "MongoDB Atlas → Network Access → Add IP Address → Allow access from anywhere (0.0.0.0/0), wait 2 minutes."
      );
      hints.push(
        "Node 24 often breaks mongodb+srv TLS on Windows — use Node 20 LTS (https://nodejs.org/en/download) or keep MONGODB_DIRECT=1."
      );
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
    };
  }
}
