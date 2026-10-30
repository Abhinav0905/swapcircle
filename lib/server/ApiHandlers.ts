import { AppError } from "../domain/errors";
import type { CreatedRoom, EntityType, Member, RoomAction, RoomSession, TasteEntity } from "../domain/types";
import { actionSchema, createRoomSchema, entityTypeSchema } from "../domain/validation";
import { assertRequestOrigin, bearerToken, errorResponse, jsonResponse, readLimitedJson, RequestLimiter, roomId } from "./HttpBoundary";

export interface RoomOperations {
  create(input: { mode: "demo" | "live"; title?: string; members?: Member[] }): Promise<CreatedRoom>;
  read(id: string, token: string): Promise<RoomSession>;
  act(id: string, token: string, revision: number, action: RoomAction): Promise<RoomSession>;
  remove(id: string, token: string): Promise<void>;
}

export interface ApiDependencies {
  rooms: RoomOperations;
  limiter: RequestLimiter;
  qlooConfigured: boolean;
  search(query: string, type: EntityType): Promise<TasteEntity[]>;
}

/** HTTP concerns stay here; domain authorization and revisions stay in RoomService. */
export class ApiHandlers {
  constructor(private readonly dependencies: ApiDependencies) {}

  status(): Response { return jsonResponse({ qlooConfigured: this.dependencies.qlooConfigured }); }

  async create(request: Request): Promise<Response> {
    return this.run(async () => {
      assertRequestOrigin(request);
      const input = createRoomSchema.parse(await readLimitedJson(request));
      if (input.mode === "live") this.requireQloo();
      await this.dependencies.limiter.client(request, "create", 20, 3_600_000);
      await this.dependencies.limiter.global("create", 500, 86_400_000);
      return jsonResponse(await this.dependencies.rooms.create(input), 201);
    });
  }

  async read(request: Request, id: string): Promise<Response> {
    return this.run(async () => {
      assertRequestOrigin(request);
      const token = bearerToken(request);
      await this.dependencies.limiter.client(request, "read", 240, 60_000);
      return jsonResponse(await this.dependencies.rooms.read(roomId(id), token));
    });
  }

  async act(request: Request, id: string): Promise<Response> {
    return this.run(async () => {
      assertRequestOrigin(request);
      const token = bearerToken(request);
      const validId = roomId(id);
      const { revision, action } = actionSchema.parse(await readLimitedJson(request));
      await this.dependencies.limiter.client(request, "act", 90, 60_000);
      if (action.type === "rank") {
        // Authenticate before charging the shared provider budget. RoomService
        // repeats the read and checks revision atomically before saving.
        const session = await this.dependencies.rooms.read(validId, token);
        if (session.role.kind !== "host") throw new AppError("Only the host can refresh taste suggestions.", 403, "forbidden");
        if (session.room.mode === "live") {
          this.requireQloo();
          await this.dependencies.limiter.client(request, "rank-live", 12, 3_600_000);
          await this.dependencies.limiter.global("rank-live", 50, 3_600_000);
        }
      }
      return jsonResponse(await this.dependencies.rooms.act(validId, token, revision, action));
    });
  }

  async remove(request: Request, id: string): Promise<Response> {
    return this.run(async () => {
      assertRequestOrigin(request);
      const token = bearerToken(request);
      await this.dependencies.limiter.client(request, "delete", 20, 3_600_000);
      await this.dependencies.rooms.remove(roomId(id), token);
      return jsonResponse({ deleted: true });
    });
  }

  async search(request: Request): Promise<Response> {
    return this.run(async () => {
      assertRequestOrigin(request);
      const url = new URL(request.url);
      const query = (url.searchParams.get("q") ?? "").trim();
      if (query.length < 2 || query.length > 100 || /[\u0000-\u001f]/.test(query)) {
        throw new AppError("Search with between 2 and 100 characters.");
      }
      const type = entityTypeSchema.parse(url.searchParams.get("type"));
      this.requireQloo();
      await this.dependencies.limiter.client(request, "search", 60, 3_600_000);
      await this.dependencies.limiter.global("search", 600, 3_600_000);
      const entities = await this.dependencies.search(query, type);
      return jsonResponse({ entities: entities.slice(0, 8) });
    });
  }

  private requireQloo(): void {
    if (!this.dependencies.qlooConfigured) throw new AppError("Live Qloo access is not configured yet. The sample circle is available separately.", 503, "qloo_not_configured");
  }

  private async run(operation: () => Promise<Response>): Promise<Response> {
    try { return await operation(); } catch (error) { return errorResponse(error); }
  }
}
