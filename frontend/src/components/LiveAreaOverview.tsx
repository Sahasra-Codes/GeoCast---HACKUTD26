import type {PublicAlert,PublicCountyData,PublicStateData} from '../publicDataTypes'
import {stateOptions} from '../publicDataTypes'
import {compareAlertPriority} from '../services/alertFilters'
const valid=(value:number|null|undefined):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0
const format=(value:number|null|undefined)=>valid(value)?value.toLocaleString():'Not available'
export default function LiveAreaOverview({data,alerts,county,countyId='',countyName}:{data?:PublicStateData;alerts:PublicAlert[];county?:PublicCountyData;countyId?:string;countyName?:string}){
 const survey=data?.sources.acs?.status==='available'?data.sources.acs.data:undefined
 const detail=county?.countyId===countyId&&county.sources.acs.status==='available'?county.sources.acs.data:undefined
 const rows=survey?.counties||[]
 const selected=rows.find(row=>row.countyId===countyId)
 const expected=data?.sources.boundaries.status==='available'?data.sources.boundaries.data?.features.map(f=>String(f.id||f.properties?.GEOID)):undefined
 const total=(field:'population'|'households')=>{
  if(!expected?.length||!survey)return null
  const lookup=new Map(rows.map(row=>[row.countyId,row[field]]))
  if(expected.some(id=>!valid(lookup.get(id))))return null
  return expected.reduce((sum,id)=>sum+lookup.get(id)!,0)
 }
 const population=countyId?(detail?.population.estimate??selected?.population):total('population')
 const households=countyId?(detail?.households.estimate??selected?.households):total('households')
 const period=detail?.period||survey?.period
 const area=countyId?(detail?.name||selected?.name||countyName||'Selected county'):data?.state==='ALL'?'All states':stateOptions.find(s=>s.code===data?.state)?.name||'Selected area'
 const weather=alerts.filter(a=>a.kind!=='observed_earthquake').sort(compareAlertPriority)
 const known=data?.sources.noaa.status==='available'
 const earthquakes=alerts.filter(a=>a.kind==='observed_earthquake')
 return <aside className="area-overview simple-area-overview" aria-label="Area overview"><header className="simple-area-heading"><p className="area-overview-label">Area overview</p><h2>{area}</h2></header>{countyId?<section className="simple-area-population" aria-label="Population"><h3>Population</h3><strong>{format(population)}</strong><p>{period?`Census survey estimate / ${period}`:'Census estimate unavailable'}</p><small>Area population, not people affected.</small></section>:<section className="state-response-context" aria-label="Community planning counts"><div><h3>Residents age 65+</h3><strong>{format(survey?.summary?.residents65Plus)}</strong></div><div><h3>Households without a vehicle</h3><strong>{format(survey?.summary?.noVehicleHouseholds)}</strong></div><p>{period?`Census survey estimates / ${period}`:'Census estimates unavailable'}</p><small>Statewide planning context. These groups may overlap and are not confirmed requests for help.</small></section>}<dl className="simple-area-facts">{countyId&&<div><dt>Households</dt><dd>{format(households)}</dd></div>}<div><dt>Active weather alerts</dt><dd>{known?weather.length:'Not available'}</dd></div>{earthquakes.length>0&&<div><dt>Observed earthquakes<small className="overview-observation-period">Past 24 hours</small></dt><dd>{earthquakes.length}</dd></div>}{known&&weather.length>0&&<div><dt>Highest alert severity</dt><dd>{weather[0].severity}</dd></div>}</dl>{period&&<p className="simple-area-note">Community estimates cover the {period} survey period, not a single recorded year.</p>}</aside>
}
