import {scenarioUrl,useScenario} from '../services/scenario'
import {SimulatedBadge} from './ScenarioControl'
import {readResourceCounty,countyState} from '../services/resourceDefaults'
import {isCurrentAlert} from '../services/alertFilters'
import type {PublicAlert,SourceResult} from '../publicDataTypes'
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, Search, Package, House, Utensils, Cross, Layers, ShieldCheck, ExternalLink, MapPin } from "lucide-react";
import "./ResourcesPage.css";
import { getGeography } from "../services/api";
import { stateOptions } from "../publicDataTypes";
import type { Geography } from "../types";
const categories = [
  { id: "shelter", label: "Shelter", title: "Emergency Shelters", description: "Shelters in the selected county", icon: House },
  { id: "food", label: "Food & Water", title: "Food banks", description: "Food banks mapped in OpenStreetMap", icon: Utensils },
  { id: "medical", label: "Medical", title: "Medical Support", description: "Hospitals mapped in OpenStreetMap", icon: Cross },
  { id: "financial", label: "Financial", title: "FEMA disaster declarations", description: "Recent declarations for the county (not an eligibility check)", icon: Layers },
  { id: "safety", label: "Safety", title: "Safety Guides", description: "Official county alerts and safety guidance", icon: ShieldCheck },
];
type Item = { simulated?: boolean; capacity?: number; title: string; description: string; details?: string; status?: string; phone?: string; website?: string; url?: string; attributions?: { provider?: string; providerUri?: string }[] };
type Results = { source: string; status: string; retrievedAt: string; note: string; items: Item[] };
export default function ResourcesPage() {
  const simulated=useScenario()
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [county, setCounty] = useState("");
  const userChangedLocation=useRef(false);
  const [geography, setGeography] = useState<Geography>();
  const [geographyError, setGeographyError] = useState("");
  useEffect(() => { getGeography().then(setGeography).catch(() => setGeographyError("County list could not load. Refresh the page to retry.")); }, []);
  const [state, setState] = useState("");
  useEffect(()=>{
    if(!geography)return
    let active=true
    const choose=(id:string)=>{const region=geography.regions.find(r=>r.kind==='county'&&r.id===id),code=countyState(id);if(active&&!userChangedLocation.current&&region&&code){setState(code);setCounty(id);return true}return false}
    const saved=readResourceCounty()
    if(saved&&choose(saved))return
    fetch(scenarioUrl('/api/public/alerts')).then(async response=>{if(!response.ok)throw new Error();return response.json() as Promise<SourceResult<{alerts:PublicAlert[]}>>}).then(feed=>{
      if(feed.status!=='available')return
      for(const alert of feed.data?.alerts||[])if(isCurrentAlert(alert,Date.now()))for(const id of alert.countyIds)if(choose(id))return
    }).catch(()=>{})
    return()=>{active=false}
  },[geography,simulated]);
  const [submitted, setSubmitted] = useState<{ location: string; state: string; county: string; retry: number }>();
  const [results, setResults] = useState<Results>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const current = categories.find(c => c.id === selected);
  useEffect(() => {
    if (!selected || !submitted) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setResults(undefined);
    fetch(scenarioUrl(`/api/resources/${selected}?${new URLSearchParams({ location: submitted.location, state: submitted.state, county: submitted.county })}`), { signal: controller.signal })
      .then(async response => { if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(typeof data?.detail === "string" ? data.detail : "Resources could not be loaded. Check that FastAPI is running and try again."); } return response.json(); })
      .then(data => { if (!controller.signal.aborted) setResults(data); })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected, submitted,simulated]);
  const counties = (geography?.regions || []).filter(r => r.kind === "county" && r.id.startsWith(stateOptions.find(s => s.code === state)?.fips || "--")).sort((a, b) => a.name.localeCompare(b.name));
  function findResources() {
    const region = counties.find(c => c.id === county);
    if (!state || (county&&!region)) return;
    setSubmitted({ state, county, location: region?`${region.coordinates[1]},${region.coordinates[0]}`:"", retry: Date.now() });
  }
  return <main className="resource-hub">
    <div className="resource-hub-heading"><div className="resource-hub-title"><span className="resource-hub-icon"><Package size={27} /></span><div><h1>Resources</h1><p>Public resources for the selected state or county, with sources and retrieval times.</p></div></div><label className="resource-hub-search"><Search size={17} /><input aria-label="Search resources" placeholder="Search resources..." value={query} onChange={e => setQuery(e.target.value)} /></label></div>
    <div className="resource-hub-grid">{categories.filter(c => `${c.title} ${c.description}`.toLowerCase().includes(query.toLowerCase())).map(c => <button key={c.id} className={`resource-hub-card ${selected === c.id ? "selected" : ""}`} aria-expanded={selected === c.id} onClick={() => { setSelected(c.id); setResults(undefined); setError(""); }}><span className="resource-card-icon"><c.icon size={27} /></span><span><strong>{c.title}</strong><small>{c.description}</small></span><ArrowRight size={18} /></button>)}</div>
    {!categories.some(c => `${c.title} ${c.description}`.toLowerCase().includes(query.toLowerCase())) && <p className="resource-hub-empty">No resources match your search.</p>}
    {current && <section className="resource-results" aria-label={`${current.title} results`}><div className="resource-results-heading"><h2><current.icon size={22} />{current.title}</h2><button onClick={() => setSelected("")}><ArrowLeft size={15} />Back to categories</button></div>
      <form className="resource-location" onSubmit={e => { e.preventDefault(); findResources(); }}>
        <label><MapPin size={16} />State<select aria-label="Resource state" value={state} onChange={e => { userChangedLocation.current=true; setState(e.target.value); setCounty(""); setSubmitted(undefined); setResults(undefined); setError(""); }}><option value="">Select a state</option>{stateOptions.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
        <label>County (optional)<select aria-label="Resource county" value={county} disabled={!counties.length} onChange={e => { userChangedLocation.current=true; setCounty(e.target.value); setSubmitted(undefined); setResults(undefined); setError(""); }}><option value="">All counties in this state</option>{counties.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <button type="submit" disabled={loading || !state}>Find resources<ArrowRight size={16} /></button>
      </form>
      {geographyError && <p role="alert">{geographyError}</p>}
      {loading && <p role="status">{selected==='food'||selected==='medical'?'Searching OpenStreetMap. Waiting for the public map service...':'Checking the source...'}</p>}{error && <p role="alert">{error}</p>}
      {!submitted && <p>Select a state and optionally a county, then click Find resources.</p>}
      {results && <><div className="resource-source"><strong>{results.source}</strong><span>Retrieved {new Date(results.retrievedAt).toLocaleString()}</span></div><p className={`resource-source-note ${results.status !== "available" ? "warning" : ""}`} role="status">{results.note}</p>{results.status==='unavailable'&&<button className="resource-retry" type="button" onClick={()=>setSubmitted(old=>old?{...old,retry:Date.now()}:old)}>Retry search</button>}<div className="resource-result-grid">{results.items.filter(item=>!item.simulated||simulated).map((item, i) => <article key={i}><div>{item.simulated&&<SimulatedBadge/>}<h3>{item.title}</h3>{item.status && <span className="resource-status">{item.status}</span>}</div>{item.description && <p>{item.description}</p>}{item.phone && <p><a href={`tel:${item.phone.replace(/[^+0-9,;]/g, "")}`}>Call {item.phone}</a></p>}{item.website && /^https?:\/\//i.test(item.website) && <p><a href={item.website} target="_blank" rel="noreferrer">Visit facility website<ExternalLink size={14} /></a></p>}{item.details && <p>{item.details}</p>}{item.url && /^https:\/\//.test(item.url) && <a href={item.url} target="_blank" rel="noreferrer">{results.source.includes("OpenStreetMap") ? "View on OpenStreetMap" : "Open official source"}<ExternalLink size={14} /></a>}{item.attributions?.map((a, j) => <small key={j}>{a.provider}</small>)}</article>)}</div>{results.status === "available" && !results.items.length && <p>No records returned for this search. This does not confirm that no resources exist.</p>}</>}
    </section>}
    <p className="resource-hub-footnote"><ShieldCheck size={15} />Source-reported information. Confirm hours, access, and availability before traveling.</p>
  </main>;
}
