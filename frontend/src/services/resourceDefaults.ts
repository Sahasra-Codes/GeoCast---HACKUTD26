import {stateOptions} from '../publicDataTypes'
export const selectionKey='geocast.insightsSelection',priorityKey='geocast.topPriorityCounty'
export function countyState(id:string){return /^\d{5}$/.test(id)?stateOptions.find(state=>id.startsWith(state.fips))?.code:undefined}
export function rememberInsightsSelection(state:string,countyId:string){try{sessionStorage.setItem(selectionKey,JSON.stringify({state,countyId}))}catch{}}
export function rememberTopPriority(state:string,countyId:string|undefined){try{if(countyId)sessionStorage.setItem(priorityKey,JSON.stringify({state,countyId,at:Date.now()}));else sessionStorage.removeItem(priorityKey)}catch{}}
export function readResourceCounty(){
 try{
  const selected=JSON.parse(sessionStorage.getItem(selectionKey)||'null'),top=JSON.parse(sessionStorage.getItem(priorityKey)||'null')
  if(selected?.countyId&&countyState(selected.countyId)===selected.state)return selected.countyId as string
  if(top?.countyId&&countyState(top.countyId)&&(top.state==='ALL'||countyState(top.countyId)===top.state)&&(!selected||selected.state===top.state)&&Date.now()-top.at<300000)return top.countyId as string
 }catch{}
 return ''
}
