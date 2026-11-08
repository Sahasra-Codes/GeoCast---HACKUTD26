import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeft, Search, Package, House, Utensils, Cross, Layers, ShieldCheck, ExternalLink, MapPin } from "lucide-react";
import "./ResourcesPage.css";
import { getGeography } from "../services/api";
import { stateOptions } from "../publicDataTypes";
import type { Geography } from "../types";
const categories = [
  { id: "shelter", label: "Shelter", title: "Emergency Shelters", description: "Find open shelters near you", icon: House },
  { id: "food", label: "Food & Water", title: "Food & Water", description: "Distribution sites and hours", icon: Utensils },
  { id: "medical", label: "Medical", title: "Medical Support", description: "Clinics and urgent care locations", icon: Cross },
  { id: "financial", label: "Financial", title: "Financial Assistance", description: "Declarations and disaster assistance", icon: Layers },
  { id: "safety", label: "Safety", title: "Safety Guides", description: "Preparedness and recovery checklists", icon: ShieldCheck },
];
type Item = { title: string; description: string; details?: string; status?: string; phone?: string; url?: string; attributions?: { provider?: string; providerUri?: string }[] };
type Results = { source: string; status: string; retrievedAt: string; note: string; items: Item[] };
export default function ResourcesPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState("");
  const [county, setCounty] = useState("");
  const [geography, setGeography] = useState<Geography>();
  const [geographyError, setGeographyError] = useState("");
  useEffect(() => { getGeography().then(setGeography).catch(() => setGeographyError("County list could not load. Refresh the page to retry.")); }, []);
  const [state, setState] = useState("TX");
  const [submitted, setSubmitted] = useState<{ location: string; state: string; county: string; retry: number }>();
  const [results, setResults] = useState<Results>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const current = categories.find(c => c.id === selected);
  useEffect(() => {
    if (!selected || !submitted) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setResults(undefined);
    fetch(`/api/resources/${selected}?${new URLSearchParams({ location: submitted.location, state: submitted.state, county: submitted.county })}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(typeof data?.detail === "string" ? data.detail : "Resources could not be loaded. Check that FastAPI is running and try again."); } return response.json(); })
      .then(data => { if (!controller.signal.aborted) setResults(data); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, submitted]);
  const counties = (geography?.regions || []).filter(r => r.kind === "county" && r.id.startsWith(stateOptions.find(s => s.code === state)?.fips || "--")).sort((a, b) => a.name.localeCompare(b.name));
  function findResources() {
    const region = counties.find(c => c.id === county);
    if (!region) return;
    setSubmitted({ state, county, location: `${region.coordinates[1]},${region.coordinates[0]}`, retry: Date.now() });
  }
  return <main className="resource-hub">
    <div className="resource-hub-heading"><div className="resource-hub-title"><span className="resource-hub-icon"><Package size={27} /></span><div><h1>Resources</h1><p>Tools, data, and guidance to prepare, respond, and recover.</p></div></div><label className="resource-hub-search"><Search size={17} /><input aria-label="Search resources" placeholder="Search resources..." value={query} onChange={e => setQuery(e.target.value)} /></label></div>
    <nav className="resource-hub-tabs" aria-label="Resource categories">{[{id: "all", label: "All", icon: null}, ...categories].map(c => <button type="button" key={c.id} aria-pressed={filter === c.id} className={filter === c.id ? "active" : ""} onClick={() => { setFilter(c.id); setSelected(""); setResults(undefined); }}>{c.icon && <c.icon size={17} />}{c.label}</button>)}</nav>
    <div className="resource-hub-grid">{categories.filter(c => (filter === "all" || filter === c.id) && `${c.title} ${c.description}`.toLowerCase().includes(query.toLowerCase())).map(c => <button key={c.id} className={`resource-hub-card ${selected === c.id ? "selected" : ""}`} aria-expanded={selected === c.id} onClick={() => { setSelected(c.id); setResults(undefined); setError(""); }}><span className="resource-card-icon"><c.icon size={27} /></span><span><strong>{c.title}</strong><small>{c.description}</small></span><ArrowRight size={18} /></button>)}</div>
    {!categories.some(c => (filter === "all" || filter === c.id) && `${c.title} ${c.description}`.toLowerCase().includes(query.toLowerCase())) && <p className="resource-hub-empty">No resources match your search.</p>}
    {current && <section className="resource-results" aria-label={`${current.title} results`}><div className="resource-results-heading"><h2><current.icon size={22} />{current.title}</h2><button onClick={() => setSelected("")}><ArrowLeft size={15} />Back to categories</button></div>
      <form className="resource-location" onSubmit={e => { e.preventDefault(); findResources(); }}>
        <label><MapPin size={16} />State<select aria-label="Resource state" value={state} onChange={e => { setState(e.target.value); setCounty(""); setSubmitted(undefined); setResults(undefined); setError(""); }}>{stateOptions.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
        <label>County<select aria-label="Resource county" required value={county} disabled={!counties.length} onChange={e => { setCounty(e.target.value); setSubmitted(undefined); setResults(undefined); setError(""); }}><option value="">Select a county</option>{counties.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <button type="submit" disabled={loading || !county}>Find resources<ArrowRight size={16} /></button>
      </form>
      {geographyError && <p role="alert">{geographyError}</p>}
      {loading && <p role="status">Checking the source...</p>}{error && <p role="alert">{error}</p>}
      {!submitted && <p>Select your state and county, then click Find resources.</p>}
      {results && <><div className="resource-source"><strong>{results.source}</strong><span>Retrieved {new Date(results.retrievedAt).toLocaleString()}</span></div><p className={`resource-source-note ${results.status !== "available" ? "warning" : ""}`} role="status">{results.note}</p><div className="resource-result-grid">{results.items.map((item, i) => <article key={i}><div><h3>{item.title}</h3>{item.status && <span className="resource-status">{item.status}</span>}</div><p>{item.description}</p>{item.phone && <p>Phone: {item.phone}</p>}{item.details && <p>{item.details}</p>}{item.url && /^https:\/\//.test(item.url) && <a href={item.url} target="_blank" rel="noreferrer">{results.source === "Google Maps" ? "View on Google Maps" : "Open official source"}<ExternalLink size={14} /></a>}{item.attributions?.map((a, j) => <small key={j}>{a.provider}</small>)}</article>)}</div>{results.status === "available" && !results.items.length && <p>No records returned for this search. This does not confirm that no resources exist.</p>}</>}
    </section>}
    <p className="resource-hub-footnote"><ShieldCheck size={15} />Source-reported information. Confirm hours, access, and availability before traveling.</p>
  </main>;
}
