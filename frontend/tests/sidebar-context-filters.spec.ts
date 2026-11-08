import {test,expect,type Page} from '@playwright/test'
const source=(data:unknown,status='available')=>({name:'Fixture',data,status,classification:'test',retrievedAt:new Date().toISOString(),vintage:'Fixture',sourceUrl:'https://www.census.gov',error:null})
const ids=['48201','48167','48039']
const alert=(id:string,index:number,kind?:string)=>({id,kind,event:kind?'Earthquake M2':'Flood Warning',severity:kind?'Not applicable':'Severe',countyIds:[ids[index]],area:'Test county',geometry:null,effective:null,ends:null,expires:'2099-01-01T00:00:00Z'})
const payload={state:'TX',sources:{noaa:source({alerts:ids.map((id,i)=>alert(id,i))}),earthquakes:source({events:[alert('quake',2,'observed_earthquake')]}),boundaries:source({type:'FeatureCollection',features:ids.map((id,i)=>({type:'Feature',id,properties:{GEOID:id,NAME:'County '+i},geometry:{type:'Polygon',coordinates:[[[-96+i,29],[-95+i,29],[-95+i,30],[-96+i,29]]]}}))}),acs:source({period:'2020-2024',counties:[]}),fema:source({records:[{id:'declaration-a',countyId:ids[0],type:'Flood'},{id:'declaration-c',countyId:ids[2],type:'Flood'}]}),nri:source({counties:ids.map((id,i)=>({countyId:id,riskScore:i===0?79:80}))})}}
async function mount(page:Page,data:unknown=payload){
 await page.route('**/api/public/state/TX',r=>r.fulfill({json:data}))
 await page.goto('/login')
 // Isolated component test; the production authentication gate remains enabled.
 await page.evaluate(async()=>{
  const reactUrl='/node_modules/.vite/deps/react.js',domUrl='/node_modules/.vite/deps/react-dom_client.js',componentUrl='/src/components/PublicDataWorkspace.tsx'
  const React=(await import(reactUrl)).default,dom=await import(domUrl),Workspace=(await import(componentUrl)).default
  const mount=document.createElement('div');document.body.replaceChildren(mount)
  ;(dom.createRoot||dom.default.createRoot)(mount).render(React.createElement(Workspace,{showFilters:true,closeFilters:()=>{}}))
 })
}
test('remaining context checkboxes share Community tags and apply/clear update county and event counts',async({page})=>{
 await mount(page)
 const community=page.locator('.community-alert-filters'),counts=page.locator('.filter-footer>span')
 await expect(page.getByRole('checkbox',{name:/Active warning or observed event/})).toHaveCount(0)
 await expect(page.getByText('More context filters',{exact:true})).toHaveCount(0)
 const recent=community.getByRole('checkbox',{name:/Recent federal disaster/}),risk=community.getByRole('checkbox',{name:/High long-term risk/})
 await expect(community.locator('.live-indicator')).toHaveCount(4)
 await expect(community).toContainText('Recent FEMA records')
 await expect(community).toContainText('NRI national percentile ≥ 80')
 await expect(counts).toHaveText('3 counties · 4 events')
 await expect(page.locator('.simple-area-facts')).toContainText('Observed earthquakesPast 24 hours1')
 await recent.check()
 await expect(counts).toHaveText('3 counties · 4 events')
 await page.getByRole('button',{name:'Apply filters',exact:true}).click()
 await expect(counts).toHaveText('2 counties · 3 events')
 await risk.check()
 await page.getByRole('button',{name:'Apply filters',exact:true}).click()
 await expect(counts).toHaveText('3 counties · 4 events')
 await community.getByRole('button',{name:'All',exact:true}).click()
 await page.getByRole('button',{name:'Apply filters',exact:true}).click()
 await expect(counts).toHaveText('1 counties · 2 events')
 await page.getByRole('button',{name:'Clear filters',exact:true}).click()
 await expect(recent).not.toBeChecked();await expect(risk).not.toBeChecked()
 await expect(counts).toHaveText('1 counties · 2 events')
 await page.getByRole('button',{name:'Apply filters',exact:true}).click()
 await expect(counts).toHaveText('3 counties · 4 events')
 await page.getByLabel('Severity',{exact:true}).selectOption('Moderate')
 await page.getByRole('button',{name:'Apply filters',exact:true}).click()
 await expect(counts).toHaveText('3 counties · 0 events')
})
test('moved filters stay disabled when their sources are unavailable',async({page})=>{
 await mount(page,{...payload,sources:{...payload.sources,fema:source(null,'unavailable'),nri:source(null,'unavailable')}})
 await expect(page.getByRole('checkbox',{name:/Recent federal disaster/})).toBeDisabled()
 await expect(page.getByRole('checkbox',{name:/High long-term risk/})).toBeDisabled()
 await expect(page.locator('.filter-footer>span')).toHaveText('3 counties · 4 events')
})
