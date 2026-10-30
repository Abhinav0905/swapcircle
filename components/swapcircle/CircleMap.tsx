import type { ExchangeRoom, SwapEdge } from "@/lib/domain/types";
import { BookCover } from "./BookCover";

export function CircleMap({ room, selectedId, onSelect }: { room: ExchangeRoom; selectedId: string; onSelect: (id: string) => void }) {
  const members = room.members;
  const positions = new Map(members.map((member, index) => {
    const angle = (-90 + index * 360 / members.length) * Math.PI / 180;
    return [member.id, { x: 50 + 34 * Math.cos(angle), y: 50 + 34 * Math.sin(angle) }];
  }));
  const cycles = room.plan?.cycles ?? [];
  const palette = ["#315F4A", "#BA7649", "#77729B", "#527E96"];
  function edgePath(edge: SwapEdge) {
    const from = positions.get(edge.giverId)!;
    const to = positions.get(edge.recipientId)!;
    const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy);
    const start = { x: from.x + dx / distance * 9, y: from.y + dy / distance * 10 };
    const end = { x: to.x - dx / distance * 10, y: to.y - dy / distance * 11 };
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const bend = { x: mid.x * .7 + 50 * .3 - dy * .1, y: mid.y * .7 + 50 * .3 + dx * .1 };
    return `M ${start.x} ${start.y} Q ${bend.x} ${bend.y} ${end.x} ${end.y}`;
  }
  return <div className="circle-map" aria-label="Book exchange map">
    <svg className="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>{palette.map((color, i) => <marker key={color} id={`arrow-${i}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke={color} strokeWidth="1.8" /></marker>)}</defs>
      <circle className="map-orbit" cx="50" cy="50" r="34" />
      {cycles.map((cycle, i) => cycle.edges.map((edge) => <path key={`${cycle.id}-${edge.bookId}`} className="exchange-line" d={edgePath(edge)} stroke={palette[i % palette.length]} strokeWidth=".55" markerEnd={`url(#arrow-${i % palette.length})`} />))}
    </svg>
    <div className="map-center"><span className="small-leaf">↺</span><strong>{room.plan?.matchedCount ?? "—"}<small> / {members.filter((m) => m.active).length}</small></strong><span>{room.plan?.matchedCount ? "readers connected" : "a new chapter awaits"}</span></div>
    {members.map((member) => {
      const point = positions.get(member.id)!;
      const matched = room.plan?.matchedMemberIds.includes(member.id);
      return <button key={member.id} onClick={() => onSelect(member.id)} className={`map-member ${selectedId === member.id ? "selected" : ""} ${member.active ? "" : "withdrawn"}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-label={`View ${member.name}'s book and choices`} aria-pressed={selectedId === member.id}>
        <BookCover book={member.offer} small /><span className="map-name"><i style={{ background: member.color }}>{member.name[0]}</i>{member.name}{matched && <b aria-label="In an exchange">✓</b>}</span>
      </button>;
    })}
    <div className="map-caption"><span className="legend-line" /> Arrows follow the books, not the wishlists.</div>
  </div>;
}
