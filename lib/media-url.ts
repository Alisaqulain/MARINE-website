/** Turn stored product image paths into a browser-loadable URL. */
export function resolveMediaUrl(src: string | undefined | null): string {
  if (!src) return "";
  let path = src.trim();
  if (!path) return "";

  if (path.includes("/files/")) {
    const name = path.split("/files/").pop()?.split("?")[0];
    if (name) path = `/api/media/${name}`;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (path.startsWith("/api/media/") || path.startsWith("/uploads/") || path.startsWith("/")) {
    if (typeof window !== "undefined") return `${window.location.origin}${path}`;
    const base =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      process.env.AUTH_URL?.replace(/\/$/, "") ||
      process.env.NEXTAUTH_URL?.replace(/\/$/, "");
    return base ? `${base}${path}` : path;
  }

  return `/api/media/${path.replace(/^\//, "")}`;
}

export function isUploadedMedia(src: string): boolean {
  return (
    src.startsWith("http") ||
    src.startsWith("/uploads/") ||
    src.startsWith("/api/media/")
  );
}
