/** Strip quotes/BOM and common .env typos (e.g. VAR==value). */
export function sanitizeEnvValue(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  let v = value.trim();
  if (v.charCodeAt(0) === 0xfeff) v = v.slice(1).trim();
  while (v.startsWith("=")) v = v.slice(1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1).trim();
  }
  return v || undefined;
}

export function mongoUriFromProcessEnv(): string | undefined {
  const standard = sanitizeEnvValue(process.env.MONGODB_URI_STANDARD);
  if (standard) return standard;
  return sanitizeEnvValue(process.env.MONGODB_URI);
}

const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Host names in a mongodb:// or mongodb+srv:// URI, lower-cased, without ports or credentials. */
export function mongoUriHosts(uri: string): string[] {
  const rest = uri.trim().replace(/^mongodb(\+srv)?:\/\//i, "");
  const query = rest.indexOf("?");
  const beforeQuery = query === -1 ? rest : rest.slice(0, query);
  const hostList = beforeQuery.slice(beforeQuery.lastIndexOf("@") + 1).split("/")[0];
  return hostList
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/:\d+$/, ""))
    .filter(Boolean);
}

/**
 * Outside production, only a database on this machine (or a host listed in
 * MONGODB_DEV_ALLOWED_HOSTS) may be used, so development can never reach the live database.
 * Returns why the URI is refused, or null when it is allowed. Never includes the URI.
 */
export function devDatabaseBlockReason(uri: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.NODE_ENV === "production") return null;
  const allowed = new Set(
    (env.MONGODB_DEV_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean)
  );
  const hosts = mongoUriHosts(uri);
  if (!hosts.length) return "the database host in MONGODB_URI could not be read";
  const remote = hosts.filter((h) => !LOCAL_DB_HOSTS.has(h) && !allowed.has(h));
  if (!remote.length) return null;
  return "development may only use a local test database, but MONGODB_URI points to a remote host. Use the local test database (npm run dev:db) or list a dedicated development host in MONGODB_DEV_ALLOWED_HOSTS.";
}

export function parseMongoCredentials(uri: string) {
  try {
    const normalized = uri.replace(/^mongodb\+srv:/, "mongodb:");
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
