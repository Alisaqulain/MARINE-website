/** Normalized KVM upload base URL, or null to use local public/uploads. */
export function getKvmUploadBase(): string | null {
  let raw = process.env.KVM2_UPLOAD_URL?.trim();
  if (!raw) return null;
  // Common .env typo: KVM2_UPLOAD_URL==https://...
  while (raw.startsWith("=")) raw = raw.slice(1).trim();
  if (!raw || raw.includes("your-server") || raw.includes("your-kvm")) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return null;
  }
}

export function getKvmUploadToken(): string | undefined {
  const t = process.env.KVM2_UPLOAD_TOKEN?.trim();
  return t && t !== "optional" ? t : undefined;
}

/** Skip remote KVM POST (avoids SSL loop when app and KVM URL are the same host). */
export function kvmRemoteUploadEnabled(): boolean {
  if (process.env.KVM2_UPLOAD_SKIP === "1" || process.env.KVM2_UPLOAD_SKIP === "true") return false;
  return Boolean(getKvmUploadBase());
}

export function sameOriginAsKvm(requestOrigin: string | null, kvmBase: string | null): boolean {
  if (!requestOrigin || !kvmBase) return false;
  try {
    return new URL(requestOrigin).origin === new URL(kvmBase).origin;
  } catch {
    return false;
  }
}
