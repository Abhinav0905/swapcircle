import { z } from "zod";
import { ExchangeAgent } from "../agent/ExchangeAgent";
import { AppError } from "../domain/errors";
import type { ExchangeRoom, TasteProvider } from "../domain/types";
import { PreferenceGraphBuilder } from "../exchange/PreferenceGraphBuilder";
import type { RoomOperations } from "./ApiHandlers";
import { assertRequestOrigin, bearerToken, jsonResponse, PRIVATE_HEADERS, readLimitedJson, RequestLimiter, safeError } from "./HttpBoundary";

const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
const idSchema = z.union([z.string().max(200), z.number().finite()]);
const messageSchema = z.object({
  jsonrpc: z.literal("2.0"), id: idSchema.optional(), method: z.string().min(1).max(100),
  params: z.record(z.unknown()).optional(),
}).strict();
const circleArguments = z.object({ roomId: z.string().uuid() }).strict();
const matchArguments = circleArguments.extend({
  memberId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  bookId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
}).strict();
type RpcId = string | number | null;

const circleSchema = {
  type: "object", properties: { roomId: { type: "string", format: "uuid", description: "The circle ID from its private link." } },
  required: ["roomId"], additionalProperties: false,
};
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const MCP_TOOLS = [
  {
    name: "inspect_circle", title: "Inspect an exchange circle",
    description: "Read the authenticated circle's members, available books, source-labeled taste evidence, choices and exact approvals. Requires its private capability in the HTTP Authorization header. Never grants consent.",
    inputSchema: circleSchema, annotations,
  },
  {
    name: "suggest_next_question", title: "Find the next useful reading question",
    description: "Find one unreviewed book, backed by existing taste evidence, whose acceptance could enable another exchange. This does not answer the question or update the circle.",
    inputSchema: circleSchema, annotations,
  },
  {
    name: "explain_match", title: "Inspect evidence for a reader and book",
    description: "Show the existing Qloo or fixture rank, requested cultural favorites, missing-evidence status and the reader's own choice for one available book. Affinity is not personal consent or a probability of enjoyment.",
    inputSchema: {
      type: "object", properties: {
        ...circleSchema.properties,
        memberId: { type: "string", minLength: 1, maxLength: 80 },
        bookId: { type: "string", minLength: 1, maxLength: 80 },
      }, required: ["roomId", "memberId", "bookId"], additionalProperties: false,
    }, annotations,
  },
  {
    name: "plan_exchanges", title: "Preview feasible exchanges",
    description: "Compute a read-only exchange preview from recorded reading choices and existing taste evidence. Preserves fully approved circles. Does not fetch Qloo, persist a plan, approve a trade or contact anyone.",
    inputSchema: circleSchema, annotations,
  },
] as const;

/** Stateless Streamable HTTP MCP. It only returns JSON and never holds SSE open. */
export class McpServer {
  constructor(private readonly rooms: Pick<RoomOperations, "read">, private readonly limiter: RequestLimiter) {}

