"use client";
import { useState } from "react";
import { X, Copy, Check, Link2, ShieldCheck } from "lucide-react";
import type { ExchangeRoom } from "@/lib/domain/types";
import { useDialogFocus } from "./useDialogFocus";

export function ShareDialog({ room, token, memberTokens, onClose }: { room: ExchangeRoom; token: string; memberTokens: Record<string, string>; onClose: () => void }) {
  const [copied, setCopied] = useState("");
  const dialogRef = useDialogFocus(onClose);
  const url = (key: string) => `${window.location.origin}/circle/${room.id}#key=${key}`;
  async function copy(id: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(id); }
    catch { setCopied("failed"); }
  }
  return <div className="modal-backdrop" onClick={onClose}><section ref={dialogRef} tabIndex={-1} className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(event) => event.stopPropagation()}>
    <button className="icon-button close-modal" aria-label="Close invitations" onClick={onClose}><X size={20} /></button>
    <span className="eyebrow">A SEAT AT YOUR TABLE</span><h2 id="share-title">Invite your readers.</h2><p>Each link belongs to one person. It lets them review suggestions and approve their own exchange. Share it privately.</p>
    {room.mode === "demo" && <div className="notice compact">These are demonstration accounts. Responses remain simulated, even through separate links.</div>}
    <div className="invite-list">{room.members.map((member) => <div key={member.id}><span className="avatar" style={{ background: member.color }}>{member.name[0]}</span><strong>{member.name}</strong>{memberTokens[member.id] ? <button className="button small secondary" onClick={() => copy(member.id, url(memberTokens[member.id]))}>{copied === member.id ? <Check size={14} /> : <Copy size={14} />}{copied === member.id ? "Copied" : "Copy private link"}</button> : <small>Invite saved on the creating device.</small>}</div>)}</div>
    <div className="host-link"><ShieldCheck size={19} /><div><strong>Keep your host link</strong><p>This link manages the circle. Don't use it as a reader invitation.</p></div><button className="icon-button" aria-label="Copy private host link" onClick={() => copy("host", url(token))}>{copied === "host" ? <Check size={18} /> : <Link2 size={18} />}</button></div>
    {copied === "failed" && <p className="form-error">Clipboard access was unavailable. Open this page in a browser that allows copying, then try again.</p>}
  </section></div>;
}
