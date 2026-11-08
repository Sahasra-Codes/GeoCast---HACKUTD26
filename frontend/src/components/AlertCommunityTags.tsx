import type {PublicAlert,PublicStateData} from '../publicDataTypes'
import {getAlertCommunityTags} from '../services/alertCommunity'
export default function AlertCommunityTags({alert,data,threshold,countyId=''}:{alert:PublicAlert;data?:PublicStateData;threshold:number;countyId?:string}){
 const tags=getAlertCommunityTags(alert,data,threshold,countyId)
 if(!tags.length)return null
 const percent=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:1})
 return <div className="alert-community-context"><div className="alert-community-tags" aria-label="Community context tags">{tags.map(tag=>{
  const values=tag.estimates.map(e=>e.percent),low=Math.min(...values),high=Math.max(...values)
  const range=low===high?`${percent(low)}%`:`${percent(low)}-${percent(high)}%`
  const statement=tag.id==='internet'?'had no internet access':'had no vehicle available'
  return <span key={tag.id} data-tag={tag.id} title={`Census estimate: at least ${threshold}% of households. ${tag.estimates.map(e=>`${e.county}: ${percent(e.percent)}%`).join('; ')}. Survey period: ${tag.period}. County-wide context, not a current outage or confirmed impact. Percentages are survey estimates with sampling uncertainty.`}>{range} of households {statement}<small>{tag.counties.length===1?tag.counties[0]:`Across ${tag.counties.length} qualifying counties; county estimates vary`}</small><small>Census estimate / {tag.period}</small></span>
 })}</div><p className="alert-tag-explanation">County survey estimates, not current outages.</p></div>
}
