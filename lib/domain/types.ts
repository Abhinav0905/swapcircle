/** Shared records. Provider evidence, reading choices and exchange consent are separate. */
export type EvidenceSource = "qloo" | "fixture";
export type EntityType = "book" | "movie" | "artist" | "tv_show" | "podcast" | "videogame";

export interface TasteEntity {
  id: string;
  name: string;
  type: EntityType;
  subtitle?: string;
}

export interface BookOffer {
  id: string;
  ownerId: string;
  title: string;
  author: string;
  entityId: string;
  condition: string;
  color: string;
  available: boolean;
}

export interface Member {
  id: string;
  name: string;
  color: string;
  seeds: TasteEntity[];
  offer: BookOffer;
  active: boolean;
}

export interface RankingEntry {
  bookId: string;
  entityId: string;
  rank: number;
  providerScore: number | null;
  explanation: string | null;
}

export interface RankingEvidence {
  id: string;
  memberId: string;
  source: EvidenceSource;
  fetchedAt: string;
  seeds: TasteEntity[];
  requestedBookIds: string[];
  entries: RankingEntry[];
  missingBookIds: string[];
  warnings: string[];
  request: { endpoint: string; parameters: Record<string, string> };
}

export interface ReadingChoice {
  memberId: string;
  bookId: string;
  value: "yes" | "no";
  updatedAt: string;
}

/** A physical book travels from giver to recipient. */
export interface SwapEdge {
  giverId: string;
  recipientId: string;
  bookId: string;
  recipientRank: number;
  evidenceId: string;
}

export interface SwapCycle {
  id: string;
  fingerprint: string;
  memberIds: string[];
  edges: SwapEdge[];
}

export interface ExchangePlan {
  cycles: SwapCycle[];
  matchedMemberIds: string[];
  unmatchedMemberIds: string[];
  directSwapCount: number;
  matchedCount: number;
  changedAssignments: number;
}

export interface CycleApproval {
  memberId: string;
  fingerprint: string;
  approvedAt: string;
}

export interface BridgeQuestion {
  memberId: string;
  bookId: string;
  connectsMemberIds: string[];
  rank: number;
  reason: string;
}

export interface AgentEvent {
  id: string;
  at: string;
  tool: string;
  summary: string;
  detail?: string;
  status: "complete" | "waiting" | "error";
}

export interface ExchangeRoom {
  id: string;
  title: string;
  mode: "demo" | "live";
  revision: number;
  createdAt: string;
  members: Member[];
  rankings: RankingEvidence[];
  choices: ReadingChoice[];
  plan: ExchangePlan | null;
  approvals: CycleApproval[];
  question: BridgeQuestion | null;
  events: AgentEvent[];
}

export interface TasteProvider {
  readonly source: EvidenceSource;
  search(query: string, type: EntityType): Promise<TasteEntity[]>;
  rank(member: Member, offers: BookOffer[]): Promise<RankingEvidence>;
}

export type RoomRole = { kind: "host" } | { kind: "member"; memberId: string };

export interface RoomSession {
  room: ExchangeRoom;
  role: RoomRole;
}

export interface CreatedRoom extends RoomSession {
  hostToken: string;
  memberTokens: Record<string, string>;
}

export type RoomAction =
  | { type: "rank" }
  | { type: "plan" }
  | { type: "choice"; memberId: string; bookId: string; value: "yes" | "no" }
  | { type: "approve"; memberId: string; fingerprint: string }
  | { type: "withdraw"; memberId: string }
  | { type: "restore"; memberId: string }
  | { type: "update_member"; memberId: string; member: Member };
