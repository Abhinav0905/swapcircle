import type { AgentEvent, ExchangeRoom, RankingEvidence, TasteProvider } from "@/lib/domain/types";
import { BridgeQuestionPlanner } from "@/lib/exchange/BridgeQuestionPlanner";
import { ConsentService } from "@/lib/exchange/ConsentService";
import { CycleEnumerator } from "@/lib/exchange/CycleEnumerator";
import { ExchangeError } from "@/lib/exchange/ExchangeError";
import { ExchangeOptimizer } from "@/lib/exchange/ExchangeOptimizer";
import { PreferenceGraphBuilder } from "@/lib/exchange/PreferenceGraphBuilder";

/** Bounded tool orchestration: rank, respect choices, solve, then ask or wait. */
export class ExchangeAgent {
  private readonly graphBuilder = new PreferenceGraphBuilder();
  private readonly enumerator = new CycleEnumerator();
  private readonly optimizer = new ExchangeOptimizer(this.enumerator);
  private readonly consent = new ConsentService(this.graphBuilder, this.enumerator);
  private readonly questions = new BridgeQuestionPlanner(this.graphBuilder, this.optimizer);

  constructor(private readonly provider: TasteProvider) {}

  async rank(room: ExchangeRoom): Promise<ExchangeRoom> {
    this.graphBuilder.build(room);
    if (room.mode === "live" && this.provider.source !== "qloo") throw new ExchangeError("Live exchanges need Qloo evidence. Sample rankings cannot replace it.", "live_evidence_required");
    const members = room.members.filter((member) => member.active && member.offer.available);
    if (members.length < 2) throw new ExchangeError("At least two available members are needed to rank books.", "not_enough_members");
    const rankings: RankingEvidence[] = [];

    // Two bounded requests at a time. A failed batch rejects the whole refresh;
    // callers retain the previous room instead of saving partial or sample evidence.
    for (let offset = 0; offset < members.length; offset += 2) {
      const batch = await Promise.all(members.slice(offset, offset + 2).map(async (member) => {
        const offers = members.filter((giver) => giver.id !== member.id).map((giver) => giver.offer);
        const evidence = await this.provider.rank(member, offers);
        const requested = [...evidence.requestedBookIds].sort();
        const expected = offers.map((offer) => offer.id).sort();
        if (evidence.memberId !== member.id || evidence.source !== this.provider.source || JSON.stringify(requested) !== JSON.stringify(expected)) {
          throw new ExchangeError("The taste provider returned evidence for a different request.", "invalid_provider_evidence");
        }
        return structuredClone(evidence);
      }));
      rankings.push(...batch);
    }
    const refreshed = this.addEvent({ ...room, rankings }, "rank_available_books", `${rankings.length} taste profiles ranked the books currently offered.`, "complete", `${this.provider.source === "qloo" ? "Qloo" : "Illustrative fixture"} evidence. Rankings suggest possibilities; members choose what they want to read.`);
    return this.plan(refreshed);
  }

  plan(room: ExchangeRoom): ExchangeRoom {
    const graph = this.graphBuilder.build(room);
    const cycles = this.enumerator.enumerate(graph);
    const locked = this.consent.lockedCycles(room, cycles);
    const plan = this.optimizer.solve(graph, room.plan, locked);
    const approvals = this.consent.retainForPlan(room.approvals, plan);
    const question = this.questions.find(room, graph, plan, locked);
    let result: ExchangeRoom = { ...room, plan, approvals, question };
    result = this.addEvent(result, "plan_exchange_circles", `${plan.matchedCount} of ${graph.memberIds.length} available members have a proposed exchange.`, "complete", `${graph.edges.length} evidence-backed reading choices; ${plan.cycles.length} circles. Direct swaps alone can match ${plan.directSwapCount} people. ${locked.length} fully approved circles preserved.`);
    if (question) {
      const member = room.members.find((item) => item.id === question.memberId)!;
      const book = room.members.find((item) => item.offer.id === question.bookId)!.offer;
      result = this.addEvent(result, "ask_bridge_question", `${member.name} can review ${book.title} to make another circle possible.`, "waiting", question.reason);
    } else if (plan.matchedCount === 0) {
      result = this.addEvent(result, "wait_for_reading_choices", "No exchange circle exists among the current reading choices.", "waiting", "No preference was relaxed. Members can review other ranked books or add another offer.");
    } else if (plan.cycles.some((cycle) => cycle.memberIds.some((memberId) => !approvals.some((approval) => approval.memberId === memberId && approval.fingerprint === cycle.fingerprint)))) {
      result = this.addEvent(result, "wait_for_member_approval", "The proposed circles need each member's approval.", "waiting", "An interest in reading a book is not permission to exchange it.");
    }
    return result;
  }

