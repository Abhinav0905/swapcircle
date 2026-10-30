import { Check, X, ArrowRight, Sparkles, ShieldCheck, ChevronDown, Undo2, LogOut } from "lucide-react";
import type { ExchangeRoom, Member, RoomAction, RoomRole } from "@/lib/domain/types";
import { BookCover } from "./BookCover";

export function ReaderPanel({ room, member, role, busy, onAction }: {
  room: ExchangeRoom; member: Member; role: RoomRole; busy: boolean; onAction: (action: RoomAction) => void;
}) {
  const ranking = room.rankings.find((entry) => entry.memberId === member.id);
  const question = room.question?.memberId === member.id ? room.question : null;
  const cycle = room.plan?.cycles.find((item) => item.memberIds.includes(member.id));
  const incoming = cycle?.edges.find((edge) => edge.recipientId === member.id);
  const incomingBook = room.members.find((item) => item.offer.id === incoming?.bookId)?.offer;
  const approved = cycle && room.approvals.some((approval) => approval.memberId === member.id && approval.fingerprint === cycle.fingerprint);
  const canAct = (role.kind === "host" && room.mode === "demo") || (role.kind === "member" && role.memberId === member.id);
  const entries = [...(ranking?.entries ?? [])].sort((a, b) => a.rank - b.rank);
  return <aside className="reader-panel" id="reader-panel">
    <div className="reader-panel-top"><span className="avatar large" style={{ background: member.color }}>{member.name[0]}</span><div><span className="eyebrow">{room.mode === "demo" ? "SIMULATE A READER'S RESPONSE" : "READER'S CHOICES"}</span><h2>{member.name}'s next chapter</h2></div></div>
    <div className="reader-favorites"><span>Loves</span>{member.seeds.map((seed) => <span className="taste-chip" key={seed.id}>{seed.name}</span>)}</div>
    {!member.active && <div className="notice compact"><span>This reader has stepped out. Their book stays with them.</span>{canAct && <button className="text-button" disabled={busy} onClick={() => onAction({ type: "restore", memberId: member.id })}><Undo2 size={14} /> Rejoin</button>}</div>}
    {question && member.active && <div className="bridge-note"><Sparkles size={18} /><p><strong>One choice could connect {question.connectsMemberIds.length} readers.</strong><span>Review {room.members.find((m) => m.offer.id === question.bookId)?.offer.title}. No one is committed yet.</span></p></div>}
    {incomingBook && <div className={`approval-card ${approved ? "approved" : ""}`}><ShieldCheck size={20} /><div><strong>{approved ? "This exact exchange is approved" : "Your proposed exchange"}</strong><p>Give <b>{member.offer.title}</b>. Receive <b>{incomingBook.title}</b>.</p>{canAct && <button className="button small primary" disabled={busy || !!approved} onClick={() => onAction({ type: "approve", memberId: member.id, fingerprint: cycle!.fingerprint })}>{approved ? <><Check size={14} /> {room.mode === "demo" ? "Simulated approval" : "Approved"}</> : room.mode === "demo" ? "Simulate approval" : "Approve my exchange"}</button>}</div></div>}
    <div className="panel-section-heading"><h3>On the table for {member.name}</h3><span>{ranking?.source === "qloo" ? "Qloo ranking" : "Sample ranking"}</span></div>
    {!ranking && <p className="empty-note">Run taste matching to find possibilities among the books in this circle.</p>}
    <div className="ranked-books">{entries.map((entry) => {
      const giver = room.members.find((item) => item.offer.id === entry.bookId);
      if (!giver || !giver.active || !giver.offer.available) return null;
      const choice = room.choices.find((item) => item.memberId === member.id && item.bookId === entry.bookId);
      return <div className={`ranked-book ${question?.bookId === entry.bookId ? "bridge-candidate" : ""}`} key={entry.bookId}>
        <div className="mini-cover" style={{ background: giver.offer.color }} aria-hidden="true"><span>{entry.rank}</span></div>
        <div className="ranked-book-info"><strong>{giver.offer.title}</strong><span>{giver.name}'s copy <span aria-hidden="true">·</span> #{entry.rank} for {member.name}</span>
          {canAct && member.active ? <div className="choice-buttons"><button className={choice?.value === "yes" ? "chosen yes" : ""} disabled={busy} onClick={() => onAction({ type: "choice", memberId: member.id, bookId: entry.bookId, value: "yes" })} aria-pressed={choice?.value === "yes"}><Check size={13} /> I'd read this</button><button className={choice?.value === "no" ? "chosen no" : ""} disabled={busy} onClick={() => onAction({ type: "choice", memberId: member.id, bookId: entry.bookId, value: "no" })} aria-pressed={choice?.value === "no"}><X size={13} /> Pass</button></div> : <span className={`choice-label ${choice?.value ?? ""}`}>{choice?.value === "yes" ? "Open to this book" : choice?.value === "no" ? "Passed" : "Awaiting their choice"}</span>}
        </div>
      </div>;
    })}</div>
    {ranking && <details className="evidence-details"><summary>Where these suggestions came from <ChevronDown size={15} /></summary><div><p><strong>{ranking.source === "qloo" ? "Live Qloo response" : "Illustrative sample data"}</strong></p><p>{ranking.source === "qloo" ? "Rank is relative to this reader's available book pool. It is not a probability they'll enjoy a book." : "These rankings were authored to demonstrate the exchange flow. They are not returned by Qloo."}</p><dl><dt>Favorites used</dt><dd>{ranking.seeds.map((seed) => seed.name).join(", ")}</dd><dt>Books checked</dt><dd>{ranking.requestedBookIds.length}</dd><dt>Missing results</dt><dd>{ranking.missingBookIds.length}</dd><dt>Recorded</dt><dd>{new Date(ranking.fetchedAt).toLocaleString()}</dd></dl>{ranking.warnings.map((warning) => <p className="evidence-warning" key={warning}>{warning}</p>)}<details><summary>Request details</summary><pre>{JSON.stringify(ranking.request, null, 2)}</pre></details></div></details>}
    {canAct && member.active && <button className="text-button withdraw-button" disabled={busy} onClick={() => onAction({ type: "withdraw", memberId: member.id })}><LogOut size={14} /> {room.mode === "demo" ? `Simulate ${member.name} stepping out` : "Step out of this exchange"}</button>}
  </aside>;
}
