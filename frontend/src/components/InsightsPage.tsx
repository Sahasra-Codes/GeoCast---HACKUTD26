import { useEffect, useMemo, useState } from 'react'
import { Users, House, Activity, MapPin } from 'lucide-react'
import type { Geometry, Position } from 'geojson'
import type { PublicAlert, PublicInsightsData, PublicStateData, PublicCountyData, AcsMetric, AcsData } from '../publicDataTypes'
import { stateOptions } from '../publicDataTypes'
import { getPublicState, getPublicCounty, getNationwideInsights } from '../services/publicData'
import { isCurrentAlert, severityLevel } from '../services/alertFilters'
import './InsightsPage.css'

const number = (value: number | null | undefined) => value == null ? 'Unavailable' : value.toLocaleString()
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : 'Not supplied'
const earthquake = (event: PublicAlert) => event.kind === 'observed_earthquake'
const safeUrl = (url: string) => url.startsWith('https://') ? url : undefined
function rings(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat()
  return []
}

export default function InsightsPage() {
  const [state, setState] = useState('TX')
  const [data, setData] = useState<PublicInsightsData>()
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [countyId, setCountyId] = useState('')
  const [countyFilter, setCountyFilter] = useState('')
  const [county, setCounty] = useState<PublicCountyData>()
  const [countyError, setCountyError] = useState<{ id: string; message: string } | null>(null)
  const [severity, setSeverity] = useState('all')
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()); setRefresh(value => value + 1) }, 120000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    const request = state === 'ALL' ? getNationwideInsights(controller.signal) : getPublicState(state, controller.signal)
    request.then(value => {
      if (!controller.signal.aborted) setData(value)
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load events.') })
    return () => controller.abort()
  }, [state, refresh])
  const active = data?.state === state ? data : undefined
  const allEvents = useMemo(() => {
    const nws = active?.sources.noaa.status === 'available' ? active.sources.noaa.data?.alerts || [] : []
    const quakes = active?.sources.earthquakes?.status === 'available' ? active.sources.earthquakes.data?.events || [] : []
    return [...new Map([...nws, ...quakes].filter(event => isCurrentAlert(event, now)).map(event => [event.id, event])).values()]
      .sort((a, b) => severityLevel(b.severity) - severityLevel(a.severity) || a.event.localeCompare(b.event) || a.id.localeCompare(b.id))
  }, [active, now])
  const events = allEvents.filter(event => (severity === 'all' || event.severity === severity) && (!countyFilter || event.countyIds.includes(countyFilter)))
  const selected = events.find(event => event.id === selectedId) || events[0]
  const allFeatures = active?.sources.boundaries.status === 'available' ? active.sources.boundaries.data?.features || [] : []
  const countyOptions = [...allFeatures].sort((a,b) => String(a.properties?.NAME || a.properties?.BASENAME || '').localeCompare(String(b.properties?.NAME || b.properties?.BASENAME || '')))
  const eventStates = new Set(selected?.countyIds.map(id => id.slice(0, 2)))
  const features = state === 'ALL' ? allFeatures.filter(feature => eventStates.has(String(feature.id || feature.properties?.GEOID).slice(0, 2))) : allFeatures
  const affected = features.filter(feature => selected?.countyIds.includes(String(feature.id || feature.properties?.GEOID)))
  const affectedId = affected.some(feature => String(feature.id || feature.properties?.GEOID) === countyId)
    ? countyId : affected.some(feature => String(feature.id || feature.properties?.GEOID) === countyFilter) ? countyFilter : String(affected[0]?.id || affected[0]?.properties?.GEOID || '')
  const populationCountyId = countyFilter || affectedId
  const populationCountyName = String(allFeatures.find(feature => String(feature.id || feature.properties?.GEOID) === populationCountyId)?.properties?.NAME || 'Selected county')
  useEffect(() => {
    if (!populationCountyId) return
    const controller = new AbortController()
    getPublicCounty(populationCountyId, controller.signal).then(value => {
      if (!controller.signal.aborted) setCounty(value)
    }).catch(cause => { if (!controller.signal.aborted) setCountyError({ id: populationCountyId, message: cause instanceof Error ? cause.message : 'Could not load county records.' }) })
    return () => controller.abort()
  }, [populationCountyId, refresh])
  const record = county?.countyId === populationCountyId ? county : undefined
  const acsSource = record?.sources.acs
  const acs = acsSource?.status === 'available' ? acsSource.data : null
  function choose(event: PublicAlert) {
    setSelectedId(event.id); setCountyId(''); setCountyError(null); setCounty(undefined)
  }
  function changeState(value: string) {
    setState(value); setCountyFilter(''); setData(undefined); setError(''); setSelectedId(''); setCountyId(''); setCounty(undefined); setCountyError(null)
  }
  return <main className="insights-page">
    <div className="insights-heading"><div><span className="overline">LOCAL CONTEXT. A CLEARER PICTURE.</span><h1>Insights</h1><p>Understand community needs, population, and the events shaping your area.</p></div>
      <div className="insights-location-selectors"><label>Explore a state<select aria-label="Explore a state" value={state} onChange={event => changeState(event.target.value)}><option value="ALL">All states</option>{stateOptions.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}</select></label>
        <label>County (optional)<select aria-label="County (optional)" value={countyFilter} disabled={state === 'ALL' || !countyOptions.length} onChange={event => { setCountyFilter(event.target.value); setSelectedId(''); setCountyId(''); setCounty(undefined); setCountyError(null) }}>
          <option value="">{state === 'ALL' ? 'Choose a state first' : !active ? 'Loading counties...' : !countyOptions.length ? 'Counties unavailable' : 'All counties'}</option>
          {state !== 'ALL' && countyOptions.map(feature => { const id = String(feature.id || feature.properties?.GEOID); return <option key={id} value={id}>{String(feature.properties?.NAME || feature.properties?.BASENAME || id)}</option> })}
        </select></label>
      </div>
    </div>
    <div className="insights-toolbar">
      <label>Severity<select aria-label="Severity" value={severity} onChange={event => setSeverity(event.target.value)}><option value="all">All severities</option>{['Extreme','Severe','Moderate','Minor','Unknown'].map(level => <option key={level}>{level}</option>)}</select></label>
      <button onClick={() => { setError(''); setData(undefined); setCounty(undefined); setCountyError(null); setNow(Date.now()); setRefresh(value => value + 1) }}>Refresh sources</button>
    </div>
    {error && <p className="insights-message" role="alert">{error}</p>}
    {!active && !error && <p role="status">Loading official events...</p>}
    {active && <div className="insights-sources">{[active.sources.noaa, active.sources.earthquakes].filter(source => !!source).map(source => <span key={source.name}>{source.name}: {source.status === 'available' ? `updated ${date(source.retrievedAt)}` : source.error || 'Unavailable'}</span>)}{active.sources.noaa.data?.truncated && <span>Source results are limited; additional alerts may exist.</span>}</div>}
    {active && !events.length && <div className="insights-filter-notice" role="status">
      <strong>No events match {severity === 'all' ? 'the current filters' : `the ${severity} severity filter`}.</strong>
      <p>{countyFilter ? 'Your selected county population can still be shown below.' : 'Choose a county above to view Census charts independently of live events.'}</p>
      {severity !== 'all' && <button onClick={() => setSeverity('all')}>Show all severities</button>}
      {countyFilter && <button onClick={() => { setCountyFilter(''); setCountyId(''); setCounty(undefined); setCountyError(null) }}>Show all counties</button>}
    </div>}
    <section className="insights-summary-strip" aria-label="Insights summary">
      <div><span className="insights-summary-icon" aria-hidden="true"><Users size={27}/></span><span><strong>{acs?.population.estimate == null ? '--' : number(acs.population.estimate)}</strong><small>County population</small></span></div>
      <div><span className="insights-summary-icon" aria-hidden="true"><House size={27}/></span><span><strong>{acs?.households.estimate == null ? '--' : number(acs.households.estimate)}</strong><small>County households</small></span></div>
      <div><span className="insights-summary-icon" aria-hidden="true"><Activity size={27}/></span><span><strong>{active ? events.length : '--'}</strong><small>Matching events</small></span></div>
      <div><span className="insights-summary-icon" aria-hidden="true"><MapPin size={27}/></span><span><strong>{selected && active?.sources.boundaries.status === 'available' ? affected.length : active && !selected ? 0 : '--'}</strong><small>Linked counties</small></span></div>
    </section>
    <div className="insights-chart-heading"><span>{acs?.name || (populationCountyId ? populationCountyName : 'Choose a county above or an event with linked counties')}</span><small>Last updated: {date(acsSource?.retrievedAt || active?.generatedAt)}</small></div>
    <section className="insights-chart-grid" aria-label="Community impact charts">
      <article className="insights-card insights-needs"><h2>Impact by Need</h2><p className="insights-caption">County planning indicators, not measured disaster impacts or requests.</p>
        <PopulationBar label="Basic Necessities" detail="Population below poverty level" value={acs?.povertyPercent ?? null}/>
        <PopulationBar label="Medical Planning" detail="Population age 65 and older" value={acs?.ageGroups && acs.ageGroups.total > 0 ? acs.ageGroups.olderAdults / acs.ageGroups.total * 100 : null}/>
        <PopulationBar label="Communication" detail="Households without internet" value={acs?.noInternetPercent ?? null}/>
        <PopulationBar label="Accessibility" detail="Households without a vehicle" value={acs?.noVehiclePercent ?? null}/>
      </article>
      <article className="insights-card insights-demographics"><h2>Population by Age</h2><p className="insights-caption">Selected county population, not confirmed people affected.</p><PopulationDonut data={acs}/></article>
    </section>
    {!acs && <p className="insights-caption" role="status">{countyError?.id === populationCountyId ? countyError.message : acsSource?.error || (populationCountyId ? 'Loading county Census estimates. Population charts require an activated CENSUS_API_KEY in backend/.env.' : 'Choose a county above to load population charts, or select an event with a linked county.')}</p>}
    {acs && <p className="insights-caption">ACS {acs.period} five-year estimates. Indicators can overlap and use different population or household denominators. Age is planning context, not a medical-need assessment. <a href="https://api.census.gov/data/2024/acs/acs5/groups/B01001.html" target="_blank" rel="noreferrer">Census age table</a></p>}
    <div className="insights-layout">
      <section className="insights-event-panel" aria-label="Disasters by severity"><div className="insights-panel-title"><h2>All disaster types</h2><span>{events.length} events</span></div><p className="insights-caption">{countyFilter ? 'Selected county. Only events with a matching reported county are included.' : state === 'ALL' ? 'All states.' : 'Selected state.'} Highest reported severity first. Observed earthquakes have separate magnitude information.</p>
        <div className="insights-event-list">{events.map(event => <button className={`insights-event ${selected?.id === event.id ? 'selected' : ''}`} key={event.id} aria-pressed={selected?.id === event.id} onClick={() => choose(event)}>
          <span className="insights-event-top"><span className="insights-severity" data-severity={event.severity}>{event.severity}</span><small>{earthquake(event) ? 'USGS observation' : 'NWS alert'}</small></span>
          <strong>{event.event}</strong><span>{event.area}</span>{state === 'ALL' && <small>{(event.stateCodes?.length ? event.stateCodes : stateOptions.filter(option => event.countyIds.some(id => id.startsWith(option.fips))).map(option => option.code)).join(', ') || 'State not supplied'}</small>}<small>{earthquake(event) && event.magnitude != null ? `Magnitude ${event.magnitude} | ` : ''}Issued {date(event.sent)}</small>
        </button>)}</div>
        {active && !events.length && <p className="insights-message">No returned events match this selection. Try another state or clear the filters.</p>}
      </section>
      <section className="insights-detail" aria-label="Selected disaster details">{selected ? <>
        <article className="insights-card insights-selected"><span className="insights-severity" data-severity={selected.severity}>{selected.severity}</span><h2>{selected.event}</h2><p className="insights-area">{selected.area}</p>{selected.headline && <p>{selected.headline}</p>}
          <dl className="insights-facts"><div><dt>Source</dt><dd>{earthquake(selected) ? 'USGS observed earthquake' : 'National Weather Service'}</dd></div><div><dt>Issued</dt><dd>{date(selected.sent)}</dd></div><div><dt>Expires</dt><dd>{date(selected.expires)}</dd></div></dl>
          {selected.description && <details><summary>Event description</summary><p className="insights-description">{selected.description}</p></details>}{selected.instruction && <div className="insights-instructions"><h3>Official instructions</h3><p>{selected.instruction}</p></div>}
          {safeUrl(selected.sourceUrl) && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Open official event source</a>}
        </article>
        <article className="insights-card"><h2>Reported area</h2><p className="insights-caption">Highlighted counties are linked to the selected event by the source. Choose a county to inspect its population.</p>
          {features.length ? <CountyMap features={features} affectedIds={selected.countyIds} countyId={affectedId} onCounty={id => { setCountyId(id); setCountyError(null) }}/>:<p>{active?.sources.boundaries.status === 'available' ? 'No linked county geometry for this event.' : `County boundaries unavailable. ${active?.sources.boundaries.error || ''}`}</p>}
          {affected.length > 0 ? <label className="insights-county-select">County population data<select aria-label="County population data" value={affectedId} onChange={event => { setCountyId(event.target.value); setCountyError(null) }}>{affected.map(feature => {const id = String(feature.id || feature.properties?.GEOID); return <option value={id} key={id}>{String(feature.properties?.NAME || feature.properties?.BASENAME || id)}</option>})}</select></label> : <p className="insights-message">No linked counties supplied for this event in the selected area. Population cannot be assigned from its area name alone.</p>}
        </article>
        {affectedId && <article className="insights-card insights-population"><span className="overline">LOCAL POPULATION</span><h2>{acs?.name || String(affected.find(feature => String(feature.id || feature.properties?.GEOID) === affectedId)?.properties?.NAME || 'Selected county')}</h2>
          {countyError?.id === populationCountyId ? <p role="alert">{countyError.message}</p> : !record ? <p role="status">Loading county population...</p> : acs ? <>
            <p className="insights-caption">ACS {acs.period} five-year survey estimates. County context, not a count of people affected by this event.</p>
            <dl className="insights-population-stats"><Metric label="Population" metric={acs.population}/><Metric label="Households" metric={acs.households}/><Metric label="Households without a vehicle" metric={acs.noVehicleHouseholds}/><Metric label="Households without internet" metric={acs.noInternetHouseholds}/></dl>
            <p className="insights-caption">Count margins of error use 90% confidence. Percentages use their own survey table denominators; percentage margins of error are not estimated.</p>
          </> : <p className="insights-message">{acsSource?.error || 'Population estimates are unavailable for this county.'}</p>}
          {acsSource && <p className="insights-caption">{acsSource.vintage} | Retrieved {date(acsSource.retrievedAt)} {safeUrl(acsSource.sourceUrl) && <a href={acsSource.sourceUrl} target="_blank" rel="noreferrer">Census source</a>}</p>}
        </article>}
      </> : <div className="insights-card insights-empty"><h2>Select a disaster</h2><p>Events and their local population context appear here when sources are available.</p></div>}</section>
    </div>
  </main>
}
function Metric({ label, metric }: { label: string; metric: AcsMetric }) {
  return <div><dt>{label}</dt><dd>{number(metric.estimate)}<small>{metric.marginOfError == null ? 'Margin of error unavailable' : `+/- ${number(metric.marginOfError)} margin of error`}</small></dd></div>
}
function PopulationBar({ label, value, detail }: { label: string; value: number | null; detail?: string }) {
  const valid = value != null && Number.isFinite(value) && value >= 0 && value <= 100
  return <div className="insights-bar"><div><span>{label}{detail && <small>{detail}</small>}</span><strong>{valid ? `${value.toFixed(1)}%` : 'Unavailable'}</strong></div>{valid && <div className="insights-bar-track" role="img" aria-label={`${label}: ${value.toFixed(1)} percent`}><span style={{width: `${value}%`}}/></div>}</div>
}
function PopulationDonut({data}:{data:AcsData | null | undefined}) {
  const age = data?.ageGroups
  const valid = age && [age.total, age.children, age.adults, age.olderAdults].every(value => Number.isFinite(value) && value >= 0) && age.total > 0 && Math.abs(age.children + age.adults + age.olderAdults - age.total) < 1
  const segments = valid ? [{label:'Children (under 18)',count:age.children,color:'#ed9296'},{label:'Adults (18-64)',count:age.adults,color:'#b81830'},{label:'Older adults (65+)',count:age.olderAdults,color:'#f4bab4'}] : []
  let offset = 0
  return <div className="insights-donut-layout"><div className="insights-donut-wrap"><svg viewBox="0 0 200 200" role="img" aria-label={valid ? 'County population by age: ' + segments.map(segment=>`${segment.label} ${(segment.count/age.total*100).toFixed(1)} percent`).join(', ') : 'Population age chart: data unavailable'}>
    <circle cx="100" cy="100" r="76" fill="none" stroke="#f2e7e3" strokeWidth="29"/>
    {segments.map(segment=>{ const percent=segment.count/age!.total*100;const start=offset;offset+=percent;return <circle key={segment.label} cx="100" cy="100" r="76" fill="none" stroke={segment.color} strokeWidth="29" pathLength="100" strokeDasharray={`${percent} ${100-percent}`} strokeDashoffset={-start} transform="rotate(-90 100 100)"><title>{segment.label}: {number(segment.count)} ({percent.toFixed(1)}%)</title></circle>})}
  </svg><div className="insights-donut-center"><strong>{valid ? number(age.total) : '--'}</strong><small>{valid ? 'County total' : 'No age data'}</small></div></div>
  <ul className="insights-donut-legend">{(segments.length ? segments : [{label:'Children (under 18)',count:null,color:'#ed9296'},{label:'Adults (18-64)',count:null,color:'#b81830'},{label:'Older adults (65+)',count:null,color:'#f4bab4'}]).map(segment=><li key={segment.label}><span style={{background:segment.color}}/><span>{segment.label}</span><strong>{valid && segment.count != null ? `${(segment.count/age.total*100).toFixed(1)}%` : '--'}</strong></li>)}</ul></div>
}
function CountyMap({ features, affectedIds, countyId, onCounty }: {
  features: NonNullable<PublicStateData['sources']['boundaries']['data']>['features']; affectedIds: string[]; countyId: string; onCounty: (id: string) => void
}) {
  const points = features.flatMap(feature => rings(feature.geometry).flat()).filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]))
  if (!points.length) return <p>County geometry is unavailable.</p>
  const xs = points.map(point => point[0]), ys = points.map(point => point[1])
  const west = xs.reduce((a,b)=>Math.min(a,b),Infinity), east = xs.reduce((a,b)=>Math.max(a,b),-Infinity), south = ys.reduce((a,b)=>Math.min(a,b),Infinity), north = ys.reduce((a,b)=>Math.max(a,b),-Infinity)
  const scale = Math.min(600 / Math.max(east-west, 0.01), 270 / Math.max(north-south, 0.01))
  const offsetX = (640 - (east-west)*scale)/2, offsetY = (310 - (north-south)*scale)/2
  return <><svg className="insights-county-map" viewBox="0 0 640 310" aria-label="Reported counties highlighted on state map">
    {features.map(feature => {
      const id = String(feature.id || feature.properties?.GEOID), affected = affectedIds.includes(id)
      const path = rings(feature.geometry).map(ring => ring.map((point, index) => `${index ? 'L' : 'M'}${((point[0]-west)*scale+offsetX).toFixed(2)},${((north-point[1])*scale+offsetY).toFixed(2)}`).join(' ')+' Z').join(' ')
      return <path key={id} d={path} fillRule="evenodd" className={id === countyId ? 'chosen' : affected ? 'affected' : ''} role={affected ? 'button' : undefined} tabIndex={affected ? 0 : undefined} aria-label={affected ? `View ${feature.properties?.NAME || id} population` : undefined} onClick={() => { if (affected) onCounty(id) }} onKeyDown={event => { if (affected && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onCounty(id) } }}><title>{String(feature.properties?.NAME || id)}{affected ? ' - linked to selected event' : ''}</title></path>
    })}
  </svg><div className="insights-map-key"><span><i/>Reported county</span><span><i/>Selected county</span><small>Simplified county boundaries; not a damage footprint.</small></div></>
}
