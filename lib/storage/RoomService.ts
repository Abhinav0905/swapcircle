import { AppError } from "../domain/errors";
import type { CreatedRoom, ExchangeRoom, Member, RoomAction, RoomRole, RoomSession, TasteProvider } from "../domain/types";
import { createRoomSchema } from "../domain/validation";
import { DemoFactory } from "../demo/DemoFactory";
import { CapabilityService, type CredentialRecord } from "./CapabilityService";
import type { RoomRepository } from "./RoomRepository";
import { ExchangeAgent } from "../agent/ExchangeAgent";

export class RoomService {
  constructor(
    private readonly repository: RoomRepository,
    private readonly capabilities: CapabilityService,
    private readonly provider: (mode: ExchangeRoom["mode"]) => TasteProvider,
  ) {}

  async create(input: { mode: "demo" | "live"; title?: string; members?: Member[] }): Promise<CreatedRoom> {
    const validated = createRoomSchema.parse(input);
    const room = validated.mode === "demo" ? DemoFactory.create() : this.createLiveRoom(validated.title, validated.members);
    const credentials: CredentialRecord[] = [];
    const hostToken = this.capabilities.issue();
    credentials.push({ hash: await this.capabilities.hash(hostToken), role: { kind: "host" } });
    const memberTokens: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const member of room.members) {
      const token = this.capabilities.issue();
      memberTokens[member.id] = token;
      credentials.push({ hash: await this.capabilities.hash(token), role: { kind: "member", memberId: member.id } });
    }
    await this.repository.create(room, credentials);
    return { room, role: { kind: "host" }, hostToken, memberTokens };
  }

  private createLiveRoom(title: string, members: Member[]): ExchangeRoom {
    if (new Set(members.map((member) => member.id)).size !== members.length ||
        new Set(members.map((member) => member.offer.id)).size !== members.length) {
      throw new AppError("Every reader and physical book needs a different ID.");
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const member of members) {
      if (member.offer.ownerId !== member.id || !uuid.test(member.offer.entityId) || member.seeds.some((seed) => !uuid.test(seed.id))) {
        throw new AppError("Choose confirmed Qloo entities for every book and cultural favorite.");
      }
    }
    const now = new Date().toISOString();
    return { id: crypto.randomUUID(), title, mode: "live", revision: 0, createdAt: now,
      members: members.map((member) => ({ ...member, active: true, offer: { ...member.offer, available: true } })),
      rankings: [], choices: [], plan: null, approvals: [], question: null, events: [] };
  }

  async read(id: string, token: string): Promise<RoomSession> {
    const stored = await this.repository.get(id);
    if (!stored) throw new AppError("This circle could not be found.", 404, "not_found");
    const role = await this.capabilities.identify(token, stored.credentials);
    if (!role) throw new AppError("Open this circle with your private invitation link.", 401, "unauthorized");
    return { room: stored.room, role };
  }

  async act(id: string, token: string, revision: number, action: RoomAction): Promise<RoomSession> {
    const { room, role } = await this.read(id, token);
    if (room.revision !== revision) throw new AppError("This circle changed. Refresh before making this choice.", 409, "stale_revision");
    this.authorize(room, role, action);
    const agent = new ExchangeAgent(this.provider(room.mode));
    let next: ExchangeRoom;
    switch (action.type) {
      case "rank":
        await this.repository.consumeLimit(`rank:${room.id}`, 8, 60 * 60 * 1000);
        next = await agent.rank(room); break;
      case "plan": next = agent.plan(room); break;
      case "choice": next = agent.choose(room, action.memberId, action.bookId, action.value); break;
      case "approve": next = agent.approve(room, action.memberId, action.fingerprint); break;
      case "withdraw": next = agent.withdraw(room, action.memberId); break;
      case "restore": next = agent.restore(room, action.memberId); break;
      case "update_member": {
        const existing = room.members.find((member) => member.id === action.memberId);
        if (!existing || action.member.id !== existing.id || action.member.offer.id !== existing.offer.id || action.member.offer.ownerId !== existing.id) {
          throw new AppError("A book update cannot change its owner or physical copy ID.");
        }
        if (room.mode === "live") this.createLiveRoom(room.title, room.members.map((member) => member.id === existing.id ? action.member : member));
        next = { ...room, members: room.members.map((member) => member.id === existing.id ? action.member : member),
          rankings: [], choices: [], approvals: [], plan: null, question: null,
          events: [...room.events, { id: crypto.randomUUID(), at: new Date().toISOString(), tool: "update_member", status: "complete",
            summary: `${existing.name}'s book or favorites changed. Refresh taste suggestions before planning.` }] };
        break;
      }
    }
    next = { ...next, revision: revision + 1, events: next.events.slice(-60) };
    await this.repository.save(next, revision);
    return { room: next, role };
  }

  private authorize(room: ExchangeRoom, role: RoomRole, action: RoomAction): void {
    if (role.kind === "host" && room.mode === "demo") return;
    if (action.type === "rank" || action.type === "plan") {
      if (role.kind !== "host") throw new AppError("Only the host can refresh suggestions or run the circle planner.", 403);
      return;
    }
    if (role.kind !== "member" || role.memberId !== action.memberId) {
      throw new AppError("Each reader makes their own choices through their private invitation link.", 403);
    }
  }

  async remove(id: string, token: string): Promise<void> {
    const { role } = await this.read(id, token);
    if (role.kind !== "host") throw new AppError("Only the host can delete this circle.", 403);
    await this.repository.remove(id);
  }
}
