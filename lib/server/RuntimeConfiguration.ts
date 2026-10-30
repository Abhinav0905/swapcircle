export interface RuntimeConfiguration { apiKey: string; baseUrl: string; qlooConfigured: boolean }

/** Explicit Worker secrets take precedence; process values are local-dev only. */
export function readRuntimeConfiguration(
  worker: Record<string, unknown>,
  local: Record<string, string | undefined> = {},
): RuntimeConfiguration {
  const localAllowed = local.NODE_ENV !== "production";
  const read = (name: string) => typeof worker[name] === "string" ? worker[name] as string : localAllowed ? local[name] ?? "" : "";
  const apiKey = read("QLOO_API_KEY");
  const baseUrl = read("QLOO_BASE_URL") || "https://hackathon.api.qloo.com";
  let validOrigin = false;
  try {
    const url = new URL(baseUrl);
    validOrigin = ["https://hackathon.api.qloo.com", "https://api.qloo.com"].includes(url.origin) &&
      url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;
  } catch { /* Invalid setup is reported as not configured, without the value. */ }
  return { apiKey, baseUrl, qlooConfigured: validOrigin && apiKey.length > 0 && apiKey.length <= 512 && !/\s/.test(apiKey) };
}
