/** Allowed browser Origins for credentialed API calls. */
export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const configured = [
    process.env.APP_URL?.trim(),
    ...(process.env.CORS_ORIGIN ?? "").split(",").map((value) => value.trim()),
  ].filter(Boolean);

  if (configured.some((value) => value === origin)) return true;

  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_CORS === "true";
    }
  } catch {
    return false;
  }
  return false;
}

/** Non-browser callers (cron, health, same-origin without Origin) have no Origin header. */
export function corsAllowsRequest(origin: string | undefined): boolean {
  if (!origin) return true;
  return isAllowedCorsOrigin(origin);
}
