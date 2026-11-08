import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceZones, rankZones, scoreZone, type Zone} from '../src/scoring.ts';
import {loadZones, createStore} from '../src/store.ts';
import {generateBriefing} from '../src/briefing.ts';

const base: Zone = {id:'test',name:'Test',population:100,pct65plus:0,sviScore:0,powerOff:false,outageHours:0,normalReportsPerHour:10,reportsNow:10,hoursSinceLastReport:0};
test('known inputs produce the exact four specified components', () => {
  const result = scoreZone({...base,powerOff:true,outageHours:12,pct65plus:20,sviScore:0.5,reportsNow:2,hoursSinceLastReport:6});
  assert.deepEqual(result.breakdown,{outage:15,vulnerability:12.5,silence:17,reportedNeed:20*2/30});
  assert.ok(Math.abs(result.score - (15+12.5+17+20*2/30)) < 1e-10);
  assert.ok(result.reasons.includes('Reports down 80% from normal'));
});
test('component caps, power-on behavior, drop clamp and score bounds', () => {
  const max = scoreZone({...base,powerOff:true,outageHours:100,pct65plus:100,sviScore:1,reportsNow:100,hoursSinceLastReport:100});
  assert.deepEqual(max.breakdown,{outage:30,vulnerability:25,silence:10,reportedNeed:20});
  assert.equal(scoreZone({...base,outageHours:100}).breakdown.outage,0);
  assert.equal(scoreZone({...base,reportsNow:0,hoursSinceLastReport:24}).breakdown.silence,25);
  assert.equal(scoreZone({...base,reportsNow:30}).breakdown.silence,0);
  assert.ok(max.score >= 0 && max.score <= 100);
});
test('Zone 3 climbs to first around hour 4–6 and outranks loud Zone 5 at hour 5', async () => {
  let zones = await loadZones();
  const original = structuredClone(zones);
  assert.notEqual(rankZones(zones)[0].zoneId,'zone-3');
  let firstHour = 0;
  for (let h=1; h<=5; h++) {
    zones=advanceZones(zones);
    if (!firstHour && rankZones(zones)[0].zoneId==='zone-3') firstHour=h;
  }
  assert.ok(firstHour>=4 && firstHour<=6,`first at hour ${firstHour}`);
  const ranking=rankZones(zones);
  assert.equal(ranking[0].zoneId,'zone-3');
  assert.ok(ranking.find(z=>z.zoneId==='zone-3')!.score > ranking.find(z=>z.zoneId==='zone-5')!.score);
  assert.deepEqual(await loadZones(),original,'simulation must not overwrite seed data');
  assert.equal(original.find(z=>z.id==='zone-5')!.reportsNow,25);
  assert.equal(zones.find(z=>z.id==='zone-5')!.reportsNow,30);
});
test('silent score never decreases through saturation and functions do not mutate input', async () => {
  let zones=await loadZones();
  const original=structuredClone(zones);
  let previous=scoreZone(zones[2]).score;
  for(let h=0;h<48;h++) {
    const before=structuredClone(zones);
    const next=advanceZones(zones);
    assert.deepEqual(zones,before);
    const score=scoreZone(next[2]).score;
    assert.ok(score>=previous && score<=100);
    previous=score; zones=next;
  }
  assert.deepEqual(await loadZones(),original);
});
test('invalid baseline and nonfinite inputs are rejected', () => {
  assert.throws(()=>scoreZone({...base,normalReportsPerHour:0}));
  assert.throws(()=>scoreZone({...base,pct65plus:NaN}));
  assert.throws(()=>scoreZone({...base,sviScore:1.1}));
});
test('dispatch is idempotent, survives advancement and never changes scores', async () => {
  const store=createStore(await loadZones());
  const before=store.priority();
  assert.equal(store.dispatch('unknown'),undefined);
  assert.equal(store.dispatch('zone-3')?.status,'Dispatched');
  store.dispatch('zone-3');
  assert.deepEqual(store.priority().zones.map(z=>z.score),before.zones.map(z=>z.score));
  assert.equal(store.advance().zones.find(z=>z.zoneId==='zone-3')?.status,'Dispatched');
});
test('briefing provider sees only top three; failures and empty text use reasons without mutating ranking', async () => {
  const store=createStore(await loadZones());
  for(let h=0;h<5;h++)store.advance();
  const snapshot=store.priority(), before=structuredClone(snapshot);
  const success=await generateBriefing(snapshot, async prompt=>{
    const payload=JSON.parse(prompt);
    assert.equal(payload.rankedTop3.length,3);
    assert.equal(payload.rankedTop3[0].zoneId,'zone-3');
    return 'Help Zone 3 first. The human responder makes the final decision.';
  });
  assert.equal(success.source,'gemini');
  for(const provider of [async()=>{throw new Error('offline');}, async()=>undefined]) {
    const result=await generateBriefing(snapshot,provider);
    assert.equal(result.source,'template');
    assert.match(result.text,/Willow Bend/);
    assert.match(result.text,/Reports down 80%/);
    assert.match(result.text,/human responder makes the final decision/);
  }
  assert.deepEqual(snapshot,before);
});
