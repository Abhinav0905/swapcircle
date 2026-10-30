import type { ExchangeRoom } from "../domain/types";

/** Plain-text handoffs stay readable offline and never contain access tokens. */
export class ExchangeExport {
  static text(room: ExchangeRoom): string {
    const lines = ["SWAPCIRCLE", room.title, "", room.mode === "demo" ? "ILLUSTRATIVE DEMO — all choices and approvals are simulated." : "Live exchange proposal", `Room revision: ${room.revision}`, `Exported: ${new Date().toISOString()}`, ""];
    if (!room.plan?.cycles.length) lines.push("No closed exchange circle exists yet. Keep your books until a complete plan is approved.");
    for (const [index, cycle] of (room.plan?.cycles ?? []).entries()) {
      const ready = cycle.memberIds.every((id) => room.approvals.some((approval) => approval.memberId === id && approval.fingerprint === cycle.fingerprint));
      lines.push(`CIRCLE ${index + 1} — ${ready ? (room.mode === "demo" ? "SIMULATED APPROVALS COMPLETE" : "ALL MEMBERS APPROVED") : "PROPOSAL — AWAITING APPROVALS"}`);
      for (const edge of cycle.edges) {
        const giver = room.members.find((member) => member.id === edge.giverId)!;
        const recipient = room.members.find((member) => member.id === edge.recipientId)!;
        lines.push(`${giver.name} gives "${giver.offer.title}" to ${recipient.name}.`, `  Copy condition: ${giver.offer.condition}`, `  ${recipient.name}'s evidence source: ${room.rankings.find((ranking) => ranking.id === edge.evidenceId)?.source ?? "unknown"}; within-person rank: ${edge.recipientRank}`);
      }
      lines.push("Meet together and confirm each physical copy's condition before handing over any book.", "");
    }
    lines.push("These cards describe this saved proposal only. Reopen the circle before meeting to check for changes.", "Qloo affinity is a cultural signal, not proof of individual preference. Member choices and approvals are separate.");
    return lines.join("\n");
  }

  static download(room: ExchangeRoom): void {
    const blob = new Blob([this.text(room)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "swapcircle-handoff.txt"; link.click(); URL.revokeObjectURL(url);
  }
}
