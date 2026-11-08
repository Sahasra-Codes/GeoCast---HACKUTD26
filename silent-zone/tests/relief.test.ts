import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReliefPlan,ReliefError,type ReliefAlert} from '../src/relief.ts';
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
