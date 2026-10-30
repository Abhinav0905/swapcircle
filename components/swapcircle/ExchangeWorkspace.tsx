"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, RefreshCw, Share2, Sparkles, Activity, Table2, ListFilter, ExternalLink, Loader2, Trash2 } from "lucide-react";
import type { ExchangeRoom, RoomAction, RoomRole } from "@/lib/domain/types";
import { CircleMap } from "./CircleMap";
import { ReaderPanel } from "./ReaderPanel";
import { ShareDialog } from "./ShareDialog";
import { useDialogFocus } from "./useDialogFocus";

export function ExchangeWorkspace({ room, role, token, memberTokens, busy, onAction, onRefresh, onHome, onDelete, onExport }: {
  room: ExchangeRoom; role: RoomRole; token: string; memberTokens: Record<string, string>; busy: boolean;
  onAction: (action: RoomAction) => void; onRefresh: () => void; onHome: () => void; onDelete: () => void; onExport: () => void;
}) {
  const [selectedId, setSelectedId] = useState(role.kind === "member" ? role.memberId : room.question?.memberId ?? room.members[0]?.id);
  const [tab, setTab] = useState<"table" | "evidence" | "activity">("table");
  const [share, setShare] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteDialogRef = useDialogFocus(() => setDeleteConfirm(false), deleteConfirm);
  const [readerSelected, setReaderSelected] = useState(false);
  const roleMemberId = role.kind === "member" ? role.memberId : null;
  useEffect(() => {
    if (roleMemberId) { setSelectedId(roleMemberId); setReaderSelected(true); }
  }, [roleMemberId]);
  useEffect(() => {
    if (!readerSelected && role.kind === "host" && room.question) setSelectedId(room.question.memberId);
  }, [readerSelected, role.kind, room.question]);
  const selectReader = (id: string) => {
    setReaderSelected(true); setSelectedId(id);
    if (window.matchMedia("(max-width: 960px)").matches) requestAnimationFrame(() => document.getElementById("reader-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const member = room.members.find((item) => item.id === selectedId) ?? room.members[0];
  const total = room.members.filter((item) => item.active).length;
  const allApproved = !!room.plan?.cycles.length && room.plan.cycles.every((cycle) => cycle.memberIds.every((id) => room.approvals.some((approval) => approval.memberId === id && approval.fingerprint === cycle.fingerprint)));
  const approvedPeople = room.plan?.cycles.reduce((sum, cycle) => sum + cycle.memberIds.filter((id) => room.approvals.some((approval) => approval.memberId === id && approval.fingerprint === cycle.fingerprint)).length, 0) ?? 0;
  const source = room.rankings.length ? room.rankings.every((evidence) => evidence.source === "qloo") ? "Live Qloo evidence" : "Sample rankings" : "Suggestions not yet loaded";
  return <main className="workspace">
    <div className={`demo-banner ${room.mode === "live" ? "live-banner" : ""}`}><span><span className="status-dot" />{room.mode === "demo" ? "SAMPLE CIRCLE" : "YOUR PRIVATE CIRCLE"}</span><p>{room.mode === "demo" ? "Fictional readers. Authored rankings. Reader responses and approvals are simulated." : "Private invitation links protect each reader's choices. Suggestions are never consent."}</p>{room.mode === "demo" && <a href="/about#evidence">About this demo <ExternalLink size={12} /></a>}</div>
    <div className="workspace-header"><div><button className="text-button back-link" onClick={onHome}><ArrowLeft size={14} /> All circles</button><h1>{room.title}<span className="room-tag">{room.mode === "demo" ? "DEMO" : "LIVE"}</span></h1><p>{total} readers <span>·</span> {total} books ready for another chapter</p></div><div className="workspace-actions"><button className="button secondary" onClick={onRefresh} disabled={busy} aria-label="Refresh circle"><RefreshCw size={16} /></button>{role.kind === "host" && <button className="button secondary" onClick={(event) => { event.currentTarget.focus(); setShare(true); }}><Share2 size={16} /> Invite readers</button>}<button className="button primary" onClick={onExport} disabled={busy || !room.plan?.cycles.length}><Download size={16} /><span>{allApproved ? "Handoff cards" : "Export proposals"}</span></button></div></div>
    <div className="workspace-tabs"><div role="tablist" aria-label="Circle views" onKeyDown={(event) => {
      const tabs = ["table", "evidence", "activity"] as const;
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : 2)) % 3;
      setTab(tabs[next]); event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }}><button role="tab" tabIndex={tab === "table" ? 0 : -1} aria-selected={tab === "table"} className={tab === "table" ? "active" : ""} onClick={() => setTab("table")}><Table2 size={16} /> The table</button><button role="tab" tabIndex={tab === "evidence" ? 0 : -1} aria-selected={tab === "evidence"} className={tab === "evidence" ? "active" : ""} onClick={() => setTab("evidence")}><ListFilter size={16} /> Taste evidence</button><button role="tab" tabIndex={tab === "activity" ? 0 : -1} aria-selected={tab === "activity"} className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}><Activity size={16} /> Agent activity</button></div><span className="evidence-indicator"><i className={room.mode === "live" ? "green" : ""} />{source}</span></div>
    <div className="workspace-body">
      <aside className="readers-sidebar"><div className="sidebar-heading"><h2>At the table</h2><span>{total}</span></div><div className="reader-list">{room.members.map((reader) => {
        const count = room.choices.filter((choice) => choice.memberId === reader.id && choice.value === "yes").length;
        const matched = room.plan?.matchedMemberIds.includes(reader.id);
        return <button key={reader.id} className={`${member.id === reader.id ? "selected" : ""} ${reader.active ? "" : "inactive"}`} onClick={() => selectReader(reader.id)} aria-pressed={member.id === reader.id}><span className="avatar" style={{ background: reader.color }}>{reader.name[0]}</span><span className="reader-list-copy"><strong>{reader.name}{role.kind === "member" && role.memberId === reader.id && <small>you</small>}</strong><span>{reader.active ? matched ? "Circle found" : `${count} reading choice${count === 1 ? "" : "s"}` : "Stepped out"}</span></span>{matched ? <span className="reader-status matched"><Check size={12} /></span> : <span className="reader-status" />}</button>;
      })}</div><div className="sidebar-legend"><strong>Every book keeps its owner</strong><p>Nothing changes hands until everyone in that circle approves the exact trade.</p></div>{role.kind === "host" && <button className="button secondary run-agent-button" disabled={busy || total < 2} onClick={() => onAction({ type: "rank" })}>{busy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}{room.rankings.length ? "Refresh taste matches" : "Find taste matches"}</button>}</aside>
      <section className="table-main">
        {tab === "table" && <><div className="table-heading"><div><span className="eyebrow">THE EXCHANGE MAP</span><h2>Everyone gives.<br /><em>Everyone gets a new story.</em></h2></div><span className="handwritten">Follow the books ↘</span></div><CircleMap room={room} selectedId={member.id} onSelect={selectReader} />
          <div className="comparison-bar"><div><span>Direct swaps</span><strong>{room.plan?.directSwapCount ?? 0}<small> readers</small></strong></div><ArrowRight size={21} /><div className="circle-count"><span>With exchange circles</span><strong>{room.plan?.matchedCount ?? 0}<small> readers</small></strong></div><p>Same books.<br />Same accepted choices.</p></div>
          {room.question && <button className="next-question-bar" onClick={() => selectReader(room.question!.memberId)}><Sparkles size={20} /><span><strong>A circle is one answer away.</strong><span>{room.members.find((reader) => reader.id === room.question!.memberId)?.name} has a book to consider.</span></span><ArrowUpRightIcon /></button>}
          <div className="plan-list"><div className="panel-section-heading"><h3>Proposed circles</h3><span>{approvedPeople} / {room.plan?.matchedCount ?? 0} approvals{room.mode === "demo" ? " · simulated" : ""}</span></div>{!room.plan?.cycles.length && <div className="empty-plan"><span>↺</span><h3>No closed circle yet.</h3><p>Review the available books. A reader's next choice may connect the group.</p></div>}{room.plan?.cycles.map((cycle, index) => {
            const ready = cycle.memberIds.every((id) => room.approvals.some((approval) => approval.memberId === id && approval.fingerprint === cycle.fingerprint));
            return <article className={`cycle-card ${ready ? "ready" : ""}`} key={cycle.id}><div className="cycle-card-header"><span className="cycle-label">CIRCLE {String(index + 1).padStart(2, "0")}</span><span>{ready ? room.mode === "demo" ? "Simulated approvals complete" : "All readers approved" : "Waiting for exact-trade approvals"}</span></div><div className="cycle-people">{cycle.edges.map((edge) => { const giver = room.members.find((reader) => reader.id === edge.giverId)!; const recipient = room.members.find((reader) => reader.id === edge.recipientId)!; return <button key={edge.bookId} onClick={() => selectReader(giver.id)}><span className="avatar tiny" style={{ background: giver.color }}>{giver.name[0]}</span><span><strong>{giver.name} <ArrowRight size={12} /> {recipient.name}</strong><small>{giver.offer.title}</small></span></button>; })}</div></article>;
          })}</div></>}
        {tab === "evidence" && <section className="evidence-view"><span className="eyebrow">A SUGGESTION YOU CAN INSPECT</span><h2>Taste opens a door.<br /><em>You choose to walk in.</em></h2><p>Each ranking uses that reader's cultural favorites and only the other available books. A high rank is a reason to consider a book, never an approval.</p><div className="evidence-table-wrap"><table><thead><tr><th>Reader</th><th>Favorites</th><th>Returned</th><th>Source</th></tr></thead><tbody>{room.members.map((reader) => { const evidence = room.rankings.find((r) => r.memberId === reader.id); return <tr key={reader.id}><th><button className="text-button" onClick={() => selectReader(reader.id)}>{reader.name} <ArrowRight size={12} /></button></th><td>{reader.seeds.map((seed) => seed.name).join(" · ")}</td><td>{evidence ? `${evidence.entries.length}/${evidence.requestedBookIds.length}` : "—"}</td><td><span className="source-badge">{evidence?.source === "qloo" ? "Qloo" : evidence ? "Fixture" : "Pending"}</span></td></tr>; })}</tbody></table></div><div className="evidence-explainer"><h3>Three different things</h3><ol><li><strong>Taste evidence:</strong> where a book appears in a reader's Qloo result list.</li><li><strong>Reading choice:</strong> the reader explicitly says they'd consider receiving it.</li><li><strong>Exchange approval:</strong> the reader agrees to one exact circle, including the book they give away.</li></ol><p>Scores from separate Qloo requests are not compared as probabilities. Missing results stay unknown. Changing a circle invalidates its old approvals.</p></div><a className="text-button" href="https://github.com/qloo/docs-public/blob/main/docs/interpreting-affinity-scores.md" target="_blank" rel="noreferrer">Qloo's affinity guide <ExternalLink size={14} /></a></section>}
        {tab === "activity" && <section className="activity-view"><span className="eyebrow">WHAT THE AGENT ACTUALLY DID</span><h2>Every step.<br /><em>Nothing behind a curtain.</em></h2><p>The agent ranks available books, checks explicit choices, solves the exchange and asks for the next useful decision.</p><ol className="event-list">{[...room.events].reverse().map((event) => <li key={event.id}><span className={`event-dot ${event.status}`} /> <div><span className="event-time">{new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}<code>{event.tool}</code></span><strong>{event.summary}</strong>{event.detail && <p>{event.detail}</p>}</div></li>)}</ol><details className="agent-connection"><summary>Connect an agent with MCP</summary><p>SwapCircle exposes read-only tools for inspecting a circle, planning exchanges and explaining a proposed match. No tool can approve a trade for a reader.</p><code>{typeof window !== "undefined" ? window.location.origin : ""}/api/mcp</code><p>Use your private circle token as the Authorization bearer credential. Treat it like your invitation link.</p></details></section>}
      </section>
      <ReaderPanel room={room} member={member} role={role} busy={busy} onAction={onAction} />
    </div>
    <div className="workspace-footer"><p>Meet together. Check the copies. Pass on a good story.</p><span>Revision {room.revision} <span>·</span> <a href="/about">Privacy & project notes</a></span>{role.kind === "host" && <button className="text-button" onClick={(event) => { event.currentTarget.focus(); setDeleteConfirm(true); }}>Delete circle</button>}</div>
    {share && <ShareDialog room={room} token={token} memberTokens={memberTokens} onClose={() => setShare(false)} />}
    {deleteConfirm && <div className="modal-backdrop"><section ref={deleteDialogRef} tabIndex={-1} className="share-dialog small-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title"><Trash2 size={25} /><h2 id="delete-title">Delete this circle?</h2><p>This removes its books, favorites, choices and approvals from the app's database. The invitation links will stop working.</p><div className="hero-actions"><button className="button secondary" onClick={() => setDeleteConfirm(false)}>Keep the circle</button><button className="button danger" disabled={busy} onClick={onDelete}>Delete circle</button></div></section></div>}
  </main>;
}

function ArrowUpRightIcon() { return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>; }