  choose(room: ExchangeRoom, memberId: string, bookId: string, value: "yes" | "no"): ExchangeRoom {
    if (value !== "yes" && value !== "no") throw new ExchangeError("Choose yes or no for a book.");
    const member = this.requireAvailableMember(room, memberId);
    const giver = room.members.find((item) => item.offer.id === bookId);
    if (!giver || giver.id === member.id) throw new ExchangeError("Choose a book offered by another member.");
    if (value === "yes") {
      if (!giver.active || !giver.offer.available) throw new ExchangeError("That book is no longer available.", "book_unavailable");
      const evidence = this.graphBuilder.evidenceFor(room, memberId);
      if (!evidence || !this.graphBuilder.entryFor(evidence, bookId, giver.offer.entityId)) throw new ExchangeError("This book needs current taste evidence before it can enter a proposal.", "missing_evidence");
    }
    const choices = room.choices.filter((choice) => choice.memberId !== memberId || choice.bookId !== bookId);
    choices.push({ memberId, bookId, value, updatedAt: new Date().toISOString() });
    const changed = this.addEvent({ ...room, choices }, "record_reading_choice", `${member.name} ${value === "yes" ? "wants to read" : "declined"} ${giver.offer.title}.`, "complete");
    return this.plan(changed);
  }

  approve(room: ExchangeRoom, memberId: string, fingerprint: string): ExchangeRoom {
    const approved = this.consent.approve(room, memberId, fingerprint);
    const member = room.members.find((item) => item.id === memberId)!;
    return this.addEvent(approved, "approve_exact_exchange", `${member.name} approved this exact exchange.`, "complete", "The approval applies only to the current circle and its books.");
  }

  withdraw(room: ExchangeRoom, memberId: string): ExchangeRoom {
    const member = room.members.find((item) => item.id === memberId);
    if (!member) throw new ExchangeError("This exchange member was not found.", "member_not_found");
    const members = room.members.map((item) => item.id === memberId ? { ...item, active: false, offer: { ...item.offer, available: false } } : item);
    const changed = this.addEvent({ ...room, members }, "withdraw_member", `${member.name} withdrew from this exchange.`, "complete", "Affected approvals will be cleared. Other fully approved circles stay protected.");
    return this.plan(changed);
  }

  restore(room: ExchangeRoom, memberId: string): ExchangeRoom {
    const member = room.members.find((item) => item.id === memberId);
    if (!member) throw new ExchangeError("This exchange member was not found.", "member_not_found");
    const members = room.members.map((item) => item.id === memberId ? { ...item, active: true, offer: { ...item.offer, available: true } } : item);
    const changed = this.addEvent({ ...room, members }, "restore_member", `${member.name} is available for proposals again.`, "complete", "Previous approvals are not restored. New or changed offers need refreshed evidence.");
    return this.plan(changed);
  }

  private requireAvailableMember(room: ExchangeRoom, memberId: string) {
    const member = room.members.find((item) => item.id === memberId);
    if (!member?.active || !member.offer.available) throw new ExchangeError("This member is not available for an exchange.", "member_unavailable");
    return member;
  }

  private addEvent(room: ExchangeRoom, tool: string, summary: string, status: AgentEvent["status"], detail?: string): ExchangeRoom {
    const event: AgentEvent = { id: crypto.randomUUID(), at: new Date().toISOString(), tool, summary, status, ...(detail ? { detail } : {}) };
    return { ...room, events: [...room.events, event].slice(-60) };
  }
}
