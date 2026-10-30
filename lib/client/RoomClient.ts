import type { CreatedRoom, Member, RoomAction, RoomSession, TasteEntity, EntityType } from "../domain/types";

export class RoomClient {
  constructor(private readonly token = "") {}

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options, headers: { "Content-Type": "application/json", ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...options.headers },
    });
    const result = await response.json() as { error?: string | { message?: string }; message?: string };
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : result.error?.message ?? result.message ?? "Something went wrong. Please try again.");
    return result as T;
  }

  create(mode: "demo" | "live", title?: string, members?: Member[]): Promise<CreatedRoom> {
    return this.request("/api/rooms", { method: "POST", body: JSON.stringify({ mode, ...(title ? { title } : {}), ...(members ? { members } : {}) }) });
  }
  read(id: string): Promise<RoomSession> { return this.request(`/api/rooms/${encodeURIComponent(id)}`); }
  act(id: string, revision: number, action: RoomAction): Promise<RoomSession> {
    return this.request(`/api/rooms/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ revision, action }) });
  }
  remove(id: string): Promise<{ deleted: boolean }> { return this.request(`/api/rooms/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  static async search(query: string, type: EntityType, signal?: AbortSignal): Promise<TasteEntity[]> {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=${type}`, { signal });
    const result = await response.json() as { error?: string | { message?: string }; entities?: TasteEntity[] };
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : result.error?.message ?? "Search is unavailable right now.");
    return result.entities ?? [];
  }
}
