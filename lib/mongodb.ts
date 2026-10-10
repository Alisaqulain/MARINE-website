import dns from "node:dns";
import { MongoClient, ServerApiVersion, type Db, type MongoClientOptions } from "mongodb";

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
  try {
    const normalized = srvUri.replace(/^mongodb\+srv:/, "mongodb:");
    const url = new URL(normalized);
    if (!url.username || !url.password) return null;
    return {
      user: decodeURIComponent(url.username),
      pass: decodeURIComponent(url.password),
      host: url.hostname,
    };
  } catch {
    return null;
  }
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
      const standard = process.env.MONGODB_URI_STANDARD?.trim();
      if (standard) {
        cachedUri = normalizeMongoUri(standard)!;
        return cachedUri;
      }
      const srv = normalizeMongoUri(process.env.MONGODB_URI);
      if (!srv) throw new Error("MONGODB_URI is not set");

      const wantDirect =
        process.env.MONGODB_DIRECT === "1" ||
        (process.platform === "win32" && process.env.MONGODB_DIRECT !== "0");

      if (wantDirect && srv.startsWith("mongodb+srv://")) {
        cachedUri = await srvToDirectUri(srv);
        return cachedUri;
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
  if (u.includes("directConnection=true")) return "direct single-node (Windows / Node 24 TLS workaround)";
  return "standard replica set";
}

export type PingResult = {
  ok: boolean;
  message: string;
  nodeVersion?: string;
  hints?: string[];
  connectionMode?: string;
};

export async function pingDatabase(): Promise<PingResult> {
  const hints: string[] = [];
  const nodeVersion = process.version;
  let connectionMode = "unknown";

  try {
    if (process.env.NODE_ENV === "development") {
      global._mongoClientPromise = undefined;
      cachedUri = undefined;
      uriPromise = undefined;
    }
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
        "Atlas → Database Access → your DB user → Edit → Reset password. Update MONGODB_URI with the new password (no quotes). Wait 1 minute, restart npm run dev."
      );
      hints.push(
        "Confirm the username in the URI matches Atlas exactly (e.g. …_db_user), not your Atlas login email."
      );
    }
    if (message.includes("MONGODB_URI is not set")) {
      hints.push("Add MONGODB_URI to .env.local in the project root and restart the dev server.");
    }
    return { ok: false, message, nodeVersion, hints, connectionMode };
  }
}
