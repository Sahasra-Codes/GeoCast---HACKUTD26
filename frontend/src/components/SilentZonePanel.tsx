import {useCallback, useEffect, useState} from 'react'
import './SilentZonePanel.css'

type RankedZone = {
  id: string; zoneId: string; name: string; population: number; pct65plus: number; sviScore: number;
  powerOff: boolean; outageHours: number; normalReportsPerHour: number; reportsNow: number;
  hoursSinceLastReport: number; score: number; status: 'Pending' | 'Dispatched';
  breakdown: {outage: number; vulnerability: number; silence: number; reportedNeed: number}; reasons: string[];
}
type Snapshot = {simulated: true; hour: number; zones: RankedZone[]}
type Briefing = {text: string; source: 'gemini' | 'template'; hour: number}
async function request<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/${path}`, body === undefined ? {} : {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
  if (!response.ok) throw new Error('Silent Zone service is unavailable. Start the Node API on port 8001 and retry.')
  return response.json()
}
export default function SilentZonePanel({relief = false}: {relief?: boolean}) {
  const [data, setData] = useState<Snapshot | null>(null)
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [busy, setBusy] = useState(''), [error, setError] = useState('')
  const load = useCallback(async () => {
    try {setData(await request<Snapshot>('priority')); setError('')} catch (err) {setError(err instanceof Error ? err.message : 'Unable to load zones')}
  }, [])
  useEffect(() => {
    let disposed = false
    void request<Snapshot>('priority').then(snapshot => {if (!disposed) setData(snapshot)}).catch(err => {if (!disposed) setError(err instanceof Error ? err.message : 'Unable to load zones')})
    const refresh = () => {if (!document.hidden) void load()}
    const timer = window.setInterval(refresh, 10000)
    window.addEventListener('focus', refresh)
    return () => {disposed = true; clearInterval(timer); window.removeEventListener('focus', refresh)}
  }, [load])
  async function act(action: 'advance' | 'briefing' | 'dispatch', zoneId?: string) {
    if (busy) return
    setBusy(zoneId || action); setError('')
    try {
      if (action === 'briefing') setBriefing(await request<Briefing>('briefing', {}))
      else if (action === 'advance') {setData(await request<Snapshot>('advance', {})); setBriefing(null)}
      else {await request<RankedZone>('dispatch', {zoneId}); await load()}
    } catch (err) {setError(err instanceof Error ? err.message : 'Action failed. Please retry.')}
    finally {setBusy('')}
  }
  const zones = data?.zones.filter(z => !relief || z.status === 'Dispatched') || []
  return <section className={`silent-zone-panel ${relief ? 'silent-relief' : ''}`} aria-label={relief ? 'Silent Zone dispatch queue' : 'Silent Zone prioritization'}>
    <div className="silent-heading"><div><span className="silent-badge">Simulated data</span><h2>{relief ? 'Dispatched zones' : 'Silent Zone'}</h2></div>{!relief && <a href="/map" aria-label="Close Silent Zone">×</a>}</div>
    <p className="silent-subtitle">Responder workspace · Fictional zones. Deterministic priority; AI explains only. A dispatch assigns help; it does not resolve a zone.</p>
    <div className="silent-clock"><strong>Hour {data?.hour ?? '—'}</strong><span>since hurricane alert · simulated clock</span></div>
    {!relief && <div className="silent-actions"><button disabled={!!busy || !data} onClick={() => void act('advance')}>{busy === 'advance' ? 'Advancing…' : 'Advance 1 hour'}</button><button disabled={!!busy || !data} onClick={() => void act('briefing')}>{busy === 'briefing' ? 'Generating…' : 'Generate briefing'}</button><a href="/relief">Relief queue →</a></div>}
    {error && <div role="alert" className="silent-error">{error}<button disabled={!!busy} onClick={() => void load()}>Retry</button></div>}
    {!data && !error && <p role="status">Loading simulated zones…</p>}
    {briefing && <aside className="silent-briefing" aria-label="Responder briefing" aria-live="polite"><strong>Responder briefing · {briefing.source === 'gemini' ? 'Gemini' : 'Template fallback'} · Hour {briefing.hour}</strong><p>{briefing.text}</p>{data && briefing.hour !== data.hour && <small>Clock has advanced. Generate a new briefing before acting.</small>}<small>The human responder makes the final decision.</small></aside>}
    {relief && data && !zones.length && <p>No zones dispatched yet. <a href="/insights">Open Silent Zone prioritization</a>.</p>}
    <ol className="silent-ranking">{zones.map(zone => <li key={zone.zoneId} className={zone.zoneId === 'zone-3' ? 'silent-demo-zone' : ''} data-zone-id={zone.zoneId}>
      <div className="silent-zone-title"><h3><span>#{data!.zones.findIndex(z => z.zoneId === zone.zoneId) + 1}</span> {zone.name}</h3><strong>{zone.score.toFixed(1)}<small>/100</small></strong></div>
      <div className="silent-score" role="meter" aria-label={`${zone.name} priority score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={zone.score}><span style={{width: `${zone.score}%`}}/></div>
      <ul className="silent-reasons">{zone.reasons.slice(0, -1).map(reason => <li key={reason}>{reason}</li>)}</ul>
      <div className="silent-signal">Last signal received <strong>{zone.hoursSinceLastReport}h ago</strong> · simulated time</div>
      <details><summary>Score breakdown & inputs</summary><dl>{Object.entries(zone.breakdown).map(([key, value]) => <div key={key}><dt>{({outage:'Outage /30', vulnerability:'Vulnerability /25', silence:'Silence /25', reportedNeed:'Reported need /20'})[key]}</dt><dd>{value.toFixed(2)}</dd></div>)}</dl><p>Population {zone.population.toLocaleString()} · Reports {zone.reportsNow}/h vs {zone.normalReportsPerHour}/h normal</p></details>
      <div className="silent-dispatch"><span>{zone.status}</span><button disabled={!!busy || zone.status === 'Dispatched'} onClick={() => void act('dispatch', zone.zoneId)}>{busy === zone.zoneId ? 'Dispatching…' : zone.status === 'Dispatched' ? 'Dispatched' : 'Dispatch'}</button></div>
    </li>)}</ol>
    <small className="silent-note">Silence = fewer reports than the normal hourly rate. Scores reflect zone indicators, not confirmed individual needs. Simulation and assignments reset when the Node API restarts.</small>
  </section>
}
