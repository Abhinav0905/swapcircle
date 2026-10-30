import { ZodError } from "zod";
import { AppError } from "../domain/errors";
import { ExchangeError } from "../exchange/ExchangeError";

export const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Vary": "Authorization",
} as const;

export interface SafeError { status: number; code: string; message: string }

/** Only explicitly classified application errors cross the HTTP boundary. */
export function safeError(error: unknown): SafeError {
  if (error instanceof ZodError) return { status: 400, code: "invalid_request", message: "Check the request fields and try again." };
  if (error instanceof AppError || error instanceof ExchangeError) {
    return { status: error.status, code: error.code, message: error.message };
  }
  // QlooError extends AppError and supplies a safe message. Never echo a
  // general Error, a fetch response body, request headers or a stack trace.
  return { status: 500, code: "server_error", message: "This request could not be completed. Please try again." };
}

export function jsonResponse(value: unknown, status = 200, headers: HeadersInit = {}): Response {
  const combined = new Headers(PRIVATE_HEADERS);
  combined.set("Content-Type", "application/json; charset=utf-8");
  new Headers(headers).forEach((value, key) => combined.set(key, value));
  return new Response(JSON.stringify(value), { status, headers: combined });
}

export function errorResponse(error: unknown): Response {
  const safe = safeError(error);
  return jsonResponse({ error: { code: safe.code, message: safe.message } }, safe.status,
    safe.status === 429 ? { "Retry-After": "60" } : {});
}

/** Browser requests must come from the same origin. Server clients omit Origin. */
export function assertRequestOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let sameOrigin = false;
  try { sameOrigin = new URL(origin).origin === new URL(request.url).origin && origin !== "null"; } catch { /* reject malformed origins */ }
  if (!sameOrigin) throw new AppError("This request came from another website.", 403, "invalid_origin");
}

export function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(header);
  if (!match) throw new AppError("Open this circle with your private invitation link.", 401, "unauthorized");
  return match[1].toLowerCase();
}

export function roomId(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError("This circle could not be found.", 404, "not_found");
  }
  return value;
}

/** Read a bounded stream; Content-Length is checked but is not trusted alone. */
export async function readLimitedJson(request: Request, maxBytes = 48_000): Promise<unknown> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") throw new AppError("Send a JSON request.", 415, "unsupported_media_type");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new AppError("This request is too large.", 413, "request_too_large");
  if (!request.body) throw new AppError("The request contains invalid JSON.", 400, "invalid_json");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError("This request is too large.", 413, "request_too_large");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new AppError("The request contains invalid JSON.", 400, "invalid_json"); }
}

export interface LimitStore { consumeLimit(key: string, limit: number, windowMs: number): Promise<void> }

/** D1-backed counters use a digest, never a stored IP address. */
export class RequestLimiter {
  constructor(private readonly store: LimitStore) {}

  async client(request: Request, scope: string, limit: number, windowMs: number): Promise<void> {
    // Cloudflare sets this header at ingress. Do not accept user-controlled
    // X-Forwarded-For as a way to evade a production limit.
    const address = request.headers.get("cf-connecting-ip") ?? "local-or-unknown";
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
    const digest = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
    await this.store.consumeLimit(`http:${scope}:${digest}`, limit, windowMs);
  }

  async global(scope: string, limit: number, windowMs: number): Promise<void> {
    await this.store.consumeLimit(`global:${scope}`, limit, windowMs);
  }
}
