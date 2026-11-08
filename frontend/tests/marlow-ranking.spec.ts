import {test,expect} from '@playwright/test'
import {readFileSync,writeFileSync} from 'node:fs'
import {rankCounties,severityOnlyRanking,countyCentroid} from '../src/lib/priority'
const root=new URL('../../data/scenarios/',import.meta.url)
const scenario=JSON.parse(readFileSync(new URL('hurricane-marlow.json',root),'utf8'))
const snapshot=JSON.parse(readFileSync(new URL('hurricane-marlow.snapshot.json',root),'utf8'))

test('Marlow preserves the fixed formula and reports actual Brooks and Duval ranks from real Census inputs',()=>{
 const alerts=[...snapshot.state.sources.noaa.data.alerts,...scenario.alerts]
 const resources={...snapshot.resources,shelter:{...snapshot.resources.shelter,items:[...snapshot.resources.shelter.items,...scenario.shelters],status:'available'}}
 const counties=snapshot.state.sources.boundaries.data.features.map((feature:any)=>({id:String(feature.id),name:feature.properties.NAME,geometry:feature.geometry,census:snapshot.census.counties[String(feature.id)],resources}))
 const rows=rankCounties(alerts,counties,Date.parse(snapshot.capturedAt),'48'),severity=severityOnlyRanking(rows)
 const results=['Brooks County','Duval County'].map(name=>{const row=rows.find(row=>row.name===name)!;return {county:name,coverageGapRank:rows.indexOf(row)+1,severityOnlyRank:severity.findIndex(other=>other.id===row.id)+1,score:row.score,vulnerability:row.vulnerability,access:row.access}})
 console.log('ACTUAL MARLOW RANKS',JSON.stringify(results))
 expect(results[0].coverageGapRank).toBeLessThan(results[0].severityOnlyRank)
 expect(results[0]).toMatchObject({coverageGapRank:1,severityOnlyRank:7})
 expect(results[1]).toMatchObject({coverageGapRank:10,severityOnlyRank:8})
 for(const row of results)expect(row.score).toBeGreaterThan(0)
 for(const shelter of scenario.shelters){const county=counties.find((county:any)=>county.id===shelter.countyId);const center=countyCentroid(county.geometry)!;expect(shelter.coordinates.longitude).toBeCloseTo(center[0],6);expect(shelter.coordinates.latitude).toBeCloseTo(center[1],6)}
 writeFileSync(new URL('hurricane-marlow.ranks.json',root),JSON.stringify({scenario:scenario.name,simulated:true,snapshotCapturedAt:snapshot.capturedAt,computedAt:new Date().toISOString(),rows:rows.map((row,index)=>({county:row.name,countyId:row.id,coverageGapRank:index+1,severityOnlyRank:severity.findIndex(other=>other.id===row.id)+1,score:row.score,simulated:row.simulated})),verified:results,requestedBothCountiesRise:results.every(row=>row.coverageGapRank<row.severityOnlyRank)},null,2))
})
