import type { ExchangeRoom, Member, TasteEntity } from "../domain/types";

const seed = (name: string, type: TasteEntity["type"]): TasteEntity => ({
  id: `fixture-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name, type,
});

/** Original teaching scenario. Names and rankings are illustrative, never Qloo results. */
export class DemoFactory {
  static members(): Member[] {
    const rows: [string, string, string, string, string, string, TasteEntity[]][] = [
      ["maya", "Maya", "#E4A087", "The Left Hand of Darkness", "Ursula K. Le Guin", "#7E3544", [seed("Arrival", "movie"), seed("Björk", "artist")]],
      ["leo", "Leo", "#A9BD9B", "The Overstory", "Richard Powers", "#305E48", [seed("Princess Mononoke", "movie"), seed("Bon Iver", "artist")]],
      ["noor", "Noor", "#AAB9D4", "Piranesi", "Susanna Clarke", "#567D88", [seed("Amélie", "movie"), seed("Ólafur Arnalds", "artist")]],
      ["jules", "Jules", "#E4C885", "A Psalm for the Wild-Built", "Becky Chambers", "#B17D38", [seed("Kiki's Delivery Service", "movie"), seed("Khruangbin", "artist")]],
      ["iris", "Iris", "#C8B3D2", "Braiding Sweetgrass", "Robin Wall Kimmerer", "#6E5B79", [seed("My Neighbor Totoro", "movie"), seed("The Hidden Life of Trees", "book")]],
      ["sam", "Sam", "#D6B5A1", "The Dispossessed", "Ursula K. Le Guin", "#BA6048", [seed("Blade Runner", "movie"), seed("Radiohead", "artist")]],
    ];
    return rows.map(([id, name, color, title, author, bookColor, seeds]) => ({
      id, name, color, seeds, active: true,
      offer: { id: `book-${id}`, ownerId: id, title, author,
        entityId: `fixture-book-${id}`, color: bookColor, available: true,
        condition: "Paperback · good condition" },
    }));
  }

  static create(): ExchangeRoom {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(), title: "Sunday book circle", mode: "demo", revision: 0,
      createdAt: now, members: this.members(), rankings: [], plan: null,
      approvals: [], question: null,
      choices: [
        ["maya", "leo"], ["leo", "noor"], ["jules", "maya"], ["iris", "sam"], ["sam", "iris"],
      ].map(([memberId, owner]) => ({ memberId, bookId: `book-${owner}`, value: "yes", updatedAt: now })),
      events: [{ id: crypto.randomUUID(), at: now, tool: "load_demo", status: "complete",
        summary: "Six readers, six books, one open question.",
        detail: "Fictional participants and authored rankings. Existing reading choices are simulated. No Qloo calls have been made." }],
    };
  }
}
