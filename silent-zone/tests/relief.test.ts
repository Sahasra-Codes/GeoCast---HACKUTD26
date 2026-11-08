import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReliefPlan,getLiveAlerts,getReliefContext,getCachedMarlowPlan,ReliefError,type ReliefAlert} from '../src/relief.ts';
const alert=(id:string,severity:string):ReliefAlert=>({id,severity,event:'Flood Warning',urgency:'Immediate',certainty:'Observed',area:'Florida test area',description:'Official fixture text',instruction:'Official instruction',headline:null,sent:null,expires:'2099-01-01T00:00:00Z',sourceUrl:'https://api.weather.gov',countyIds:['12117']});
test('relief plan re-fetches authoritative facts, sorts by severity and passes request as data',async()=>{
 const alerts=[alert('minor','Minor'),alert('severe','Severe')];
 const plan=await createReliefPlan({alertIds:['minor','severe'],request:'Florida flooding relief',description:'fabricated data'}, {alerts,generate:async prompt=>{
  const data=JSON.parse(prompt);
  assert.equal(data.rankedLiveAlerts[0].id,'severe');
  assert.equal(data.rankedLiveAlerts[1].id,'minor');
  assert.equal(data.rankedLiveAlerts[0].description,'Official fixture text');
  assert.ok(!prompt.includes('fabricated data'));
  return '1. Executive summary\nDetailed test draft.';
 }});
 assert.equal(plan.source,'gemini');assert.equal(plan.draft,true);assert.equal(plan.alerts.length,2);
});
test('unknown and expired alerts cannot be smuggled into a relief plan',async()=>{
 const deps={alerts:[{...alert('expired','Severe'),expires:'2000-01-01T00:00:00Z'}],generate:async()=>{throw new Error('must not be called');}};
 for(const id of ['missing','expired'])await assert.rejects(()=>createReliefPlan({alertIds:[id],request:'Plan'},deps),(e:unknown)=>e instanceof ReliefError&&e.status===409);
});
test('request size and selection limits are enforced; provider errors produce no fabricated plan',async()=>{
 const deps={alerts:[alert('live','Severe')],generate:async()=>{throw new Error('provider unavailable');}};
 for(const input of [{alertIds:[],request:'Plan'},{alertIds:Array(21).fill('live'),request:'Plan'},{alertIds:['live'],request:'x'.repeat(3001)}])await assert.rejects(()=>createReliefPlan(input,deps),(e:unknown)=>e instanceof ReliefError&&e.status===400);
 await assert.rejects(()=>createReliefPlan({alertIds:['live'],request:'Plan'},deps),(e:unknown)=>e instanceof ReliefError&&e.status===503);
});

test('live relief alerts use the running public backend port',async()=>{
 const original=globalThis.fetch,setting=process.env.PUBLIC_DATA_API_URL;
 delete process.env.PUBLIC_DATA_API_URL;
 let url='';
 globalThis.fetch=async input=>{url=String(input);return new Response(JSON.stringify({status:'available',data:{alerts:[alert('live','Severe')]}}),{headers:{'Content-Type':'application/json'}})};
 try{assert.equal((await getLiveAlerts()).length,1);assert.equal(url,'http://127.0.0.1:8002/api/public/alerts')}
 finally{globalThis.fetch=original;if(setting===undefined)delete process.env.PUBLIC_DATA_API_URL;else process.env.PUBLIC_DATA_API_URL=setting}
});

