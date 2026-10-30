import assert from "node:assert/strict";
import test from "node:test";
import { AccessStore, type StoragePort } from "@/lib/client/AccessStore";

class FakeStorage implements StoragePort {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}

const hostToken = "a".repeat(64);
const mayaToken = "b".repeat(64);
const leoToken = "c".repeat(64);
const room = "circle-1";
const hostAccess = { token: hostToken, memberTokens: { maya: mayaToken, leo: leoToken } };

test("opening a member invitation in another tab preserves the host capability and all invitations", () => {
  const local = new FakeStorage();
  const hostSession = new FakeStorage();
  const memberSession = new FakeStorage();
  const host = new AccessStore(local, hostSession);
  assert.equal(host.remember(room, hostAccess, { kind: "host" }), true);
  const hostSnapshot = local.getItem(`swapcircle-host-${room}`);
  const member = new AccessStore(local, memberSession);
  const invitation = member.read(room, mayaToken)!;
  assert.deepEqual(invitation, { token: mayaToken, memberTokens: {} });
  member.remember(room, invitation, { kind: "member", memberId: "maya" });
  assert.equal(local.getItem(`swapcircle-host-${room}`), hostSnapshot);
  assert.deepEqual(host.read(room), hostAccess);
  assert.deepEqual(member.read(room), { token: mayaToken, memberTokens: {} });
});

test("host and member refreshes preserve each tab's active role", () => {
  const local = new FakeStorage();
  const hostSession = new FakeStorage();
  const memberSession = new FakeStorage();
  new AccessStore(local, hostSession).remember(room, hostAccess, { kind: "host" });
  new AccessStore(local, memberSession).remember(room, { token: mayaToken, memberTokens: {} }, { kind: "member", memberId: "maya" });
  assert.deepEqual(new AccessStore(local, hostSession).read(room), hostAccess);
  assert.equal(new AccessStore(local, memberSession).read(room)!.token, mayaToken);
  assert.deepEqual(new AccessStore(local, new FakeStorage()).read(room), hostAccess);
});

test("a second member link changes only that tab and cannot erase host invitations", () => {
  const local = new FakeStorage();
  const session = new FakeStorage();
  const access = new AccessStore(local, session);
  access.remember(room, hostAccess, { kind: "host" });
  access.remember(room, access.read(room, mayaToken)!, { kind: "member", memberId: "maya" });
  access.remember(room, access.read(room, leoToken)!, { kind: "member", memberId: "leo" });
  assert.equal(access.read(room)!.token, leoToken);
  assert.deepEqual(access.read(room, hostToken), hostAccess);
  access.remember(room, access.read(room, hostToken)!, { kind: "host" });
  assert.deepEqual(access.read(room), hostAccess);
});

test("a host reload without an invitation map retains its saved invitations", () => {
  const local = new FakeStorage();
  const access = new AccessStore(local, new FakeStorage());
  access.remember(room, hostAccess, { kind: "host" });
  access.remember(room, { token: hostToken, memberTokens: {} }, { kind: "host" });
  assert.deepEqual(access.read(room), hostAccess);
});

test("bad JSON, missing tokens and malformed explicit links fail without throwing", () => {
  const local = new FakeStorage();
  const session = new FakeStorage();
  const access = new AccessStore(local, session);
  for (const raw of ["{broken", "null", "[]", "{}", '{"token":17}', '{"token":"short"}']) {
    local.setItem(`swapcircle-host-${room}`, raw);
    session.setItem(`swapcircle-active-${room}`, raw);
    assert.equal(access.read(room), null);
    assert.deepEqual(access.read(room, mayaToken), { token: mayaToken, memberTokens: {} });
  }
  access.remember(room, hostAccess, { kind: "host" });
  assert.equal(access.read(room, "not-a-token"), null);
  assert.equal(access.read(room, ""), null);
  assert.equal(access.read("../../outside", hostToken), null);
  assert.equal(access.remember(room, { token: "invalid", memberTokens: {} }, { kind: "host" }), false);
});

test("saved invitation maps discard invalid entries without losing valid members", () => {
  const local = new FakeStorage();
  local.setItem(`swapcircle-host-${room}`, JSON.stringify({ token: hostToken, memberTokens: { maya: mayaToken, bad: 12, short: "x", "invalid id": leoToken } }));
  const access = new AccessStore(local, new FakeStorage());
  assert.deepEqual(access.read(room), { token: hostToken, memberTokens: { maya: mayaToken } });
  const prototypeTokenMap = JSON.parse(`{"__proto__":"${leoToken}"}`) as Record<string, string>;
  access.remember(room, { token: hostToken, memberTokens: prototypeTokenMap }, { kind: "host" });
  assert.ok(Object.hasOwn(access.read(room)!.memberTokens, "__proto__"));
  assert.equal(access.read(room)!.memberTokens.__proto__, leoToken);
});

test("legacy shared access is readable and a member import does not overwrite it", () => {
  const local = new FakeStorage();
  const legacy = JSON.stringify(hostAccess);
  local.setItem(`swapcircle-access-${room}`, legacy);
  const access = new AccessStore(local, new FakeStorage());
  assert.deepEqual(access.read(room), hostAccess);
  access.remember(room, access.read(room, mayaToken)!, { kind: "member", memberId: "maya" });
  assert.equal(local.getItem(`swapcircle-access-${room}`), legacy);
  assert.deepEqual(new AccessStore(local, new FakeStorage()).read(room), hostAccess);
  const hostTab = new AccessStore(local, new FakeStorage());
  hostTab.remember(room, hostTab.read(room)!, { kind: "host" });
  assert.ok(local.getItem(`swapcircle-host-${room}`));
});

test("blocked storage still permits invitation access for the current page", () => {
  const blocked: StoragePort = {
    getItem() { throw new Error("Storage blocked"); },
    setItem() { throw new Error("Storage blocked"); },
    removeItem() { throw new Error("Storage blocked"); },
  };
  const access = new AccessStore(blocked, blocked);
  const candidate = access.read(room, mayaToken)!;
  assert.equal(access.remember(room, candidate, { kind: "member", memberId: "maya" }), false);
  assert.deepEqual(access.read(room), { token: mayaToken, memberTokens: {} });
  access.setLastCircle(room);
  assert.equal(access.getLastCircle(), room);
  assert.doesNotThrow(() => access.forget(room));
  assert.equal(access.read(room), null);
});

test("a write quota failure uses page memory even when reads still work", () => {
  const full: StoragePort = { getItem() { return null; }, setItem() { throw new Error("Quota exceeded"); }, removeItem() {} };
  const access = new AccessStore(full, full);
  assert.equal(access.remember(room, hostAccess, { kind: "host" }), false);
  assert.deepEqual(access.read(room), hostAccess);
});

test("forgetting one circle leaves a different last circle and its access intact", () => {
  const access = new AccessStore(new FakeStorage(), new FakeStorage());
  access.remember(room, hostAccess, { kind: "host" });
  access.remember("circle-2", hostAccess, { kind: "host" });
  access.setLastCircle("circle-2");
  access.forget(room);
  assert.equal(access.read(room), null);
  assert.deepEqual(access.read("circle-2"), hostAccess);
  assert.equal(access.getLastCircle(), "circle-2");
  access.forget("circle-2");
  assert.equal(access.getLastCircle(), null);
});
