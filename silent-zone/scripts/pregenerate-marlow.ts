// Imports the same environment configuration and plan generator used by the running app.
import '../src/server.ts';
import {readFile} from 'node:fs/promises';
import {createReliefPlan,getCachedMarlowPlan} from '../src/relief.ts';
const scenario=JSON.parse(await readFile(new URL('../../data/scenarios/hurricane-marlow.json',import.meta.url),'utf8'));
const ids=[...new Set<string>(scenario.alerts.flatMap((alert:{countyIds:string[]})=>alert.countyIds))];
let cursor=0,failures=0;
async function work(){while(cursor<ids.length){const id=ids[cursor++];if(await getCachedMarlowPlan(id)){console.log(id,'cached');continue}let complete=false;for(let attempt=0;attempt<3&&!complete;attempt++){try{const plan=await createReliefPlan({city:'Scenario county',state:'TX',county:id,scenario:'hurricane-marlow',regenerate:true});console.log(id,'generated',plan.wordCount,'words');complete=true}catch(error){console.log(id,'attempt',attempt+1,error instanceof Error?error.message:'failed');if(attempt<2)await new Promise(resolve=>setTimeout(resolve,5000))}}if(!complete)failures++}}
await Promise.all([work(),work()]);
console.log('Scenario counties',ids.length,'failures',failures);if(failures)process.exitCode=1;
