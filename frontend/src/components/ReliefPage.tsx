import ReliefPlanText from './ReliefPlanText'
import {scenarioEnabled,scenarioId,useScenario} from '../services/scenario'
import {SimulatedBadge} from './ScenarioControl'
import {useEffect,useState} from 'react'
import {ArrowRight,Download,Heart} from 'lucide-react'
import {stateOptions} from '../publicDataTypes'
import {getGeography} from '../services/api'
import type {Geography} from '../types'
import './ReliefPage.css'

type Source={name?:string;source?:string;retrievedAt?:string;status:string;note?:string;error?:string}
type Plan={simulated?:boolean;cached?:boolean;id:string;title:string;text:string;generatedAt:string;draft:boolean;model:string;alerts:{id:string;event:string;sourceUrl:string}[];location?:{city:string;state:string;countyId?:string;countyName:string};evidence?:{scopeNote:string;insights:Record<string,Source>;resources:Record<string,Source>}}
export default function ReliefPage({reportCounty}:{reportCounty?:string}={}){
 const simulated=useScenario()
 const [city,setCity]=useState(''),[state,setState]=useState(()=>{const code=new URLSearchParams(window.location.search).get('state');return stateOptions.some(s=>s.code===code)?code!:''}),[county,setCounty]=useState(()=>new URLSearchParams(window.location.search).get('county')||'')
 const [geography,setGeography]=useState<Geography>(),[countyError,setCountyError]=useState(''),[plan,setPlan]=useState<Plan>(),[error,setError]=useState(''),[generating,setGenerating]=useState(false)
 useEffect(()=>{getGeography().then(setGeography).catch(()=>setCountyError('County list unavailable. You can continue with city and state.'))},[])
 useEffect(()=>{setPlan(undefined);setError('')},[simulated])
 useEffect(()=>{
  if(!reportCounty||!simulated)return
  const controller=new AbortController();setGenerating(true);setError('')
  fetch('/api/relief/scenario-plans/'+reportCounty,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Cached plan unavailable. Use Regenerate.');if(!controller.signal.aborted)setPlan(data)}).catch(error=>{if(!controller.signal.aborted)setError(error.message)}).finally(()=>{if(!controller.signal.aborted)setGenerating(false)})
  return()=>controller.abort()
 },[reportCounty,simulated])
 const fips=stateOptions.find(s=>s.code===state)?.fips
 const counties=(geography?.regions||[]).filter(region=>region.kind==='county'&&region.id.startsWith(fips||'--')).sort((a,b)=>a.name.localeCompare(b.name))
 async function generate(regenerate=false){
  if(generating||(!reportCounty&&(!city.trim()||!state)))return
  setGenerating(true);setError('');setPlan(undefined)
  try{
   const response=await fetch('/api/relief/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({city:reportCounty?(plan?.location?.city||'Selected scenario county'):city.trim(),state:reportCounty?'TX':state,county:reportCounty||county,...(simulated?{scenario:scenarioId,regenerate}:{})}),signal:AbortSignal.timeout(240000)})
   const value=await response.json()
   if(!response.ok)throw new Error(value.error||'The relief plan could not be generated. Please retry.')
   if(scenarioEnabled()!==simulated)return
   setPlan(value)
   requestAnimationFrame(()=>document.getElementById('relief-plan-result')?.scrollIntoView({behavior:'smooth',block:'start'}))
  }catch(error){setError(error instanceof Error?error.message:'The relief plan could not be generated. Please retry.')}
  finally{setGenerating(false)}
 }
 function download(){
  if(!plan)return
  const url=URL.createObjectURL(new Blob([`${plan.simulated?'SIMULATED: Hurricane Marlow (fictional)\n':''}DRAFT - HUMAN REVIEW REQUIRED\n${plan.title}\nGenerated ${plan.generatedAt}\n\n${plan.text}`],{type:'text/plain;charset=utf-8'}))
  const link=document.createElement('a');link.href=url;link.download='GeoCast-relief-plan.txt';link.click();URL.revokeObjectURL(url)
 }
 const sources=plan?.evidence?[...Object.values(plan.evidence.insights),...Object.values(plan.evidence.resources)]:[]
 return <main className="relief-page relief-simple"><header className="relief-heading"><div className="relief-heading-title"><Heart size={27}/><div><h1>Relief plan</h1><p>A practical plan using local Insights and Resources.</p></div></div></header>
  {!reportCounty&&<section className="relief-request-card" aria-label="Create a relief plan"><h2>Where is help needed?</h2><p>Enter a city and state. Gemini will use the area's alerts, community estimates, and public resources to draft a plan.</p>
   <form className="relief-location-form" onSubmit={event=>{event.preventDefault();void generate()}}>
    <label>City<input name="city" autoComplete="address-level2" required maxLength={100} placeholder="e.g., Dallas" value={city} disabled={generating} onChange={event=>{setCity(event.target.value);setPlan(undefined);setError('')}}/></label>
    <label>State<select aria-label="State" name="state" required autoComplete="address-level1" value={state} disabled={generating} onChange={event=>{setState(event.target.value);setCounty('');setPlan(undefined);setError('')}}><option value="">Select a state</option>{stateOptions.map(option=><option key={option.code} value={option.code}>{option.name}</option>)}</select></label>
    <label>County (optional)<select aria-label="County (optional)" name="county" value={county} disabled={generating||!counties.length} onChange={event=>{setCounty(event.target.value);setPlan(undefined);setError('')}}><option value="">Match from city</option>{counties.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
    <button className="relief-generate" disabled={generating||!city.trim()||!state} type="submit">{generating?'Creating your plan...':'Generate relief plan'}<ArrowRight size={18}/></button>
   </form>
   {countyError&&<p role="status">{countyError}</p>}{generating&&<p role="status">Loading local Insights and Resources, then asking Gemini to write your plan. This may take a few minutes.</p>}{error&&<p role="alert" className="relief-error">{error}</p>}
   <small>AI-generated draft for human review. Confirm local conditions and resource availability before acting.</small>
  </section>}
  {reportCounty&&!simulated&&<p role="status">Enable Simulate major event to view this fictional report.</p>}
  {reportCounty&&simulated&&error&&<p role="alert">{error}<button onClick={()=>void generate(true)}>Regenerate</button></p>}
  {reportCounty&&simulated&&generating&&<p role="status">Loading simulated relief report...</p>}
  {plan&&(!plan.simulated||simulated)&&<section id="relief-plan-result" className="relief-plan-result" aria-label="Generated relief plan"><div className="relief-plan-header"><div>{plan.simulated&&<SimulatedBadge/>}<span>Gemini draft{plan.cached?' - cached county exercise plan':''}</span><h2>{plan.title}</h2><p>{new Date(plan.generatedAt).toLocaleString()}</p></div><button onClick={download}><Download size={17}/>Download plan</button></div><ReliefPlanText text={plan.text}/><div className="relief-plan-actions"><button type="button" disabled={generating} onClick={()=>void generate(true)}>Regenerate</button>{plan.simulated&&!reportCounty&&<p><a href={'/reports/relief?county='+(plan.location?.countyId||county||'')}>Open simulated report</a></p>}</div><details><summary>Sources used</summary>{plan.evidence?.scopeNote&&<p>{plan.evidence.scopeNote}</p>}{sources.map((source,index)=><p key={index}><strong>{source.name||source.source}</strong> - {source.status}{source.retrievedAt?` / Retrieved ${new Date(source.retrievedAt).toLocaleString()}`:''}{source.note||source.error?<><br/>{source.note||source.error}</>:null}</p>)}{plan.alerts.map(alert=><p key={alert.id}>{alert.event}{/^https:\/\//.test(alert.sourceUrl)&&<> - <a href={alert.sourceUrl} target="_blank" rel="noreferrer">Official alert</a></>}</p>)}</details></section>}
 </main>
}