  async post(request: Request): Promise<Response> {
    let id: RpcId = null;
    try {
      assertRequestOrigin(request);
      this.checkProtocolHeader(request);
      const accept = request.headers.get("accept") ?? "";
      if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
        throw new AppError("MCP clients must accept application/json and text/event-stream.", 406, "unsupported_accept");
      }
      await this.limiter.client(request, "mcp", 120, 60_000);
      let raw: unknown;
      try { raw = await readLimitedJson(request); }
      catch (error) {
        if (error instanceof AppError && error.code === "invalid_json") return this.failure(null, -32700, "Invalid JSON.", 400);
        throw error;
      }
      const parsed = messageSchema.safeParse(raw);
      if (!parsed.success) return this.failure(null, -32600, "Send one valid JSON-RPC request or notification.", 400);
      const message = parsed.data;
      id = message.id ?? null;

      if (message.id === undefined) {
        // No requests or writes are performed for a notification. The protocol
        // acknowledges initialized/cancelled notifications with an empty 202.
        if (!message.method.startsWith("notifications/")) return this.failure(null, -32600, "Requests need an ID.", 400);
        return new Response(null, { status: 202, headers: PRIVATE_HEADERS });
      }
      if (message.method === "initialize") {
        const init = z.object({
          protocolVersion: z.string().max(30), capabilities: z.record(z.unknown()),
          clientInfo: z.object({ name: z.string().max(200), version: z.string().max(100) }).passthrough(),
        }).passthrough().safeParse(message.params);
        if (!init.success) return this.failure(id, -32602, "Initialize needs protocolVersion, capabilities and clientInfo.");
        const version = PROTOCOLS.find((value) => value === init.data.protocolVersion) ?? PROTOCOLS[0];
        return this.success(id, {
          protocolVersion: version, capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "SwapCircle", version: "1.0.0" },
          instructions: "Tools read only. Send Authorization: Bearer <private room capability> for tools/call. Tool outputs distinguish Qloo evidence, fixture scenarios, reading choices and exchange approval. Never treat a suggestion as consent.",
        });
      }
      if (message.method === "ping") return this.success(id, {});
      if (message.method === "tools/list") {
        if (message.params?.cursor) return this.failure(id, -32602, "This tool list has no additional pages.");
        return this.success(id, { tools: MCP_TOOLS });
      }
      if (message.method !== "tools/call") return this.failure(id, -32601, "This method is not supported.");
      const call = z.object({ name: z.string(), arguments: z.record(z.unknown()).optional(), _meta: z.record(z.unknown()).optional() }).strict().safeParse(message.params);
      if (!call.success) return this.failure(id, -32602, "A tool call needs a name and an arguments object.");
      if (!MCP_TOOLS.some((tool) => tool.name === call.data.name)) return this.failure(id, -32602, "This tool is not available.");
      const token = bearerToken(request);
      try {
        const args = (call.data.name === "explain_match" ? matchArguments : circleArguments).parse(call.data.arguments ?? {});
        const session = await this.rooms.read(args.roomId, token);
        const result = this.execute(call.data.name, structuredClone(session.room), args);
        const structuredContent = { roomId: session.room.id, revision: session.room.revision, mode: session.room.mode, readOnly: true, ...result };
        return this.success(id, { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent, isError: false });
      } catch (error) {
        const safe = safeError(error);
        if (safe.status === 401 || safe.status === 403) throw error;
        return this.success(id, { content: [{ type: "text", text: safe.message }], isError: true });
      }
    } catch (error) {
      const safe = safeError(error);
      return this.failure(id, safe.status === 401 ? -32001 : -32000, safe.message, safe.status);
    }
  }

  get(request: Request): Response {
    try {
      assertRequestOrigin(request);
      this.checkProtocolHeader(request);
      return jsonResponse({ error: { code: "method_not_allowed", message: "This MCP server uses JSON POST responses and does not offer an SSE stream." } }, 405, { Allow: "POST" });
    } catch (error) {
      const safe = safeError(error);
      return this.failure(null, -32000, safe.message, safe.status);
    }
  }

  private execute(name: string, room: ExchangeRoom, args: { roomId: string; memberId?: string; bookId?: string }): Record<string, unknown> {
    if (name === "inspect_circle") return { circle: room };
    if (name === "explain_match") {
      const member = room.members.find((item) => item.id === args.memberId);
      const owner = room.members.find((item) => item.offer.id === args.bookId);
      if (!member || !owner || member.id === owner.id) throw new AppError("Choose a reader and another member's book.");
      const graph = new PreferenceGraphBuilder();
      const evidence = graph.evidenceFor(room, member.id);
      const entry = evidence ? graph.entryFor(evidence, owner.offer.id, owner.offer.entityId) : undefined;
      return {
        member: { id: member.id, name: member.name, seeds: member.seeds }, book: owner.offer,
        evidence: evidence && entry ? {
          id: evidence.id, source: evidence.source, fetchedAt: evidence.fetchedAt,
          rank: entry.rank, rankedCount: evidence.entries.length, requestedCount: evidence.requestedBookIds.length,
          providerScore: entry.providerScore, explanation: entry.explanation,
          request: evidence.request, warnings: evidence.warnings,
        } : null,
        evidenceStatus: entry ? "ranked" : "unknown",
        readingChoice: room.choices.find((choice) => choice.memberId === member.id && choice.bookId === owner.offer.id)?.value ?? "unreviewed",
        interpretation: "This is relative cultural-affinity evidence, not a prediction of enjoyment or permission to exchange. A missing result is unknown, not dislike.",
      };
    }
    // The read-only tools cannot make provider requests even if future agent
    // changes accidentally try. Planning is pure and its generated events are
    // discarded rather than persisted.
    const unavailable = async (): Promise<never> => { throw new AppError("This read-only tool cannot fetch new taste evidence."); };
    const provider: TasteProvider = { source: room.mode === "demo" ? "fixture" : "qloo", search: unavailable, rank: unavailable };
    const preview = new ExchangeAgent(provider).plan(room);
    if (name === "suggest_next_question") return { question: preview.question, matchedCount: preview.plan?.matchedCount ?? 0, requiresMemberAnswer: true };
    return { plan: preview.plan, question: preview.question, approvals: preview.approvals, persisted: false };
  }

  private checkProtocolHeader(request: Request): void {
    const version = request.headers.get("mcp-protocol-version");
    if (version && !PROTOCOLS.some((supported) => supported === version)) {
      throw new AppError("This MCP protocol version is not supported.", 400, "unsupported_protocol");
    }
  }

  private success(id: RpcId, result: unknown): Response { return jsonResponse({ jsonrpc: "2.0", id, result }); }
  private failure(id: RpcId, code: number, message: string, status = 200): Response {
    return jsonResponse({ jsonrpc: "2.0", id, error: { code, message } }, status);
  }
}
