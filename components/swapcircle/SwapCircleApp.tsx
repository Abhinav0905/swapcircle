"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, X, Loader2 } from "lucide-react";
import type { Member, RoomAction, RoomSession } from "@/lib/domain/types";
import { RoomClient } from "@/lib/client/RoomClient";
import { AccessStore, type StoragePort } from "@/lib/client/AccessStore";
import { ExchangeExport } from "@/lib/client/ExchangeExport";
import { LandingPage } from "./LandingPage";
import { CircleBuilder } from "./CircleBuilder";
import { ExchangeWorkspace } from "./ExchangeWorkspace";

function browserStorage(kind: "localStorage" | "sessionStorage"): StoragePort | undefined {
  try { return window[kind]; } catch { return undefined; }
}

export function SwapCircleApp() {
  const [view, setView] = useState<"home" | "builder" | "circle">("home");
  const [session, setSession] = useState<RoomSession | null>(null);
  const [token, setToken] = useState("");
  const [memberTokens, setMemberTokens] = useState<Record<string, string>>({});
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastCircle, setLastCircle] = useState<string | null>(null);
  const access = useRef<AccessStore | null>(null);
  const navigationVersion = useRef(0);
  const accessStore = useCallback(() => {
    access.current ??= new AccessStore(browserStorage("localStorage"), browserStorage("sessionStorage"));
    return access.current;
  }, []);

  const loadCircle = useCallback(async (id: string) => {
    const navigation = ++navigationVersion.current;
    setLoading(true); setBusy(false); setError("");
    try {
      const hashToken = new URLSearchParams(window.location.hash.slice(1)).get("key");
      const saved = accessStore().read(id, hashToken);
      if (!saved) throw new Error("This circle needs a private invitation link. Ask the host to share your reader link.");
      const result = await new RoomClient(saved.token).read(id);
      if (navigation !== navigationVersion.current) return;
      const invites = result.role.kind === "host" ? saved.memberTokens : {};
      const persisted = accessStore().remember(id, { token: saved.token, memberTokens: invites }, result.role);
      setToken(saved.token); setMemberTokens(invites); setSession(result); setView("circle");
      accessStore().setLastCircle(id); setLastCircle(id);
      window.history.replaceState({}, "", `/circle/${id}${persisted ? "" : `#key=${saved.token}`}`);
    } catch (err) {
      if (navigation === navigationVersion.current) { setSession(null); setView("home"); setError(err instanceof Error ? err.message : "The circle could not be opened."); }
    } finally { if (navigation === navigationVersion.current) setLoading(false); }
  }, [accessStore]);

  useEffect(() => {
    fetch("/api/status").then((response) => response.json() as Promise<{ qlooConfigured: boolean }>).then((status) => setConfigured(status.qlooConfigured)).catch(() => setConfigured(false));
    setLastCircle(accessStore().getLastCircle());
    const match = window.location.pathname.match(/^\/circle\/([a-zA-Z0-9_-]+)$/);
    if (match) void loadCircle(match[1]);
    const pop = () => { const current = window.location.pathname.match(/^\/circle\/([a-zA-Z0-9_-]+)$/); if (current) void loadCircle(current[1]); else { navigationVersion.current++; setBusy(false); setLoading(false); setView("home"); } };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [loadCircle, accessStore]);

  function home() { navigationVersion.current++; setLoading(false); setBusy(false); setView("home"); setError(""); window.history.pushState({}, "", "/"); }
  function startBuilder() { navigationVersion.current++; setLoading(false); setBusy(false); setView("builder"); setError(""); window.history.pushState({}, "", "/"); }

  async function create(mode: "demo" | "live", title?: string, members?: Member[]) {
    const navigation = ++navigationVersion.current;
    setBusy(true); setError("");
    try {
      const result = await new RoomClient().create(mode, title, members);
      const persisted = accessStore().remember(result.room.id, { token: result.hostToken, memberTokens: result.memberTokens }, result.role);
      accessStore().setLastCircle(result.room.id);
      if (navigation !== navigationVersion.current) return;
      setLastCircle(result.room.id);
      setToken(result.hostToken); setMemberTokens(result.memberTokens); setSession(result); setView("circle");
      window.history.pushState({}, "", `/circle/${result.room.id}${persisted ? "" : `#key=${result.hostToken}`}`);
      const ranked = await new RoomClient(result.hostToken).act(result.room.id, result.room.revision, { type: "rank" });
      if (navigation === navigationVersion.current) setSession(ranked);
    } catch (err) { if (navigation === navigationVersion.current) setError(err instanceof Error ? err.message : "The circle could not be created."); }
    finally { if (navigation === navigationVersion.current) setBusy(false); }
  }

  async function act(action: RoomAction) {
    if (!session || busy) return;
    const navigation = navigationVersion.current;
    setBusy(true); setError("");
    try { const updated = await new RoomClient(token).act(session.room.id, session.room.revision, action); if (navigation === navigationVersion.current) setSession(updated); }
    catch (err) {
      if (navigation !== navigationVersion.current) return;
      setError(err instanceof Error ? err.message : "That change could not be saved.");
      try { const current = await new RoomClient(token).read(session.room.id); if (navigation === navigationVersion.current) setSession(current); } catch { /* Keep the original error. */ }
    } finally { if (navigation === navigationVersion.current) setBusy(false); }
  }

  async function refresh() {
    if (!session || busy) return;
    const navigation = navigationVersion.current;
    setBusy(true); setError("");
    try { const current = await new RoomClient(token).read(session.room.id); if (navigation === navigationVersion.current) setSession(current); }
    catch (err) { if (navigation === navigationVersion.current) setError(err instanceof Error ? err.message : "Refresh failed."); }
    finally { if (navigation === navigationVersion.current) setBusy(false); }
  }

  async function exportCurrent() {
    if (!session || busy) return;
    const navigation = navigationVersion.current;
    setBusy(true); setError("");
    try {
      const current = await new RoomClient(token).read(session.room.id);
      if (navigation !== navigationVersion.current) return;
      setSession(current);
      ExchangeExport.download(current.room);
    } catch (err) { if (navigation === navigationVersion.current) setError(err instanceof Error ? err.message : "The current proposal could not be exported."); }
    finally { if (navigation === navigationVersion.current) setBusy(false); }
  }

  async function remove() {
    if (!session || busy) return;
    const navigation = navigationVersion.current;
    setBusy(true); setError("");
    try {
      await new RoomClient(token).remove(session.room.id);
      accessStore().forget(session.room.id);
      if (navigation !== navigationVersion.current) return;
      setSession(null); setLastCircle(null); setToken(""); setMemberTokens({}); home();
    } catch (err) { if (navigation === navigationVersion.current) setError(err instanceof Error ? err.message : "The circle could not be deleted."); }
    finally { if (navigation === navigationVersion.current) setBusy(false); }
  }

  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header"><button className="brand" onClick={home} aria-label="SwapCircle home"><span className="brand-mark">s<span>↗</span></span>SwapCircle<span className="brand-dot">.</span></button><nav aria-label="Main navigation"><a href="/#how-it-works" onClick={(event) => { if (view !== "home") { event.preventDefault(); home(); setTimeout(() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" }), 30); } }}>How it works</a><a href="/about">The idea</a>{view === "home" && lastCircle && <button className="text-button" onClick={() => void loadCircle(lastCircle)}>Your last circle <ArrowUpRight size={14} /></button>}<button className="button nav-button" onClick={startBuilder}>Start a circle <ArrowUpRight size={15} /></button></nav></header>
    {error && <div className="error-toast" role="alert"><span>{error}</span><button className="icon-button" onClick={() => setError("")} aria-label="Dismiss error"><X size={17} /></button></div>}
    {busy && view === "circle" && <div className="working-indicator" role="status"><Loader2 className="spin" size={15} /> Updating your circle…</div>}
    <div id="main-content" tabIndex={-1}>{loading ? <main className="loading-page"><Loader2 size={32} className="spin" /><h1>Opening your circle…</h1></main> : view === "circle" && session ? <ExchangeWorkspace key={session.room.id} room={session.room} role={session.role} token={token} memberTokens={memberTokens} busy={busy} onAction={(action) => void act(action)} onRefresh={() => void refresh()} onExport={() => void exportCurrent()} onHome={home} onDelete={() => void remove()} /> : view === "builder" ? <CircleBuilder configured={configured} onBack={home} onCreate={(title, members) => void create("live", title, members)} busy={busy} /> : <LandingPage onDemo={() => void create("demo")} onCreate={startBuilder} busy={busy} configured={configured} />}</div>
  </>;
}
