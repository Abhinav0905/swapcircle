import { QlooError } from "./QlooError";

export interface QlooConfig {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const ALLOWED_ORIGINS = new Set([
  "https://hackathon.api.qloo.com",
  "https://api.qloo.com",
]);
const MAX_RESPONSE_BYTES = 1_048_576;
const MAX_PENDING_REQUESTS = 16;
const REQUEST_SPACING_MS = 260;
const MAX_RETRY_DELAY_MS = 2_000;

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** A bounded GET transport. A redirect can never carry the key to another host. */
export class QlooTransport {
  readonly origin: string;
  #apiKey: string;
  #fetch: typeof fetch;
  #timeoutMs: number;
  #nextRequestAt = 0;
  #pendingRequests = 0;

  constructor(config: QlooConfig) {
    let base: URL;
    try {
      base = new URL(config.baseUrl ?? "https://hackathon.api.qloo.com");
    } catch {
      throw new QlooError("Choose an official Qloo API origin.", "qloo_configuration", 503);
    }
    if (!ALLOWED_ORIGINS.has(base.origin) || base.pathname !== "/" || base.search || base.hash || base.username || base.password) {
      throw new QlooError("Choose an official Qloo API origin.", "qloo_configuration", 503);
    }
    if (typeof config.apiKey !== "string" || !config.apiKey.trim() || config.apiKey.length > 512 || /\s/.test(config.apiKey)) {
      throw new QlooError("The Qloo API key is not configured.", "qloo_configuration", 503);
    }
    const timeoutMs = config.timeoutMs ?? 10_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 5 || timeoutMs > 20_000) {
      throw new QlooError("The Qloo timeout must be between 5 and 20000 milliseconds.", "qloo_configuration", 503);
    }
    this.origin = base.origin;
    this.#apiKey = config.apiKey;
    this.#fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.#timeoutMs = timeoutMs;
  }

  /** Used only for documented provider warning text, never for upstream errors. */
  sanitizeWarning(value: string): string {
    return value
      .split(this.#apiKey).join("[redacted]")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .trim()
      .slice(0, 400);
  }

  async get(endpoint: "/search" | "/v2/insights", parameters: Record<string, string>): Promise<unknown> {
    if (this.#pendingRequests >= MAX_PENDING_REQUESTS) {
      throw new QlooError("Qloo is busy with this room. Try again shortly.", "qloo_busy", 503);
    }
    this.#pendingRequests += 1;
    try {
      const url = new URL(endpoint, this.origin);
      url.search = new URLSearchParams(parameters).toString();
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await this.waitForRequestSlot();
        const result = await this.attempt(url);
        if (result.status === 404 && endpoint === "/search") return { success: true, results: [] };
        if (result.status >= 200 && result.status < 300) return result.payload;
        if (attempt === 0 && (result.status === 429 || result.status >= 500)) {
          await delay(this.retryDelay(result.retryAfter));
          continue;
        }
        throw this.statusError(result.status);
      }
      throw new QlooError("Qloo could not complete this request.", "qloo_unavailable", 503);
    } finally {
      this.#pendingRequests -= 1;
    }
  }

  private async waitForRequestSlot(): Promise<void> {
    const now = Date.now();
    const scheduledAt = Math.max(now, this.#nextRequestAt);
    this.#nextRequestAt = scheduledAt + REQUEST_SPACING_MS;
    if (scheduledAt > now) await delay(scheduledAt - now);
  }

  private async attempt(url: URL): Promise<{ status: number; payload?: unknown; retryAfter: string | null }> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new QlooError("Qloo took too long to respond. Try again.", "qloo_timeout", 504));
      }, this.#timeoutMs);
    });
    try {
      return await Promise.race([
        (async () => {
          const response = await this.#fetch(url, {
            method: "GET",
            headers: { Accept: "application/json", "X-Api-Key": this.#apiKey },
            signal: controller.signal,
            redirect: "error",
            credentials: "omit",
            cache: "no-store",
          });
          if (!response.ok) {
            // Deliberately ignore upstream error text. It can contain request details.
            void response.body?.cancel().catch(() => undefined);
            return { status: response.status, retryAfter: response.headers.get("retry-after") };
          }
          const payload = await this.readJson(response);
          return { status: response.status, payload, retryAfter: null };
        })(),
        expired,
      ]);
    } catch (error) {
      if (error instanceof QlooError) throw error;
      throw new QlooError("Could not reach Qloo. Try again shortly.", "qloo_network", 503);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    const declaredLength = Number(response.headers.get("content-length"));
    if (declaredLength > MAX_RESPONSE_BYTES) {
      void response.body?.cancel().catch(() => undefined);
      throw new QlooError("Qloo returned a response that is too large.", "qloo_response_limit");
    }
    if (!response.body) throw new QlooError("Qloo returned an empty response.", "qloo_invalid_response");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedBytes = 0;
    let text = "";
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        receivedBytes += chunk.value.byteLength;
        if (receivedBytes > MAX_RESPONSE_BYTES) {
          void reader.cancel().catch(() => undefined);
          throw new QlooError("Qloo returned a response that is too large.", "qloo_response_limit");
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new QlooError("Qloo returned an unreadable response.", "qloo_invalid_response");
      }
    } finally {
      reader.releaseLock();
    }
  }

  private retryDelay(header: string | null): number {
    if (!header) return 350;
    const seconds = Number(header);
    const duration = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(header) - Date.now();
    return Number.isFinite(duration) ? Math.max(0, Math.min(MAX_RETRY_DELAY_MS, duration)) : 350;
  }

  private statusError(status: number): QlooError {
    if (status === 401 || status === 403) {
      return new QlooError("Qloo did not accept the configured key. The host needs to check API access.", "qloo_auth", 503);
    }
    if (status === 429) return new QlooError("Qloo's request allowance is busy. Try again later.", "qloo_rate_limit", 503);
    return new QlooError("Qloo could not complete this request. No sample results were substituted.", "qloo_upstream", 502);
  }
}
