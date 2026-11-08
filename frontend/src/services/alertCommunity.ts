import type {PublicAlert,PublicStateData} from '../publicDataTypes'
import {classifyHazard,type Hazard} from '../data/catalog'
export const disasterTitles:Record<Hazard,string>={all:'All disasters',floods:'Flood',wildfires:'Fire',tornadoes:'Tornado',hurricanes:'Hurricane', 'winter-storms':'Winter weather',earthquakes:'Earthquake','extreme-heat':'Extreme heat','severe-weather':'Severe weather',other:'Other alerts'}
export const communityTags=[{id:'vehicle',label:'Households without a vehicle'},{id:'internet',label:'Households without internet'}] as const
export interface AlertCommunityTag {id:string;label:string;counties:string[];threshold:number;period:string;estimates:{county:string;percent:number}[]}
export function matchesCommunityPercentage(value:number|null|undefined,threshold:number){
 return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100&&value>=threshold
}
export function groupDisasterAlerts(alerts:PublicAlert[]){
 const groups=new Map<Hazard,PublicAlert[]>()
 for(const alert of alerts){const key=classifyHazard(alert.event);groups.set(key,[...(groups.get(key)||[]),alert])}
 return [...groups].map(([id,alerts])=>({id,title:disasterTitles[id],alerts}))
}
export function getAlertCommunityTags(alert:PublicAlert,data:PublicStateData|undefined,threshold:number,countyId=''):AlertCommunityTag[]{
 if(data?.sources.acs?.status!=='available')return []
 const counties=(data.sources.acs.data?.counties||[]).filter(c=>alert.countyIds.includes(c.countyId)&&(!countyId||countyId===c.countyId))
 return communityTags.flatMap(tag=>{
  const matching=counties.filter(c=>{const value=tag.id==='internet'?c.noInternetPercent:c.noVehiclePercent;return matchesCommunityPercentage(value,threshold)})
  return matching.length?[{...tag,threshold,counties:matching.map(c=>c.name),period:data.sources.acs?.data?.period||'Survey period unavailable',estimates:matching.map(c=>({county:c.name,percent:(tag.id==='internet'?c.noInternetPercent:c.noVehiclePercent)!}))}]:[]
 })
}
