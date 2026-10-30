"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2, BookOpen, Loader2 } from "lucide-react";
import type { EntityType, Member, TasteEntity } from "@/lib/domain/types";
import { EntitySearch } from "./EntitySearch";

const COLORS = ["#E4A087", "#A9BD9B", "#AAB9D4", "#E4C885", "#C8B3D2", "#D6B5A1", "#ADC7BE", "#D5B4C0"];
const BOOK_COLORS = ["#7E3544", "#305E48", "#567D88", "#B17D38", "#6E5B79", "#BA6048", "#426D64", "#92596B"];
interface ReaderDraft { id: string; name: string; book: TasteEntity | null; seeds: TasteEntity[]; condition: string }

export function CircleBuilder({ configured, onBack, onCreate, busy }: {
  configured: boolean; onBack: () => void; onCreate: (title: string, members: Member[]) => void; busy: boolean;
}) {
  const [title, setTitle] = useState("Our book circle");
  const [readers, setReaders] = useState<ReaderDraft[]>([{ id: "reader-1", name: "", book: null, seeds: [], condition: "Paperback · good condition" }]);
  const [selected, setSelected] = useState(0);
  const [seedType, setSeedType] = useState<EntityType>("movie");
  const [seedKey, setSeedKey] = useState(0);
  const reader = readers[selected];
  const update = (patch: Partial<ReaderDraft>) => setReaders((current) => current.map((item, i) => i === selected ? { ...item, ...patch } : item));
  const valid = readers.length >= 2 && readers.every((item) => item.name.trim() && item.book && item.seeds.length);
  function create() {
    if (!valid) return;
    const members = readers.map((item, index): Member => ({ id: item.id, name: item.name.trim(), color: COLORS[index],
      active: true, seeds: item.seeds, offer: { id: `offer-${item.id}`, ownerId: item.id, title: item.book!.name,
        author: item.book!.subtitle ?? "", entityId: item.book!.id, condition: item.condition,
        color: BOOK_COLORS[index], available: true } }));
    onCreate(title.trim(), members);
  }
  return <main className="builder-page">
    <button className="text-button" onClick={onBack}><ArrowLeft size={16} /> Back to SwapCircle</button>
    <div className="builder-intro"><span className="eyebrow">MAKE ROOM FOR A NEW READ</span><h1>Bring your people.<br /><em>We'll find the circle.</em></h1><p>Two to eight readers. One book each. Add their favorites with permission, then share private links so they can make their own choices.</p></div>
    {!configured && <div className="notice pending"><BookOpen size={21} /><div><strong>Live taste matching is waiting for Qloo access.</strong><p>The sample circle is ready to explore. Live search will be available when the service is connected.</p></div></div>}
    <section className="builder-card">
      <div className="builder-top"><label className="field-label">Circle name<input maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} /></label><span>{readers.length} / 8 readers</span></div>
      <div className="reader-tabs">{readers.map((item, index) => <button className={selected === index ? "active" : ""} onClick={() => setSelected(index)} key={item.id}><span style={{ background: COLORS[index] }}>{index + 1}</span>{item.name || `Reader ${index + 1}`}</button>)}{readers.length < 8 && <button onClick={() => { setReaders([...readers, { id: `reader-${crypto.randomUUID().slice(0, 8)}`, name: "", book: null, seeds: [], condition: "Paperback · good condition" }]); setSelected(readers.length); }}><Plus size={16} /> Add reader</button>}</div>
      <div className="builder-fields" key={reader.id}>
        <div><label className="field-label">Reader's first name<input maxLength={50} value={reader.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Maya" /></label><EntitySearch type="book" value={reader.book} onSelect={(book) => update({ book })} label="The book they're ready to pass on" /><label className="field-label">Condition or edition<input maxLength={240} value={reader.condition} onChange={(e) => update({ condition: e.target.value })} /></label></div>
        <div><label className="field-label" htmlFor="favorite-kind">Something they love</label><select id="favorite-kind" value={seedType} onChange={(e) => { setSeedType(e.target.value as EntityType); setSeedKey(seedKey + 1); }}><option value="movie">A film</option><option value="artist">A musician</option><option value="book">A book</option><option value="tv_show">A TV show</option><option value="podcast">A podcast</option><option value="videogame">A game</option></select>
          {reader.seeds.length < 4 && <EntitySearch key={`${reader.id}-${seedKey}`} type={seedType} value={null} label="Choose the exact match" onSelect={(entity) => { if (entity && !reader.seeds.some((s) => s.id === entity.id)) { update({ seeds: [...reader.seeds, entity] }); setSeedKey(seedKey + 1); } }} />}
          <div className="chosen-seeds">{reader.seeds.map((entity) => <button key={entity.id} onClick={() => update({ seeds: reader.seeds.filter((s) => s.id !== entity.id) })}>{entity.name}<span aria-label="Remove">×</span></button>)}</div><p className="field-hint">Add 1–4 favorites. Qloo uses these to suggest books from this circle. Each reader still chooses what they'd accept.</p>
        </div>
      </div>
      <div className="builder-bottom">{readers.length > 1 ? <button className="text-button danger-text" onClick={() => { setReaders(readers.filter((_, i) => i !== selected)); setSelected(0); }}><Trash2 size={15} /> Remove reader</button> : <span className="muted">Add at least two readers to begin.</span>}<button className="button primary" disabled={!configured || !valid || !title.trim() || busy} onClick={create}>{busy ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />} Create our circle</button></div>
    </section>
  </main>;
}
