"use client";
import { useEffect, useState } from "react";
import { Search, Check, Loader2, X } from "lucide-react";
import { RoomClient } from "@/lib/client/RoomClient";
import type { EntityType, TasteEntity } from "@/lib/domain/types";

export function EntitySearch({ type, value, onSelect, label }: {
  type: EntityType; value: TasteEntity | null; onSelect: (entity: TasteEntity | null) => void; label: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TasteEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setResults([]); setError("");
    if (query.trim().length < 2 || value) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const found = await RoomClient.search(query.trim(), type, controller.signal);
        if (!controller.signal.aborted) setResults(found);
      }
      catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Search unavailable."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, type, value]);
  return <div className="entity-search">
    <label className="field-label">{label}</label>
    {value ? <div className="entity-selected"><Check size={16} /><span>{value.name}<small>{value.subtitle}</small></span><button type="button" className="icon-button" aria-label={`Change ${label}`} onClick={() => { onSelect(null); setQuery(""); }}><X size={15} /></button></div> : <>
      <div className="search-field"><Search size={17} /><input aria-label={label} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={type === "book" ? "Search for a book title…" : "Search for a favorite…"} autoComplete="off" />{loading && <Loader2 size={16} className="spin" />}</div>
      {results.length > 0 && <div className="search-results" role="listbox" aria-label={`${label} results`}>{results.map((entity) => <button type="button" role="option" aria-selected={false} key={entity.id} onClick={() => onSelect(entity)}><span>{entity.name}<small>{entity.subtitle || entity.type.replace("_", " ")}</small></span><Check size={14} /></button>)}</div>}
      {!loading && query.length >= 2 && !results.length && !error && <small className="muted">No matching titles yet. Try a longer or different name.</small>}
      {error && <small className="form-error" role="alert">{error}</small>}
    </>}
  </div>;
}
