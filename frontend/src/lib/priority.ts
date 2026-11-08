import type {Geometry,Position} from 'geojson'
import type {PublicAlert} from '../publicDataTypes'
import {isCurrentAlert} from '../services/alertFilters'
export const resourceKinds=['shelter','food','medical'] as const
export type ResourceKind=typeof resourceKinds[number]
export interface EvidenceSource {name:string;retrievedAt:string;status:string;sourceUrl?:string;vintage?:string;error?:string|null}
export interface CensusInputs {pct65plus:number|null;pctNoVehicle:number|null;pctBelowPoverty:number|null;pctNoInternet:number|null;name?:string}
export interface ResourceData {source:string;retrievedAt:string;status:string;note:string;items:{coordinates?:{latitude:number|null;longitude:number|null};title?:string;simulated?:boolean;capacity?:number;countyId?:string}[]}
export type CountyResources=Partial<Record<ResourceKind,ResourceData>>
export interface PriorityCounty {id:string;name:string;geometry?:Geometry;census?:CensusInputs;resources?:CountyResources}
export interface PriorityRow {id:string;name:string;topAlert:PublicAlert;alertWeight:number;vulnerability:number|null;access:number|null;score:number;simulated:boolean;flagged:boolean;partial:boolean;usedCategories:ResourceKind[];notes:string[];inputs?:CensusInputs;distances:Record<ResourceKind,number|null>;nearestSources:Partial<Record<ResourceKind,{name:string;retrievedAt:string;simulated?:boolean}>>}
const clamp=(n:number)=>Math.max(0,Math.min(1,n))
export const validPercent=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100
export function alertWeight(alert:PublicAlert){
 const rank:Record<string,number>={Minor:1,Moderate:2,Severe:3,Extreme:4}
 const certainty:Record<string,number>={Observed:1,Likely:.85,Possible:.6,Unlikely:.4,Unknown:.6}
 return ((rank[alert.severity]||0)/4)*(certainty[alert.certainty]??.6)
}
export function vulnerability(census:CensusInputs|undefined):number|null{
 if(!census||![census.pct65plus,census.pctNoVehicle,census.pctBelowPoverty,census.pctNoInternet].every(validPercent))return null
 return .30*Math.min(census.pct65plus!/40,1)+.30*Math.min(census.pctNoVehicle!/20,1)+.25*Math.min(census.pctBelowPoverty!/35,1)+.15*Math.min(census.pctNoInternet!/25,1)
}
export function haversineMiles(a:Position,b:Position){
 const rad=Math.PI/180,dlat=(b[1]-a[1])*rad,dlon=(b[0]-a[0])*rad
 const h=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlon/2)**2
 return 3958.7613*2*Math.asin(Math.sqrt(clamp(h)))
}
// Area-weighted polygon centroid; holes subtract area. Planar lon/lat is approximate.
export function countyCentroid(geometry:Geometry|undefined):[number,number]|null{
 if(!geometry||!['Polygon','MultiPolygon'].includes(geometry.type))return null
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[]
 const globalAnchor=polygons[0]?.[0]?.[0]?.[0]
 let total=0,xsum=0,ysum=0
 for(const polygon of polygons)for(const [index,ring] of polygon.entries()){
  if(ring.length<4||ring.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1])))continue
  const anchor=globalAnchor??ring[0][0],points=ring.map(p=>[anchor+((p[0]-anchor+540)%360)-180,p[1]])
  let crossSum=0,x=0,y=0
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],cross=a[0]*b[1]-b[0]*a[1];crossSum+=cross;x+=(a[0]+b[0])*cross;y+=(a[1]+b[1])*cross}
  if(Math.abs(crossSum)<1e-12)continue
  const weight=Math.abs(crossSum)/2*(index===0?1:-1)
  total+=weight;xsum+=x/(3*crossSum)*weight;ysum+=y/(3*crossSum)*weight
 }
 if(total<=0)return null
 return [((xsum/total+540)%360)-180,ysum/total]
}
export function alertedCountyIds(alerts:PublicAlert[],now:number,stateFips?:string,selectedId?:string){
 return [...new Set(alerts.filter(a=>a.kind!=='observed_earthquake'&&isCurrentAlert(a,now)&&(!selectedId||a.id===selectedId)).flatMap(a=>a.countyIds).filter(id=>!stateFips||id.startsWith(stateFips)))].sort()
}
export function priorityScore(weight:number,vulnerabilityValue:number,access:number){return Math.round(100*clamp(weight)*(.55*clamp(vulnerabilityValue)+.45*clamp(access)))}
export function rankCounties(alerts:PublicAlert[],counties:PriorityCounty[],now:number,stateFips?:string,selectedId?:string):PriorityRow[]{
 const scope=alerts.filter(a=>a.kind!=='observed_earthquake'&&isCurrentAlert(a,now)&&(!selectedId||a.id===selectedId))
 const lookup=new Map(counties.map(c=>[c.id,c]))
 const pools=Object.fromEntries(resourceKinds.map(kind=>[kind,counties.flatMap(c=>{
  const result=c.resources?.[kind]
  if(result?.status!=='available')return []
  return result.items.flatMap(item=>{const p=item.coordinates;return p&&typeof p.latitude==='number'&&typeof p.longitude==='number'&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180?[{point:[p.longitude,p.latitude] as Position,name:result.source,retrievedAt:result.retrievedAt,simulated:!!item.simulated}]:[]})
 })])) as Record<ResourceKind,{point:Position;name:string;retrievedAt:string;simulated:boolean}[]>
 return alertedCountyIds(scope,now,stateFips).map(id=>{
  const county=lookup.get(id),topAlert=scope.filter(a=>a.countyIds.includes(id)).sort((a,b)=>alertWeight(b)-alertWeight(a)||a.id.localeCompare(b.id))[0]
  const center=countyCentroid(county?.geometry),v=vulnerability(county?.census),notes:string[]=[],distances={shelter:null,food:null,medical:null} as Record<ResourceKind,number|null>,nearestSources:PriorityRow['nearestSources']={}
  if(v===null)notes.push('Census inputs unavailable or incomplete.')
  if(!center)notes.push('County geometry unavailable; distances cannot be calculated.')
  for(const kind of resourceKinds){
   const status=county?.resources?.[kind]?.status
   if(status!=='available')notes.push(`${kind}: ${status||'data unavailable'}.`)
   if(!pools[kind].length){notes.push(kind==='shelter'&&status==='available'&&!county?.resources?.shelter?.items.length&&county?.resources?.shelter?.source.includes('FEMA')?'shelter: No open shelters reported; excluded from access average.':`${kind}: no positioned resources in loaded data; excluded from access average.`);continue}
   if(center){const nearest=pools[kind].map(p=>({...p,d:haversineMiles(center,p.point)})).sort((a,b)=>a.d-b.d)[0];distances[kind]=nearest.d;nearestSources[kind]={name:nearest.name,retrievedAt:nearest.retrievedAt,simulated:nearest.simulated}}
  }
  const distancesLoaded=Object.values(distances).filter((n):n is number=>n!==null),access=distancesLoaded.length?distancesLoaded.reduce((sum,d)=>sum+Math.min(d/50,1),0)/distancesLoaded.length:null
  const usedCategories=resourceKinds.filter(kind=>distances[kind]!==null),partial=usedCategories.length<3
  notes.push(`Resource categories used: ${usedCategories.join(", ")||"none"}.`)
  const flagged=v===null||access===null||!center
  if(flagged)notes.push('Alert-weight-only fallback: round(100 * alertWeight). Data unavailable; not a complete priority assessment.')
  const weight=alertWeight(topAlert)
  const simulated=scope.some(a=>a.simulated&&a.countyIds.includes(id))||Object.values(nearestSources).some(source=>source?.simulated)
  if(simulated)notes.push('SIMULATED: Hurricane Marlow (fictional). Real Census inputs; fictional storm and shelter capacities.')
  return {id,simulated,name:county?.name||id,topAlert,alertWeight:weight,vulnerability:v,access,score:flagged?Math.round(100*weight):priorityScore(weight,v!,access!),flagged,partial,usedCategories,notes,inputs:county?.census,distances,nearestSources}
 }).sort((a,b)=>b.score-a.score||(b.vulnerability??-1)-(a.vulnerability??-1)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id))
}

export function severityOnlyRanking(rows:PriorityRow[]):PriorityRow[]{return [...rows].sort((a,b)=>b.alertWeight-a.alertWeight||(b.vulnerability??-1)-(a.vulnerability??-1)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id))}
