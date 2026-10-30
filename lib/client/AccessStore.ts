import type { RoomRole } from "../domain/types";

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SavedAccess {
  token: string;
  memberTokens: Record<string, string>;
}

const validToken = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);

/** Host invitations persist separately; each browser tab keeps its active role. */
export class AccessStore {
  private readonly memory = new Map<string, string>();

  constructor(private readonly local?: StoragePort, private readonly session?: StoragePort) {}

  read(id: string, suppliedToken: string | null = null): SavedAccess | null {
    if (!validId(id)) return null;
    if (suppliedToken !== null && !validToken(suppliedToken)) return null;
    const host = this.parse(this.get(this.local, this.hostKey(id)));
    const active = this.parse(this.get(this.session, this.activeKey(id)));
    // Older releases used one shared record. Read it for migration, but never
    // write a member token over it or remove it while importing a reader link.
    const legacy = this.parse(this.get(this.local, `swapcircle-access-${id}`));
    const token = suppliedToken?.toLowerCase() ?? active?.token ?? host?.token ?? legacy?.token;
    if (!token) return null;
    const invitations = host?.token === token ? host.memberTokens : legacy?.token === token ? legacy.memberTokens : {};
    return { token, memberTokens: { ...invitations } };
  }

  /** The role must come from an authenticated server response, never URL data. */
  remember(id: string, access: SavedAccess, role: RoomRole): boolean {
    if (!validId(id) || !validToken(access.token)) return false;
    const token = access.token.toLowerCase();
    const activeSaved = this.set(this.session, this.activeKey(id), JSON.stringify({ version: 1, token }));
    if (role.kind !== "host") return activeSaved;
    const previous = this.parse(this.get(this.local, this.hostKey(id)));
    const memberTokens = this.tokens(access.memberTokens);
    const merged = previous?.token === token ? { ...previous.memberTokens, ...memberTokens } : memberTokens;
    const hostSaved = this.set(this.local, this.hostKey(id), JSON.stringify({ version: 1, token, memberTokens: merged }));
    return activeSaved || hostSaved;
  }

  getLastCircle(): string | null {
    const id = this.get(this.local, "swapcircle-last");
    return validId(id) ? id : null;
  }

  setLastCircle(id: string): void {
    if (validId(id)) this.set(this.local, "swapcircle-last", id);
  }

  forget(id: string): void {
    if (!validId(id)) return;
    this.remove(this.local, this.hostKey(id));
    this.remove(this.local, `swapcircle-access-${id}`);
    this.remove(this.session, this.activeKey(id));
    if (this.getLastCircle() === id) this.remove(this.local, "swapcircle-last");
  }

  private hostKey(id: string): string { return `swapcircle-host-${id}`; }
  private activeKey(id: string): string { return `swapcircle-active-${id}`; }

  private parse(raw: string | null): SavedAccess | null {
    if (!raw) return null;
    try {
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const record = value as Record<string, unknown>;
      if (!validToken(record.token)) return null;
      return { token: record.token.toLowerCase(), memberTokens: this.tokens(record.memberTokens) };
    } catch { return null; }
  }

  private tokens(value: unknown): Record<string, string> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id, token]) => validId(id) && validToken(token)).map(([id, token]) => [id, (token as string).toLowerCase()]));
  }

  private get(storage: StoragePort | undefined, key: string): string | null {
    try {
      if (storage) {
        const value = storage.getItem(key);
        if (value !== null) return value;
      }
    } catch { /* A blocked storage API must not prevent opening an invitation. */ }
    return this.memory.get(key) ?? null;
  }

  private set(storage: StoragePort | undefined, key: string, value: string): boolean {
    try {
      if (storage) { storage.setItem(key, value); this.memory.delete(key); return true; }
    } catch { /* Keep this page usable; callers retain the token in the URL. */ }
    this.memory.set(key, value);
    return false;
  }

  private remove(storage: StoragePort | undefined, key: string): void {
    this.memory.delete(key);
    try { storage?.removeItem(key); } catch { /* Deletion already revoked the server credential. */ }
  }
}
