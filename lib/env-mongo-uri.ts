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
