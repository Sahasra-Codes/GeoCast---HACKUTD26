import {useSyncExternalStore} from 'react'
export const scenarioId='hurricane-marlow'
const key='geocast.scenario',event='geocast-scenario-change'
export function scenarioEnabled(){try{return localStorage.getItem(key)===scenarioId}catch{return false}}
export function setScenarioEnabled(enabled:boolean){try{if(enabled)localStorage.setItem(key,scenarioId);else localStorage.removeItem(key)}catch{/* session storage may be restricted */}window.dispatchEvent(new Event(event))}
function subscribe(listener:()=>void){window.addEventListener(event,listener);window.addEventListener('storage',listener);return()=>{window.removeEventListener(event,listener);window.removeEventListener('storage',listener)}}
export function useScenario(){return useSyncExternalStore(subscribe,scenarioEnabled,()=>false)}
export function scenarioUrl(url:string){return scenarioEnabled()?url+(url.includes('?')?'&':'?')+'scenario='+scenarioId:url}
