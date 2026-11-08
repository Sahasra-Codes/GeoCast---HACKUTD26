import {useScenario} from '../services/scenario'
import {matchesCommunityPercentage} from '../services/alertCommunity'
import CountyOverviewDrawer from './CountyOverviewDrawer'
import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Database, LoaderCircle, Search, TriangleAlert } from 'lucide-react'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Geography, GeographicRegion, IntelligenceData } from '../types'
import type { PublicAlert, PublicCountyData, PublicMapData, PublicStateData, SourceResult } from '../publicDataTypes'
import { stateOptions } from '../publicDataTypes'
import { getGeography } from '../services/api'
import { getPublicState, getPublicCounty, getPublicTracts } from '../services/publicData'
import USMap from './USMap'
import {isCurrentAlert,matchesAlertType,compareAlertPriority} from '../services/alertFilters'
import LiveAreaOverview from './LiveAreaOverview'
import {classifyHazard,hazardOptions,type Hazard} from '../data/catalog'
const noAlerts: PublicAlert[] = []
const empty: FeatureCollection<Geometry> = { type: 'FeatureCollection', features: [] }
const publicMapBase: IntelligenceData = { mode: 'connected', updatedAt: '', events: [], predictions: [], resources: [] }
function regionFromFeature(feature: Feature<Geometry>, state: string): GeographicRegion {
  const points: number[][] = []
  function visit(value: unknown) { if (!Array.isArray(value)) return; if (typeof value[0] === 'number') points.push(value as number[]); else value.forEach(visit) }
  if ('coordinates' in feature.geometry) visit(feature.geometry.coordinates)
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const west = Math.min(...xs), east = Math.max(...xs), south = Math.min(...ys), north = Math.max(...ys)
  return { id: String(feature.id || feature.properties?.GEOID), kind: 'county', name: String(feature.properties?.BASENAME || feature.properties?.NAME), state, coordinates: [(west + east) / 2, (south + north) / 2], bounds: [[west,south],[east,north]] }
}
export default function PublicDataWorkspace({ showFilters, closeFilters, initialHazard='all', pageTitle, initialInsights=false,initialDetailsOpen=initialInsights,openFilters }: { showFilters: boolean; closeFilters: () => void; initialHazard?:Hazard;pageTitle?:string;initialInsights?:boolean;initialDetailsOpen?:boolean;openFilters?:()=>void }) {
  const simulated=useScenario()
  const defaults = {state:'TX',countyId:'',hazardFilter:initialHazard as string,severities:[] as string[],indicators:[] as string[],indicatorMatch:'any' as 'any'|'all',threshold:10,showAlerts:true,showRisk:false,showDeclarations:false,showTracts:false}
  const [applied,setApplied]=useState(defaults)
  const [draft,setDraft]=useState(defaults)
  const {state,countyId,hazardFilter,severities,indicators,indicatorMatch,threshold,showAlerts,showRisk,showDeclarations,showTracts}=applied
  const updateDraft = <K extends keyof typeof draft>(key:K,value:typeof draft[K]) => setDraft(old=>({...old,[key]:value}))
  const [draftStateData,setDraftStateData]=useState<PublicStateData>()
  const [geography, setGeography] = useState<Geography>()
  const [stateData, setStateData] = useState<PublicStateData>()
  const [countyData, setCountyData] = useState<PublicCountyData>()
  const [tracts, setTracts] = useState<SourceResult<FeatureCollection<Geometry>>>()
  const [selectedAlert, setSelectedAlert] = useState<string>()
  const [focusState,setFocusState]=useState(false)
  const [detailsOpen,setDetailsOpen]=useState(initialDetailsOpen)
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')
  const [countyError, setCountyError] = useState('')
  const [tractError, setTractError] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentTime,setCurrentTime]=useState(()=>Date.now())
  useEffect(()=>{const timer=setInterval(()=>setCurrentTime(Date.now()),30000);return()=>clearInterval(timer)},[])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setReload(r => r + 1) }
    const interval = window.setInterval(refresh, 120000)
    document.addEventListener('visibilitychange',refresh)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange',refresh) }
  }, [])
  useEffect(() => { let active = true; getGeography().then(g => { if (active) setGeography(g) }).catch(() => { if (active) setError('National context boundaries could not load.') }); return () => { active = false } }, [])
  useEffect(() => {
    const controller = new AbortController()
    getPublicState(state, controller.signal).then(value => { if (!controller.signal.aborted) { setStateData(value); setLoading(false) } }).catch(e => { if (!controller.signal.aborted) { setError(e.message); setLoading(false) } })
    return () => controller.abort()
  }, [state, reload,simulated])
  useEffect(() => {
    if (!countyId) return
    const controller = new AbortController()
    getPublicCounty(countyId, controller.signal).then(value => { if (!controller.signal.aborted) setCountyData(value) }).catch(e => { if (!controller.signal.aborted) setCountyError(e.message) })
    return () => controller.abort()
  }, [countyId, reload])
  useEffect(() => {
    if (!countyId || !showTracts) return
    const controller = new AbortController()
    getPublicTracts(countyId, controller.signal).then(value => { if (!controller.signal.aborted) setTracts(value) }).catch(e => { if (!controller.signal.aborted) setTractError(e.message) })
    return () => controller.abort()
  }, [countyId, showTracts, reload])
  useEffect(()=>{
    if(draft.state===state)return
    const controller=new AbortController()
    getPublicState(draft.state,controller.signal).then(value=>{if(!controller.signal.aborted)setDraftStateData(value)}).catch(()=>{})
    return()=>controller.abort()
  },[draft.state,state,reload,simulated])
  const filterState = draft.state===state ? stateData : draftStateData?.state===draft.state ? draftStateData : undefined
  const filterCounties = filterState?.sources.boundaries.data || empty
  const filterAlerts = [...(filterState?.sources.noaa.data?.alerts||noAlerts),...(filterState?.sources.earthquakes?.data?.events||noAlerts)].filter(a=>isCurrentAlert(a,currentTime))
  const activeState = stateData?.state === state ? stateData : undefined
  const activeCounty = countyData?.countyId === countyId ? countyData : undefined
  const rawCounties = activeState?.sources.boundaries.data || empty
  const rawAlerts = useMemo(() => [...(activeState?.sources.noaa.data?.alerts || noAlerts),...(activeState?.sources.earthquakes?.data?.events || noAlerts)], [activeState])
  const currentAlerts = useMemo(() => rawAlerts.filter(a=>(!a.simulated||simulated)&&isCurrentAlert(a,currentTime)),[rawAlerts,currentTime,simulated])
  const eventTypes = [...new Set(filterAlerts.map(a=>a.event))].sort()
  const relevantAlerts = useMemo(() => currentAlerts.filter(a=>matchesAlertType(a,hazardFilter)&&(!severities.length||severities.includes(a.severity))),[currentAlerts,hazardFilter,severities])
  const historicalRecords = useMemo(() => (activeState?.sources.fema.data?.records || []).filter(r => hazardFilter === 'all' || (!hazardFilter.includes(':') && classifyHazard(r.type || r.title || '') === hazardFilter)),[activeState,hazardFilter])
  const matchingIds = useMemo(() => rawCounties.features.filter(feature => {
    const id=String(feature.id || feature.properties?.GEOID)
    if(countyId && id!==countyId)return false
    if(!indicators.length)return true
    const acs=activeState?.sources.acs?.data?.counties.find(c=>c.countyId===id)
    const tests=indicators.map(tag=>tag==='vehicle'?matchesCommunityPercentage(acs?.noVehiclePercent,threshold):tag==='internet'?matchesCommunityPercentage(acs?.noInternetPercent,threshold):tag==='declarations'?historicalRecords.some(r=>r.countyId===id):tag==='risk'?(activeState?.sources.nri.data?.counties.some(c=>c.countyId===id&&c.riskScore!=null&&c.riskScore>=80)||false):false)
    return indicatorMatch==='all'?tests.every(Boolean):tests.some(Boolean)
  }).map(f=>String(f.id || f.properties?.GEOID)),[rawCounties,countyId,indicators,activeState,historicalRecords,threshold,indicatorMatch])
  const counties = useMemo<FeatureCollection<Geometry>>(() => ({type:'FeatureCollection',features:rawCounties.features.filter(f=>matchingIds.includes(String(f.id||f.properties?.GEOID)))}),[rawCounties,matchingIds])
  const alerts = useMemo(() => relevantAlerts.filter(a => !countyId&&!indicators.length || a.countyIds.some(id=>matchingIds.includes(id))).sort(compareAlertPriority),[relevantAlerts,countyId,indicators,matchingIds])
  const selectedFeature = rawCounties.features.find(f => String(f.id || f.properties?.GEOID) === countyId)
  const geographicFocus = useMemo(() => selectedFeature ? regionFromFeature(selectedFeature, stateOptions.find(s => s.code === state)?.name || 'All states') : geography?.regions.find(r => r.kind === 'state' && r.id === stateOptions.find(s => s.code === state)?.fips), [selectedFeature, state, geography])
  const focus = useMemo(() => {
    if (focusState || !showAlerts || (state==='ALL' && !selectedAlert && !severities.length && hazardFilter==='all' && !countyId && !indicators.length)) return geographicFocus
    const target = alerts.find(a => a.id === selectedAlert) || alerts[0]
    if (!target) return geographicFocus
    const features: Feature<Geometry>[] = target.geometry
      ? [{type:'Feature',properties:{NAME:target.event},geometry:target.geometry}]
      : counties.features.filter(f=>target.countyIds.includes(String(f.id||f.properties?.GEOID)))
    const points: number[][] = []
    const visit = (value: unknown) => { if (!Array.isArray(value)) return; if(typeof value[0]==='number' && Number.isFinite(value[0]) && Number.isFinite(value[1])) points.push(value as number[]); else value.forEach(visit) }
    for(const feature of features) if('coordinates' in feature.geometry) visit(feature.geometry.coordinates)
    if(!points.length) return geographicFocus
    const west=Math.min(...points.map(p=>p[0])),east=Math.max(...points.map(p=>p[0])),south=Math.min(...points.map(p=>p[1])),north=Math.max(...points.map(p=>p[1]))
    return {id:'alert:'+target.id,kind:'county' as const,name:target.event,state,coordinates:[(west+east)/2,(south+north)/2] as [number,number],bounds:[[west,south],[east,north]] as [[number,number],[number,number]]}
  },[alerts,selectedAlert,counties,geographicFocus,showAlerts,state,severities,hazardFilter,countyId,indicators,focusState])
  const selectState = (fips: string) => {
    const selected=stateOptions.find(s=>s.fips===fips)
    if(!selected || selected.code===state)return
    setApplied(old=>({...old,state:selected.code,countyId:''}))
    setDraft(old=>({...old,state:selected.code,countyId:''}))
    setFocusState(true);setSelectedAlert(undefined);setDetailsOpen(false)
    setStateData(undefined);setCountyData(undefined);setTracts(undefined);setError('');setCountyError('');setTractError('');setLoading(true)
  }
  const changeCounty = (id: string) => { setFocusState(false);setDetailsOpen(!!id);setApplied(old=>({...old,countyId:id}));setDraft(old=>({...old,countyId:id})); setCountyData(undefined); setCountyError(''); setTracts(undefined); setTractError(''); setSelectedAlert(undefined) }
  const declarationIds = useMemo(() => [...new Set(historicalRecords.map(r => r.countyId) || [])], [historicalRecords])
  const mapData = useMemo<PublicMapData>(() => ({ counties, alerts, risk: activeState?.sources.nri.data?.counties || [], declarationCountyIds: declarationIds, tracts: showTracts ? tracts?.data || undefined : undefined, showAlerts, showRisk, showDeclarations }), [counties, alerts, activeState, declarationIds, tracts, showTracts, showAlerts, showRisk, showDeclarations])
  const countyTitle = String(selectedFeature?.properties?.NAME || countyId || 'Select a county')
  const reloadSources = () => { setError(''); setCountyError(''); setTractError(''); setLoading(true); setReload(r => r + 1) }
  return <>
    <aside className={`sidebar-container ${showFilters?'mobile-open':''}`}><div className="geo-sidebar live-sidebar"><div className="sidebar-intro"><h1>{pageTitle||'Active disasters'}</h1><p>Explore current alerts and find ways<br/>to support affected communities.</p></div><div className="sidebar-scroll"><label className="field-label" htmlFor="hazard-type">Disaster type</label><div className="select-wrap"><select id="hazard-type" value={draft.hazardFilter} onChange={e=>updateDraft('hazardFilter',e.target.value)}><option value="all">All alerts & observations ({filterAlerts.length})</option><optgroup label="Live alert types in selected state">{eventTypes.map(event=><option key={event} value={'event:'+event}>{event} ({filterAlerts.filter(a=>a.event===event).length})</option>)}</optgroup><optgroup label="Disaster categories">{hazardOptions.filter(h=>h.id!=='all').map(h=><option key={h.id} value={h.id}>{h.label}</option>)}</optgroup>{draft.hazardFilter.includes(':')&&!filterAlerts.some(a=>matchesAlertType(a,draft.hazardFilter))&&<option value={draft.hazardFilter}>Selected alert no longer active here</option>}</select></div><p className="live-filter-note">Live alerts for your selected area.</p><label className="public-field">State<select id="public-state" aria-label="Public data state" value={draft.state} onChange={e=>setDraft(old=>({...old,state:e.target.value,countyId:'',hazardFilter:initialHazard}))}><option value="ALL">All states</option>{stateOptions.map(s=><option key={s.code} value={s.code}>{s.name}</option>)}</select></label><label className="public-field">County<select aria-label="Public data county" value={draft.countyId} disabled={!filterCounties.features.length} onChange={e=>updateDraft('countyId',e.target.value)}><option value="">All counties</option>{[...filterCounties.features].sort((a,b)=>String(a.properties?.NAME).localeCompare(String(b.properties?.NAME))).map(f=><option key={String(f.id||f.properties?.GEOID)} value={String(f.id||f.properties?.GEOID)}>{String(f.properties?.NAME)}</option>)}</select></label><section className="live-filter-section"><label className="field-label" htmlFor="alert-severity">Severity</label><div className="select-wrap"><select id="alert-severity" value={draft.severities[0]||''} onChange={e=>updateDraft('severities',e.target.value?[e.target.value]:[])}><option value="">All severities</option>{['Extreme','Severe','Moderate','Minor','Unknown'].map(value=><option key={value}>{value}</option>)}<option value="Not applicable">Observed events</option></select></div></section><section className="live-filter-section community-alert-filters"><h2>Community tags</h2><small>Find alerts by community needs and county context.</small>{[{id:'vehicle',label:'Households without a vehicle',note:'ACS household estimate',disabled:filterState?.sources.acs?.status!=='available'},{id:'internet',label:'Households without internet',note:'Census survey estimate, not a current outage',disabled:filterState?.sources.acs?.status!=='available'},{id:'declarations',label:'Recent federal disaster',note:'Recent FEMA records',disabled:filterState?.sources.fema.status!=='available'},{id:'risk',label:'High long-term risk',note:'NRI national percentile ≥ 80',disabled:filterState?.sources.nri.status!=='available'}].map(tag=><label className={`live-indicator ${draft.indicators.includes(tag.id)?'selected':''}`} key={tag.id}><input type="checkbox" disabled={tag.disabled} checked={draft.indicators.includes(tag.id)} onChange={()=>updateDraft('indicators',draft.indicators.includes(tag.id)?draft.indicators.filter(t=>t!==tag.id):[...draft.indicators,tag.id])}/><span>{tag.label}<small>{tag.note}</small></span></label>)}{filterState?.sources.acs?.status==='configuration_required'&&<p className="live-filter-note">ACS filters require a configured Census API key.</p>}<label className="live-threshold">Households at least ≥ {draft.threshold}%<input aria-label="Community tag percentage threshold" type="range" min="0" max="50" step="1" value={draft.threshold} onChange={e=>updateDraft('threshold',Number(e.target.value))}/></label><div className="match-control"><span>Match tags</span><div>{(['any','all'] as const).map(mode=><button key={mode} aria-pressed={draft.indicatorMatch===mode} className={draft.indicatorMatch===mode?'chosen':''} onClick={()=>updateDraft('indicatorMatch',mode)}>{mode==='all'?'All':'Any'}</button>)}</div></div></section></div><div className="sidebar-actions"><button className="find-button" onClick={()=>{if(draft.state!==state){setStateData(filterState);setError('');setLoading(!filterState)}setFocusState(false);setApplied(draft);setSelectedAlert(undefined);if(draft.countyId!==countyId){setCountyData(undefined);setCountyError('');setTracts(undefined);setTractError('')}closeFilters();setDetailsOpen(false)}}>Apply filters<ArrowUpRight size={17}/></button><div className="filter-footer"><button onClick={()=>setDraft({...defaults,state:draft.state})}>Clear filters</button><span>{matchingIds.length} counties · {alerts.length} events</span></div><div className="sidebar-footnote"><span className="demo-label">Official public sources</span><button aria-label="View source information" onClick={()=>setDetailsOpen(true)}><Database size={14}/></button></div></div></div></aside>
    <main className="geo-map-frame public-map-frame"><section className="map-stage" aria-label="Public disaster data map">{geography && <USMap geography={geography} data={publicMapBase} layer="activity" focus={focus} showPopup={false} showForecast={false} showOverlays={false} showRadar={false} publicMapData={mapData} onPublicCounty={id=>{if(state!=='ALL'&&id.startsWith(stateOptions.find(s=>s.code===state)?.fips||'!'))changeCounty(id)}} onPublicAlert={id=>{setSelectedAlert(id);setDetailsOpen(true)}} onEvent={() => {}} onRegion={r=>{if(r.kind==='state')selectState(r.id)}} onExplore={() => {}} onClosePopup={() => {}} onResource={() => {}}/>}<div className="map-mini-toolbar"><button aria-label="Focus geographic search" title="Search" onClick={()=>{openFilters?.();requestAnimationFrame(()=>document.getElementById('public-state')?.focus())}}><Search size={17}/></button><span/><button aria-label="View official source records" title="Source records" onClick={()=>setDetailsOpen(true)}><Database size={16}/></button></div>{loading && <div className="public-map-loading" role="status"><LoaderCircle size={16}/>Retrieving public sources…</div>}{error && <div className="public-map-error" role="alert"><TriangleAlert size={17}/><p>{error}</p><button onClick={reloadSources}>Retry</button></div>}<div className="public-map-key"><strong>Alert severity</strong>{showRisk && <span><i className="key-nri"/>NRI percentile: lower → higher</span>}{showDeclarations && <span><i className="key-declaration"/>Historical declaration counties</span>}{showTracts && <span><i className="key-tract"/>2024 TIGER tract boundaries</span>}{showAlerts && <div className="severity-scale" aria-label="Alert severity: Minor, Moderate, Severe, Extreme"><div className="severity-gradient"/><div className="severity-scale-labels">{['Minor','Moderate','Severe','Extreme'].map(level=><span key={level} className={severities.includes(level)?'selected':''}>{level}</span>)}</div></div>}<small>{!alerts.length?'No matching alerts.':severities.length?`${alerts.length} ${severities[0].toLowerCase()} alerts ? focused on highest priority`:'Highest matching severity per area.'} County shading is approximate.</small></div><span className="public-map-provenance">NWS alerts · TIGERweb 2024 · source timestamps in records</span></section></main>
    <LiveAreaOverview data={activeState} alerts={alerts} county={activeCounty} countyId={countyId} countyName={countyTitle}/>
    {detailsOpen && <CountyOverviewDrawer title={countyId?countyTitle:state==='ALL'?'All states':stateOptions.find(s=>s.code===state)?.name||state} state={state} data={activeState} county={activeCounty} countySelected={!!countyId} alerts={alerts} selectedAlert={selectedAlert} loadingError={countyError} threshold={threshold} onClose={()=>setDetailsOpen(false)}/>}

  </>
}