import type {FeatureCollection,Geometry} from 'geojson'
import type {PublicAlert} from '../publicDataTypes'
export function eventEnd(event:PublicAlert){return {label:event.ends?'Ends':'Alert expires',value:event.ends||event.expires}}
export function eventCountyNames(event:PublicAlert,features:FeatureCollection<Geometry>['features']){
 const ids=[...new Set(event.countyIds)]
 const names=ids.flatMap(id=>{
  const feature=features.find(f=>String(f.id||f.properties?.GEOID)===id)
  const name=feature?.properties?.NAME||feature?.properties?.BASENAME
  return name?[{id,name:String(name)}]:[]
 })
 // The same county can be repeated by multiple NWS zones; county FIPS is its identity.
 return names.filter((entry,index,all)=>all.findIndex(other=>other.id.slice(0,2)===entry.id.slice(0,2)&&other.name.trim().toLowerCase()===entry.name.trim().toLowerCase())===index)
}
export function countySummary(event:PublicAlert,features:FeatureCollection<Geometry>['features']){
 const names=eventCountyNames(event,features),ids=[...new Set(event.countyIds)]
 const count=names.length+ids.filter(id=>!features.some(f=>String(f.id||f.properties?.GEOID)===id&&(f.properties?.NAME||f.properties?.BASENAME))).length
 return count?`${count} ${count===1?'county':'counties'}`:'County links not supplied'
}
export function alertMeaning(event:PublicAlert){
 if(event.kind==='observed_earthquake')return 'Observed earthquake, not a weather watch or warning.'
 const subject=/flood/i.test(event.event)?'Flooding':/freeze|frost/i.test(event.event)?'Freezing conditions':'Hazardous conditions'
 const certainty:Record<string,string>={Observed:'have been observed',Likely:'are likely',Possible:'are possible',Unlikely:'are unlikely'}
 let likelihood=certainty[event.certainty]
 if(subject==='Flooding'&&likelihood)likelihood=likelihood.replace('have been','has been').replace('are ','is ')
 const base=likelihood?`${subject} ${likelihood}`:/watch/i.test(event.event)?`${subject} ${subject==='Flooding'?'is':'are'} possible`:/warning/i.test(event.event)?`${subject} ${subject==='Flooding'?'is':'are'} occurring or imminent`:'See the official alert for expected conditions'
 const urgency:Record<string,string>={Immediate:'response needed now',Expected:'response needed soon',Future:'response needed in the near future',Past:'NWS urgency is Past',Unknown:'response timing not supplied'}
 return `${base}; ${urgency[event.urgency]||'response timing not supplied'} (NWS: ${event.certainty||'Unknown'} / ${event.urgency||'Unknown'}).`
}
