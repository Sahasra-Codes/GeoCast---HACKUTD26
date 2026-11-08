import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPriorityServer} from '../src/server.ts';
import {createStore,loadZones} from '../src/store.ts';
test('HTTP priority, advance, briefing fallback and dispatch work together', async () => {
  const server=createPriorityServer(createStore(await loadZones()));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();
  assert.ok(address && typeof address!=='string');
  const url=`http://127.0.0.1:${address.port}/api/`;
  const post=(path:string,body:unknown={})=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {
    let snapshot=await (await fetch(url+'priority')).json();
    assert.equal(snapshot.hour,0); assert.equal(snapshot.simulated,true); assert.equal(snapshot.zones.length,6);
    for(let i=0;i<5;i++)snapshot=await (await post('advance')).json();
    assert.equal(snapshot.hour,5); assert.equal(snapshot.zones[0].zoneId,'zone-3');
    assert.equal((await (await post('dispatch',{zoneId:'zone-3'})).json()).status,'Dispatched');
    assert.equal((await post('dispatch',{zoneId:'missing'})).status,404);
    assert.equal((await post('dispatch',{})).status,400);
    assert.equal((await fetch(url+'dispatch',{method:'POST',body:'bad json'})).status,400);
    assert.equal((await fetch(url+'advance',{method:'POST',headers:{Origin:'https://outside.example'}})).status,403);
    const key=process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const briefing=await (await post('briefing')).json();
      assert.equal(briefing.source,'template'); assert.equal(briefing.hour,5); assert.match(briefing.text,/Willow Bend/);
    } finally {if(key)process.env.GEMINI_API_KEY=key;}
    for (const input of [{}, {alertIds:[],request:'Old request'}, {city:'Dallas',state:''}]) {
      const response=await post('relief/plan',input);
      assert.equal(response.status,400);
      const result=await response.json();
      assert.match(result.error,/Enter a city and select a state/);
      assert.ok(!result.error.includes('live alerts'));
    }
    const priority=await (await fetch(url+'priority')).json();
    assert.equal(priority.zones[0].status,'Dispatched');
  } finally {server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
