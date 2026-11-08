import {useScenario} from '../services/scenario'
import {SimulatedBadge} from './ScenarioControl'
import {eventEnd,countySummary,alertMeaning} from '../services/insightsPresentation'
import OfficialAlertText from './OfficialAlertText'
import ReliefActions from './ReliefActions'
import {useEffect,useState} from 'react'
import {ArrowLeft,ExternalLink} from 'lucide-react'
import {getPublicState} from '../services/publicData'
import {alertImpact,isCurrentAlert} from '../services/alertFilters'
import type {PublicAlert,PublicStateData} from '../publicDataTypes'
export default function AlertInsights(){
 const simulated=useScenario()
 const params=new URLSearchParams(window.location.search)
 const state=params.get('state')||'TX',id=params.get('alert')
 const [alert,setAlert]=useState<PublicAlert>()
 const [sourceData,setSourceData]=useState<PublicStateData>()
 const [message,setMessage]=useState(id?'Loading alert details...':'Select an alert on the map and choose View impacts.')
 const [retry,setRetry]=useState(0)
 useEffect(()=>{
  if(!id)return
  const controller=new AbortController()
  getPublicState(state,controller.signal).then(data=>{
   if(controller.signal.aborted)return
   setSourceData(data)
   const source=data.sources.noaa
   if(source.status!=='available'){setMessage(source.error||'Alert details are unavailable.');return}
   const selected=[...(source.data?.alerts||[]),...(data.sources.earthquakes?.data?.events||[])].find(a=>a.id===id)
   setAlert(selected)
   if(!selected)setMessage('This alert is no longer in the active feed. Return to the map for current alerts.')
  }).catch(()=>{if(!controller.signal.aborted)setMessage('Could not load this alert. Please try again.')})
  return()=>controller.abort()
 },[state,id,retry,simulated])
 const impact=alert?alertImpact(alert):undefined
 const date=(value:string|null)=>value?new Date(value).toLocaleString():'Not supplied'
 return <main className="alert-insights" aria-label="Insights"><a className="insights-back" href="/map"><ArrowLeft size={15}/>Back to map</a><h1>Alert insights</h1>{alert&&(!alert.simulated||simulated)?<article className="public-alert-detail insights-card"><header>{alert.simulated&&<SimulatedBadge/>}<h2>{alert.event} <span>|</span> {alert.severity}</h2></header><p className="insights-area">{countySummary(alert,sourceData?.sources.boundaries.data?.features||[])}</p><p className="insights-caption">{alertMeaning(alert)}</p><details><summary>Zones</summary><p>{alert.area}</p></details>{!isCurrentAlert(alert,Date.now())&&<p role="status">This alert has expired.</p>}<dl><div><dt>Affected area</dt><dd>{alert.area}</dd></div><div><dt>NWS alert severity</dt><dd>{alert.severity}</dd></div><div><dt>Issued</dt><dd>{date(alert.sent)}</dd></div><div><dt>{eventEnd(alert).label}</dt><dd>{date(eventEnd(alert).value)}</dd></div></dl><section><h3>Impacts</h3>{impact?.floodCategory&&<p>River flood category: {impact.floodCategory}</p>}{impact?.what&&<p>{impact.what}</p>}<p>{impact?.impacts||'See the official description below for local conditions.'}</p></section>{alert.instruction&&<section><h3>Official instructions</h3><p>{alert.instruction}</p></section>}<section className="alert-relief-link"><h3>Provide relief</h3><a href={'/relief?'+new URLSearchParams({state,alert:alert.id})}>Explore relief for this alert</a></section><ReliefActions/><details><summary>Full issued alert</summary><OfficialAlertText text={alert.description||alert.headline||'No description supplied.'}/></details><a className="insights-source" href={alert.sourceUrl.startsWith('https://')?alert.sourceUrl:'https://www.weather.gov/alerts'} target="_blank" rel="noreferrer">{alert.simulated?'Fictional scenario source':'Read official alert'}<ExternalLink size={14}/></a><small>NWS alert severity and river flood category are different measures. Alert severity does not describe damage to every property.</small></article>:<div className="insights-empty"><p role="status">{message}</p>{id&&<button onClick={()=>{setMessage('Loading alert details...');setRetry(r=>r+1)}}>Retry</button>}</div>}</main>
}
