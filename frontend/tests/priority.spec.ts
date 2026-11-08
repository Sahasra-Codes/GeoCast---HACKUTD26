import {test,expect} from '@playwright/test'
import type {PublicAlert} from '../src/publicDataTypes'
import {alertWeight,alertedCountyIds,countyCentroid,haversineMiles,priorityScore,rankCounties,severityOnlyRanking,vulnerability,type PriorityCounty} from '../src/lib/priority'
const now=Date.parse('2026-11-08T10:00:00Z')
const alert=(countyIds=['48001'],certainty='Observed',event='Flood Warning')=>({id:event+certainty,event,countyIds,severity:'Severe',certainty,urgency:'Immediate',effective:null,expires:'2099-01-01T00:00:00Z',ends:null} as PublicAlert)
const geometry={type:'Polygon' as const,coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}
const census={pct65plus:20,pctNoVehicle:10,pctBelowPoverty:17.5,pctNoInternet:12.5}
function county(id='48001',longitude=1):PriorityCounty{return {id,name:id,geometry,census,resources:{shelter:{status:'available',source:'FEMA Open Shelters',retrievedAt:'2026-11-08',items:[],note:'No positioned shelters'},food:{status:'available',source:'OSM food banks',retrievedAt:'2026-11-08',items:[],note:'No mapped records'},medical:{status:'available',source:'OSM medical',retrievedAt:'2026-11-08',items:[{coordinates:{longitude,latitude:.5}}],note:'Mapped facilities'}}}}
test('score is monotonic in alert weight, vulnerability and distance',()=>{
 expect(priorityScore(.8,.5,.5)).toBeGreaterThan(priorityScore(.4,.5,.5))
 expect(priorityScore(.8,.8,.5)).toBeGreaterThan(priorityScore(.8,.2,.5))
 expect(priorityScore(.8,.5,.8)).toBeGreaterThan(priorityScore(.8,.5,.2))
 expect(rankCounties([alert()],[county('48001',1.1)],now)[0].score).toBeGreaterThan(rankCounties([alert()],[county('48001',.6)],now)[0].score)
})
test('warning outranks watch at equal severity using source certainty',()=>{
 const warning=alert(['48001'],'Observed','Flood Warning'),watch=alert(['48001'],'Possible','Flood Watch')
 expect(alertWeight(warning)).toBe(.75);expect(alertWeight(watch)).toBeCloseTo(.45)
 expect(rankCounties([warning],[county()],now)[0].score).toBeGreaterThan(rankCounties([watch],[county()],now)[0].score)
 expect(rankCounties([watch,warning],[county()],now)[0].topAlert.id).toBe(warning.id)
})
test('fixed vulnerability caps and missing data handling',()=>{
 expect(vulnerability(census)).toBeCloseTo(.5)
 expect(vulnerability({pct65plus:100,pctNoVehicle:100,pctBelowPoverty:100,pctNoInternet:100})).toBeCloseTo(1)
 expect(vulnerability({...census,pct65plus:null})).toBeNull()
 expect(vulnerability({...census,pct65plus:NaN})).toBeNull()
})
test('all alerted counties occur exactly once, including missing geometry and Census',()=>{
 const alerts=[alert(['48001','48001','48003']),{...alert(['48005']),id:'second'},{...alert(['48007']),id:'quake',kind:'observed_earthquake'},{...alert(['48009']),id:'old',expires:'2000-01-01'}]
 const rows=rankCounties(alerts,[county()],now,'48')
 expect(rows.map(row=>row.id).sort()).toEqual(['48001','48003','48005'])
 expect(alertedCountyIds(alerts,now,'48')).toHaveLength(3)
 expect(rows.find(row=>row.id==='48003')?.flagged).toBe(true)
 expect(rows.find(row=>row.id==='48003')?.score).toBe(75)
 expect(rankCounties(alerts,[county()],now,'48','second').map(row=>row.id)).toEqual(['48005'])
})
test('empty and failed categories are excluded without discarding available medical data',()=>{
 const row=rankCounties([alert()],[county()],now)[0]
 expect(row.flagged).toBe(false);expect(row.partial).toBe(true);expect(row.usedCategories).toEqual(['medical'])
 expect(row.access).toBeCloseTo(row.distances.medical!/50)
 expect(row.distances.shelter).toBeNull()
 expect(row.notes.some(note=>note.includes('No open shelters reported'))).toBe(true)
 const failed=county();failed.resources!.food!.status='unavailable'
 const fallback=rankCounties([alert()],[failed],now)[0]
 expect(fallback.flagged).toBe(false);expect(fallback.partial).toBe(true);expect(fallback.score).toBe(row.score)
})
test('area-weighted centroid and haversine distances are deterministic',()=>{
 expect(countyCentroid(geometry)).toEqual([.5,.5])
 expect(countyCentroid(undefined)).toBeNull()
 expect(haversineMiles([0,0],[0,1])).toBeCloseTo(69.093,2)
 expect(haversineMiles([0,0],[0,0])).toBe(0)
})
test('access caps at one and nearest distances use all loaded positioned resources',()=>{
 const far=county('48001',10),near=county('48003',.6)
 expect(rankCounties([alert()],[far],now)[0].access).toBe(1)
 const rows=rankCounties([alert(['48001','48003'])],[far,near],now)
 expect(rows[0].distances.medical).toBeCloseTo(rows[1].distances.medical!)
 expect(rows[0].access).toBeLessThan(1)
})

