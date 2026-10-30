import type { RoomRole } from "../domain/types";

export interface CredentialRecord { hash: string; role: RoomRole }

/** Opaque, revocable room credentials. Only SHA-256 digests reach storage. */
export class CapabilityService {
  issue(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async hash(token: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async identify(token: string, credentials: CredentialRecord[]): Promise<RoomRole | null> {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const hash = await this.hash(token);
    return credentials.find((credential) => credential.hash === hash)?.role ?? null;
  }
}
