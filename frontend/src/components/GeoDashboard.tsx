import InsightsPage from './InsightsPage'
import AlertInsights from './AlertInsights'
import ReliefPage from './ReliefPage'
import {useState} from 'react'
import {Menu,Moon,Sun,X} from 'lucide-react'
import AccountMenu from './AccountMenu'
import Chatbot from './Chatbot'
import PublicDataWorkspace from './PublicDataWorkspace'
import {DisasterDirectory,ResourcesPage} from './DirectoryPages'
import {hazardOptions} from '../data/catalog'
export default function GeoDashboard(){
 const [night,setNight]=useState(false),[mobileFilters,setMobileFilters]=useState(false)
 const path=window.location.pathname.replace(/\/+$/,'')||'/map'
 const hazard=hazardOptions.find(h=>h.path===path)
 const isReport=path==='/reports/relief'
 const isResource=path==='/resources'||path.startsWith('/resources/'),isRelief=path==='/relief',isDirectory=path==='/disasters'
 const isInsights=path==='/insights'
 const isMap=!isResource&&!isRelief&&!isDirectory&&!isInsights&&!isReport
 const nav=[{label:'Map',path:'/map',active:path==='/map'||path==='/'},{label:'Insights',path:'/insights',active:path==='/insights'},{label:'Resources',path:'/resources',active:isResource},{label:'Relief',path:'/relief',active:isRelief}]
 return <div className={`geo-app geocast real-app ${night?'night-mode':''} ${isMap?'map-page':'content-page'}`}><header className="geo-header"><a href="/map" className="geocast-brand" aria-label="State Farm GeoCast home"><span className="statefarm-wordmark"><svg width="30" height="25" viewBox="0 0 40 32" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="2.7"><ellipse cx="20" cy="9" rx="9" ry="6"/><ellipse cx="10" cy="22" rx="9" ry="6"/><ellipse cx="30" cy="22" rx="9" ry="6"/></g></svg><span>State Farm<sup>®</sup></span></span><i/><span className="geocast-wordmark"><img className="geocast-brand-mascot" src="/geo.png" alt="" width="42" height="48"/><span>GeoCast</span></span></a><nav className="primary-tabs" aria-label="Main navigation">{nav.map(item=><a key={item.path} className={item.active?'active':''} href={item.path} aria-current={item.active?'page':undefined}>{item.label}</a>)}</nav><div className="header-right"><button className="night-button" aria-label="Toggle night view" aria-pressed={night} onClick={()=>setNight(!night)}>{night?<Sun size={17}/>:<Moon size={17}/>}</button><AccountMenu/>{isMap&&<button className="mobile-filter-button" aria-label="Toggle filters" onClick={()=>setMobileFilters(!mobileFilters)}>{mobileFilters?<X size={20}/>:<Menu size={20}/>}</button>}</div></header>{isInsights?(new URLSearchParams(window.location.search).has('alert')?<AlertInsights/>:<InsightsPage/>):isMap?<div className="geo-workspace"><PublicDataWorkspace showFilters={mobileFilters} closeFilters={()=>setMobileFilters(false)} openFilters={()=>setMobileFilters(true)} initialHazard={hazard?.id||'all'} pageTitle={hazard&&hazard.id!=='all'?hazard.label:undefined} initialDetailsOpen={false}/></div>:isReport?<ReliefPage reportCounty={new URLSearchParams(window.location.search).get('county')||''}/>:isDirectory?<DisasterDirectory/>:isRelief?<ReliefPage/>:<><ResourcesPage relief={isRelief} resourceId={path.startsWith('/resources/')?path.slice('/resources/'.length):undefined}/></>}<Chatbot context={JSON.stringify({site:'GeoCast',page:path,hazard:hazard?.label||'all',mode:'Insights shows impacts and official instructions for the selected alert. Public map sources: NWS live warnings; USGS observed earthquakes; NOAA observed radar; FEMA and NRI historical context; ACS survey estimates. No verified shelter availability. Never describe Silent Zone records as real.'})} onNavigate={target=>{if(target==='filters'){if(!isMap)window.location.assign('/map');else{setMobileFilters(true);requestAnimationFrame(()=>document.getElementById('public-state')?.focus())}}if(target==='assistance')window.location.assign('/resources');if(target==='about')window.location.assign('/insights')}}/></div>
}