test('multipolygon centroid stays near the date line for split island geometry',()=>{
 const center=countyCentroid({type:'MultiPolygon',coordinates:[[[[179,0],[180,0],[180,1],[179,1],[179,0]]],[[[-180,0],[-179,0],[-179,1],[-180,1],[-180,0]]]]})
 expect(Math.abs(center![0])).toBeCloseTo(180)
 expect(center![1]).toBeCloseTo(.5)
})

test('only fully missing resources trigger alert-only fallback',()=>{
 const c=county();c.resources!.shelter!.status='unavailable';c.resources!.food!.status='unavailable';c.resources!.medical!.status='unavailable'
 const row=rankCounties([alert()],[c],now)[0]
 expect(row.flagged).toBe(true);expect(row.score).toBe(75);expect(row.usedCategories).toEqual([])
})
test('access averages only available categories and partial data preserves vulnerability differences',()=>{
 const low=county('48001',.5),high=county('48003',.5)
 high.census={...census,pct65plus:35};low.resources!.food!.status='unavailable';high.resources!.food!.status='unavailable'
 high.name='Zulu';low.name='Alpha'
 const rows=rankCounties([alert(['48001','48003'])],[low,high],now)
 expect(rows[0].id).toBe('48003');expect(rows[0].score).toBeGreaterThan(rows[1].score)
 const c=county();c.resources!.food!.items=[{coordinates:{latitude:.5,longitude:.7}}]
 const row=rankCounties([alert()],[c],now)[0]
 expect(row.access).toBeCloseTo((row.distances.food!/50+row.distances.medical!/50)/2)
 expect(row.usedCategories).toEqual(['food','medical'])
})
test('score ties use vulnerability then county name and severity mode is independent of coverage score',()=>{
 const high=county('48003',.5),low=county('48001',.5)
 high.name='Zulu';low.name='Alpha';high.census={...census,pct65plus:20.1}
 let rows=rankCounties([alert(['48001','48003'])],[low,high],now)
 expect(rows[0].score).toBe(rows[1].score);expect(rows[0].id).toBe('48003')
 high.census={...census};rows=rankCounties([alert(['48001','48003'])],[high,low],now)
 expect(rows[0].name).toBe('Alpha')
 const severe={...rows[1],alertWeight:.9,score:5},moderate={...rows[0],alertWeight:.6,score:80}
 expect(severityOnlyRanking([moderate,severe])[0].alertWeight).toBe(.9)
})
