#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Real provider verification through the deployed app. All reader inputs are
// synthetic. The Qloo key stays on the server; room capabilities stay in memory.
const SCENARIO = [
  { name: "Test Maya", book: "The Left Hand of Darkness", author: "Ursula K. Le Guin", favorite: "Arrival", color: "#7E3544" },
  { name: "Test Leo", book: "The Overstory", author: "Richard Powers", favorite: "Princess Mononoke", color: "#305E48" },
  { name: "Test Noor", book: "Piranesi", author: "Susanna Clarke", favorite: "Amélie", color: "#567D88" },
];
const normalize = (value) => value.normalize("NFKD").replace(/\p{M}/gu, "").trim().toLowerCase();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class LiveQlooCheck {
  session = null;

  constructor(url) {
    const parsed = new URL(url);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if ((parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
      throw new Error("Use the app's HTTPS origin, or a loopback development origin.");
    }
    this.origin = parsed.origin;
  }

  async request(path, { method = "GET", token, body } = {}, expectedStatus = 200) {
    let response;
    try {
      response = await fetch(new URL(path, this.origin), {
        method, redirect: "error", signal: AbortSignal.timeout(60_000),
        headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch { throw new Error("A live-check request failed or timed out. No request data was logged."); }
    let data;
    try { data = await response.json(); }
    catch { throw new Error(`The app returned a non-JSON response (${response.status}).`); }
    if (response.status !== expectedStatus) {
      const code = /^[a-z_]{1,48}$/.test(data?.error?.code ?? "") ? data.error.code : "unknown";
      throw new Error(`Live-check request failed (${response.status}, ${code}).`);
    }
    return data;
  }

  async resolve(title, type) {
    const query = new URLSearchParams({ q: title, type });
    const data = await this.request(`/api/search?${query}`);
    const exact = (data.entities ?? []).filter((entity) => entity.type === type && uuid.test(entity.id) && normalize(entity.name) === normalize(title));
    if (exact.length !== 1) throw new Error(`Catalog identity for "${title}" is missing or ambiguous. Inspect typed search before selecting an entity; no first-result fallback was used.`);
    return exact[0];
  }

  async run() {
    const status = await this.request("/api/status");
    if (!status.qlooConfigured) throw new Error("Qloo is not configured on this app. No live-provider verification was performed.");
    const members = [];
    for (const [index, input] of SCENARIO.entries()) {
      const book = await this.resolve(input.book, "book");
      const favorite = await this.resolve(input.favorite, "movie");
      const id = `test-reader-${index + 1}`;
      members.push({ id, name: input.name, color: input.color, active: true, seeds: [favorite],
        offer: { id: randomUUID(), ownerId: id, title: book.name, author: input.author, entityId: book.id, condition: "Synthetic integration-check copy; not offered for a real exchange.", color: input.color, available: true } });
    }
    const created = await this.request("/api/rooms", { method: "POST", body: { mode: "live", title: "Disposable live Qloo check — synthetic readers", members } }, 201);
    if (!uuid.test(created.room?.id ?? "") || !/^[a-f0-9]{64}$/.test(created.hostToken ?? "")) throw new Error("The app returned an invalid test-room session.");
    this.session = { id: created.room.id, token: created.hostToken };
    const ranked = await this.request(`/api/rooms/${this.session.id}`, { method: "POST", token: this.session.token, body: { revision: created.room.revision, action: { type: "rank" } } });
    const room = ranked.room;
    if (room?.mode !== "live" || room.rankings?.length !== members.length || new Set(room.rankings.map((evidence) => evidence.memberId)).size !== members.length) throw new Error("The full live-room ranking was not returned.");
    const profiles = members.map((member) => {
      const evidence = room.rankings.find((item) => item.memberId === member.id);
      const candidates = members.filter((item) => item.id !== member.id).map((item) => item.offer);
      const expected = candidates.map((book) => book.id).sort();
      if (!evidence || evidence.source !== "qloo" || JSON.stringify([...evidence.requestedBookIds].sort()) !== JSON.stringify(expected)) throw new Error("A ranking lacked genuine Qloo provenance or the exact offered-book pool.");
      if (!evidence.entries.length) throw new Error(`Qloo returned no available-book suggestions for ${member.name}. The request succeeded, but useful coverage was not verified.`);
      const returned = evidence.entries.map((entry) => {
        const book = candidates.find((item) => item.id === entry.bookId && item.entityId === entry.entityId);
        if (!book || !Number.isInteger(entry.rank) || entry.rank < 1) throw new Error("An out-of-pool or malformed result entered the room.");
        return { title: book.title, entityId: entry.entityId, rank: entry.rank };
      });
      if (new Set(evidence.entries.map((entry) => entry.bookId)).size !== returned.length) throw new Error("A physical copy appeared twice in a ranking.");
      return { name: member.name, favorites: member.seeds.map(({ name, id, type }) => ({ name, id, type })), offeredBook: { title: member.offer.title, entityId: member.offer.entityId }, source: evidence.source, fetchedAt: evidence.fetchedAt, returned, missingCount: evidence.missingBookIds.length };
    });
    const saved = await this.request(`/api/rooms/${this.session.id}`, { token: this.session.token });
    if (saved.room.revision !== room.revision || JSON.stringify(saved.room.rankings) !== JSON.stringify(room.rankings)) throw new Error("Live evidence was not preserved in the deployed database.");
    if (saved.room.choices.length || saved.room.approvals.length) throw new Error("The verification unexpectedly recorded a reader choice or approval.");
    return { checkedAt: new Date().toISOString(), appOrigin: this.origin, inputKind: "synthetic reader profiles", source: "qloo", catalogEntitiesResolved: members.length * 2, profiles, scope: "Typed search, full inventory-constrained live ranking and database persistence. No satisfaction, exchange or consent claim." };
  }

  async cleanup() {
    if (!this.session) return;
    const { id, token } = this.session;
    const result = await this.request(`/api/rooms/${id}`, { method: "DELETE", token });
    if (result.deleted !== true) throw new Error("Disposable live room cleanup was not confirmed.");
    await this.request(`/api/rooms/${id}`, { token }, 404);
    this.session = null;
  }
}

let check;
let proof;
let failed = false;
try {
  check = new LiveQlooCheck(process.argv[2] ?? "https://swapcircle-books.abhinav-0905.chatgpt.site");
  proof = await check.run();
} catch (error) {
  failed = true;
  console.error(`NOT VERIFIED: ${error instanceof Error ? error.message : "Unexpected live-check failure."}`);
} finally {
  try { await check?.cleanup(); }
  catch { failed = true; console.error("NOT VERIFIED: Disposable live-room cleanup failed. No credentials were logged."); }
}
if (!failed && proof) {
  const directory = new URL("../outputs/", import.meta.url);
  const file = new URL("qloo-live-check.json", directory);
  await mkdir(directory, { recursive: true });
  await writeFile(file, `${JSON.stringify({ ...proof, disposableRoomRemoved: true }, null, 2)}\n`, { mode: 0o600 });
  console.log(`PASS: Real Qloo catalog search, ${proof.profiles.length} inventory-constrained rankings and database persistence. Disposable room removed.`);
  console.log(`Credential-free proof: ${fileURLToPath(file)}`);
} else process.exitCode = 1;
