import { AppError } from "../domain/errors";
import { errorResponse } from "./HttpBoundary";

type RequestHandler = (request: Request) => Response | Promise<Response>;

/** Consume bounded API input before framework or authorization checks can return early. */
export class RequestBodyBoundary {
  constructor(
    private readonly maxBytes = 48_000,
    private readonly timeoutMs = 5_000,
  ) {
    if (!Number.isInteger(maxBytes) || maxBytes < 1 || !Number.isInteger(timeoutMs) || timeoutMs < 1) {
      throw new Error("Request body limits must be positive integers.");
    }
  }

  async handle(request: Request, next: RequestHandler): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if ((!pathname.startsWith("/api/") && pathname !== "/api") || !request.body) return next(request);

    let buffered: Request;
    try {
      // Prebuilt no_bundle Workers omit Wrangler's body-draining middleware.
      // An early response with unread input can break the next proxied request:
      // https://github.com/cloudflare/workers-sdk/issues/15203
      // Read the original stream, not a clone, and keep both size and time bounded.
      const body = await this.readBody(request.body);
      buffered = new Request(request, { body });
    } catch (error) {
      return errorResponse(error instanceof AppError ? error
        : new AppError("The request body could not be read.", 400, "invalid_body"));
    }
    // Framework failures retain their existing handling. Never repeat dispatch.
    return next(buffered);
  }

  private async readBody(body: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
    const reader = body.getReader();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new AppError("The request body took too long to arrive.", 408, "request_timeout")), this.timeoutMs);
    });
    const consume = async (): Promise<ArrayBuffer> => {
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (stopped) throw new AppError("The request body could not be read.", 400, "invalid_body");
        if (done) break;
        size += value.byteLength;
        if (size > this.maxBytes) throw new AppError("This request is too large.", 413, "request_too_large");
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return bytes.buffer;
    };

    try {
      return await Promise.race([consume(), deadline]);
    } catch (error) {
      stopped = true;
      // Cancellation is best effort: a broken source may never settle its cancel
      // promise. Trigger it, handle rejection, then release without waiting on it.
      try { void reader.cancel().catch(() => {}); } catch { /* The source already failed. */ }
      throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      try { reader.releaseLock(); } catch { /* Preserve the classified body failure. */ }
    }
  }
}
