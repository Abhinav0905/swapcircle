import type { CycleApproval, ExchangePlan, ExchangeRoom, SwapCycle } from "@/lib/domain/types";
import { CycleEnumerator } from "./CycleEnumerator";
import { ExchangeError } from "./ExchangeError";
import { PreferenceGraphBuilder } from "./PreferenceGraphBuilder";

/** Reading interest and consent to an exact exchange are deliberately separate. */
export class ConsentService {
  constructor(
    private readonly graphBuilder = new PreferenceGraphBuilder(),
    private readonly enumerator = new CycleEnumerator(),
  ) {}

  approve(room: ExchangeRoom, memberId: string, fingerprint: string): ExchangeRoom {
    const member = room.members.find((item) => item.id === memberId);
    if (!member?.active || !member.offer.available) throw new ExchangeError("This member is not available for an exchange.", "member_unavailable");
    const planned = room.plan?.cycles.find((cycle) => cycle.fingerprint === fingerprint && cycle.memberIds.includes(memberId));
    const current = this.enumerator.enumerate(this.graphBuilder.build(room));
    if (!planned || !current.some((cycle) => cycle.fingerprint === fingerprint)) {
      throw new ExchangeError("This exchange has changed. Review the current proposal before approving it.", "stale_approval");
    }
    const alreadyApproved = room.approvals.find((approval) => approval.memberId === memberId && approval.fingerprint === fingerprint);
    if (alreadyApproved) return { ...room, approvals: [...room.approvals] };
    const approval: CycleApproval = { memberId, fingerprint, approvedAt: new Date().toISOString() };
    return {
      ...room,
      approvals: [...room.approvals.filter((item) => item.memberId !== memberId), approval],
    };
  }

  lockedCycles(room: ExchangeRoom, currentCycles: SwapCycle[]): SwapCycle[] {
    const current = new Map(currentCycles.map((cycle) => [cycle.fingerprint, cycle]));
    return (room.plan?.cycles ?? [])
      .filter((cycle) => current.has(cycle.fingerprint))
      .filter((cycle) => cycle.memberIds.every((memberId) => room.approvals.some((approval) => approval.memberId === memberId && approval.fingerprint === cycle.fingerprint)))
      .map((cycle) => current.get(cycle.fingerprint)!);
  }

  retainForPlan(approvals: CycleApproval[], plan: ExchangePlan): CycleApproval[] {
    const seen = new Set<string>();
    return approvals.filter((approval) => {
      if (seen.has(approval.memberId)) return false;
      const valid = plan.cycles.some((cycle) => cycle.fingerprint === approval.fingerprint && cycle.memberIds.includes(approval.memberId));
      if (valid) seen.add(approval.memberId);
      return valid;
    }).map((approval) => ({ ...approval }));
  }
}