const locationContext={location:{city:'Dallas',state:'TX',countyId:'48113',countyName:'Dallas County'},rankedLiveAlerts:[{...alert('local','Severe'),countyIds:['48113']}],insights:{census:{status:'available',retrievedAt:'2026-11-08',data:{noVehiclePercent:10}}},resources:{food:{status:'unavailable',items:[],note:'Timeout'},medical:{status:'available',items:[{title:'Test Hospital'}]}},scopeNote:'County context; city may span counties.'};
test('city plan uses supplied server context for Insights and Resources, ignoring client facts',async()=>{
 let calls=0;
 const plan=await createReliefPlan({city:'Dallas',state:'TX',county:'',resources:{medical:'fabricated hospital'}},{alerts:[],context:locationContext,generate:async prompt=>{
  calls++;const data=JSON.parse(prompt);
  assert.equal(data.location.countyId,'48113');assert.equal(data.insights.census.data.noVehiclePercent,10);
  assert.equal(data.resources.medical.items[0].title,'Test Hospital');assert.equal(data.resources.food.status,'unavailable');
  assert.ok(!prompt.includes('fabricated hospital'));return 'Concise location plan.';
 }});
 assert.equal(calls,1);assert.equal(plan.location?.city,'Dallas');assert.equal(plan.alerts.length,1);
});
test('city plans can explain no active alerts without inventing a disaster',async()=>{
 const plan=await createReliefPlan({city:'Dallas',state:'TX'},{alerts:[],context:{...locationContext,rankedLiveAlerts:[]},generate:async prompt=>{assert.deepEqual(JSON.parse(prompt).rankedLiveAlerts,[]);return 'Preparedness and verification plan. No alerts returned.';}});
 assert.equal(plan.alerts.length,0);
});
test('location validation rejects missing city or state',async()=>{
 for(const input of [{city:'',state:'TX'},{city:'Dallas',state:''},{city:'Dallas',state:'TX',county:'wrong'}])
  await assert.rejects(()=>createReliefPlan(input,{alerts:[],generate:async()=>''}),(error:unknown)=>error instanceof ReliefError&&error.status===400);
});

test('location context is fetched server-side from the shared public adapters',async()=>{
 const original=globalThis.fetch;let requested='';
 globalThis.fetch=async input=>{requested=String(input);return new Response(JSON.stringify(locationContext),{headers:{'Content-Type':'application/json'}})};
 try{
  const context=await getReliefContext({city:'Dallas',state:'TX'});
  const url=new URL(requested);assert.equal(url.pathname,'/api/public/relief-context');assert.equal(url.searchParams.get('city'),'Dallas');assert.equal(url.searchParams.get('county'),'');
  assert.equal(context.location.countyId,'48113');
 }finally{globalThis.fetch=original}
});

test('all Marlow counties load labeled pre-generated plans with no Gemini request',async()=>{
 const {readFile}=await import('node:fs/promises');
 const scenario=JSON.parse(await readFile(new URL('../../data/scenarios/hurricane-marlow.json',import.meta.url),'utf8'));
 const ids=[...new Set<string>(scenario.alerts.flatMap((alert:{countyIds:string[]})=>alert.countyIds))];
 for(const county of ids){const cached=await getCachedMarlowPlan(county);assert.equal(cached?.simulated,true);assert.equal(cached?.cached,true);assert.match(cached.text,/SIMULATED: Hurricane Marlow \(fictional\)/)}
 const plan=await createReliefPlan({city:'Scenario county',state:'TX',county:'48131',scenario:'hurricane-marlow'},{alerts:[],generate:async()=>{throw new Error('Cache must avoid Gemini')}});
 assert.equal(plan.cached,true);assert.equal(plan.location.countyId,'48131');
});

test('Gemini outage returns general guidance retaining real known Census data without fake local facts',async()=>{
 const plan=await createReliefPlan({city:'Dallas',state:'TX'},{alerts:[],context:{...locationContext,insights:{census:{data:{population:1000,pctNoVehicle:10}}}},generate:async()=>{throw new Error('provider unavailable')}})
 assert.equal(plan.source,'general_guidance');assert.equal(plan.fallback,true);assert.match(plan.text,/Total population: 1,000/);assert.match(plan.text,/Households without a vehicle: 10.0%/);assert.match(plan.text,/not confirmation that a facility is open/)
})
test('context-service outage returns general guidance with no invented population or alerts',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('offline')}
 try{const plan=await createReliefPlan({city:'Dallas',state:'TX'});assert.equal(plan.source,'general_guidance');assert.deepEqual(plan.alerts,[]);assert.ok(!plan.text.includes('Total population:'));assert.match(plan.text,/require verification/)}finally{globalThis.fetch=original}
})
