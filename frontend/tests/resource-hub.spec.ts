import {test,expect,type Page} from '@playwright/test'
async function mount(page:Page,selection?:{state:string;countyId:string},priority?:{state:string;countyId:string;at:number}){
 await page.goto('/login')
 await page.evaluate(async({selection,priority})=>{
  sessionStorage.removeItem('geocast.insightsSelection');sessionStorage.removeItem('geocast.topPriorityCounty')
  if(selection)sessionStorage.setItem('geocast.insightsSelection',JSON.stringify(selection))
  if(priority)sessionStorage.setItem('geocast.topPriorityCounty',JSON.stringify(priority))
  const reactUrl='/node_modules/.vite/deps/react.js',domUrl='/node_modules/.vite/deps/react-dom_client.js',componentUrl='/src/components/ResourcesPage.tsx'
  const React=(await import(reactUrl)).default,dom=await import(domUrl),ResourceHub=(await import(componentUrl)).default
  const mount=document.createElement('div');document.body.replaceChildren(mount)
  ;(dom.createRoot||dom.default.createRoot)(mount).render(React.createElement(ResourceHub))
 },{selection,priority})
}
const feed={status:'available',data:{alerts:[{id:'expired',countyIds:['48113'],expires:'2000-01-01',effective:null,ends:null},{id:'ca',countyIds:['06037'],expires:'2099-01-01',effective:null,ends:null},{id:'tx',countyIds:['48113'],expires:'2099-01-01',effective:null,ends:null}]}}
test.beforeEach(async({page})=>{
 await page.route('**/api/public/alerts',r=>r.fulfill({json:feed}))
 await page.route('**/api/resources/**',r=>r.fulfill({json:{source:'National Weather Service + Ready.gov',status:'available',retrievedAt:new Date().toISOString(),note:'Official instructions for the county',items:[{title:'Flood Watch',description:'County alert',details:'Monitor official warnings.',url:'https://www.weather.gov/alerts'}]}}))
})
test('copy, functional search, county defaults and sourced results work without category tabs',async({page})=>{
 await mount(page,{state:'TX',countyId:'48113'},{state:'CA',countyId:'06037',at:Date.now()})
 await expect(page.getByText('Public resources for the selected state or county, with sources and retrieval times.',{exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Emergency Shelters Shelters in the selected county',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'FEMA disaster declarations Recent declarations for the county (not an eligibility check)',exact:true})).toBeVisible()
 await expect(page.locator('.resource-hub-tabs')).toHaveCount(0)
 await page.getByRole('button',{name:'Safety Guides Official county alerts and safety guidance',exact:true}).click()
 await expect(page.getByLabel('Resource state',{exact:true})).toHaveValue('TX')
 await expect(page.getByLabel('Resource county',{exact:true})).toHaveValue('48113')
 const request=page.waitForRequest(r=>r.url().includes('/api/resources/safety')&&r.url().includes('county=48113'))
 await page.getByRole('button',{name:'Find resources',exact:true}).click();await request
 await expect(page.getByRole('heading',{name:'Flood Watch',exact:true})).toBeVisible()
 await expect(page.getByText('Monitor official warnings.',{exact:true})).toBeVisible()
 await expect(page.locator('.resource-source')).toContainText('Retrieved')
 await page.getByLabel('Search resources',{exact:true}).fill('Medical')
 await expect(page.locator('.resource-hub-card')).toHaveCount(1)
 await expect(page.locator('.resource-hub-card')).toContainText('Medical Support')
 await page.getByLabel('Search resources',{exact:true}).fill('unknown category')
 await expect(page.getByText('No resources match your search.',{exact:true})).toBeVisible()
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
test('top-ranked county is used when Insights has no selected county',async({page})=>{
 await mount(page,{state:'TX',countyId:''},{state:'TX',countyId:'48201',at:Date.now()})
 await page.getByRole('button',{name:'Emergency Shelters Shelters in the selected county',exact:true}).click()
 await expect(page.getByLabel('Resource state',{exact:true})).toHaveValue('TX')
 await expect(page.getByLabel('Resource county',{exact:true})).toHaveValue('48201')
})
test('fallback follows active alert order instead of alphabetical state or county',async({page})=>{
 await mount(page)
 await page.getByRole('button',{name:'Emergency Shelters Shelters in the selected county',exact:true}).click()
 await expect(page.getByLabel('Resource state',{exact:true})).toHaveValue('CA')
 await expect(page.getByLabel('Resource county',{exact:true})).toHaveValue('06037')
})
test('stale ranking cannot override a current alert fallback',async({page})=>{
 await mount(page,{state:'TX',countyId:''},{state:'TX',countyId:'48201',at:Date.now()-600000})
 await page.getByRole('button',{name:'Emergency Shelters Shelters in the selected county',exact:true}).click()
 await expect(page.getByLabel('Resource county',{exact:true})).toHaveValue('06037')
})

test('county is optional and food bank and hospital searches can cover a whole state',async({page})=>{
 await mount(page,{state:'TX',countyId:'48113'})
 await page.getByRole('button',{name:'Food banks Food banks mapped in OpenStreetMap',exact:true}).click()
 await page.getByLabel('Resource county',{exact:true}).selectOption('')
 await expect(page.getByLabel('Resource county',{exact:true})).not.toHaveAttribute('required','')
 await expect(page.getByRole('button',{name:'Find resources',exact:true})).toBeEnabled()
 const request=page.waitForRequest(r=>r.url().includes('/api/resources/food'))
 await page.getByRole('button',{name:'Find resources',exact:true}).click()
 const url=new URL((await request).url())
 expect(url.searchParams.get('state')).toBe('TX')
 expect(url.searchParams.get('county')).toBe('')
 expect(url.searchParams.get('location')).toBe('')
 await page.getByRole('button',{name:'Medical Support Hospitals mapped in OpenStreetMap',exact:true}).click()
 await expect(page.getByRole('button',{name:'Find resources',exact:true})).toBeEnabled()
})

test('food bank outage is explicit and Retry search loads recovered results',async({page})=>{
 let calls=0
 await page.route('**/api/resources/food?*',r=>{calls++;return r.fulfill({json:calls===1?{source:'OpenStreetMap / Overpass',status:'unavailable',retrievedAt:new Date().toISOString(),note:'OpenStreetMap search is temporarily unavailable (timeout).',items:[]}:{source:'OpenStreetMap / Overpass',status:'available',retrievedAt:new Date().toISOString(),note:'Mapped locations; confirm hours.',items:[{title:'Food bank fixture',description:'Test location',url:'https://www.openstreetmap.org/node/1'}]}})})
 await mount(page,{state:'TX',countyId:'48113'})
 await page.getByRole('button',{name:'Food banks Food banks mapped in OpenStreetMap',exact:true}).click()
 await page.getByRole('button',{name:'Find resources',exact:true}).click()
 await expect(page.getByText('OpenStreetMap search is temporarily unavailable (timeout).',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Retry search',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Food bank fixture',exact:true})).toBeVisible()
 expect(calls).toBe(2)
})

test('mapped facilities expose usable contact links without empty hours',async({page})=>{
 await page.route('**/api/resources/food?*',r=>r.fulfill({json:{source:'OpenStreetMap / Overpass',status:'available',retrievedAt:new Date().toISOString(),note:'Community-mapped facilities.',items:[{title:'Community Pantry',description:'123 Main St, Dallas',phone:'+1 214 555 0100',website:'https://example.org',url:'https://www.openstreetmap.org/way/2'}]}}))
 await mount(page,{state:'TX',countyId:'48113'})
 await page.getByRole('button',{name:'Food banks Food banks mapped in OpenStreetMap',exact:true}).click()
 await page.getByRole('button',{name:'Find resources',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Community Pantry',exact:true})).toBeVisible()
 await expect(page.getByRole('link',{name:'Call +1 214 555 0100',exact:true})).toHaveAttribute('href','tel:+12145550100')
 await expect(page.getByRole('link',{name:'Visit facility website',exact:true})).toHaveAttribute('href','https://example.org')
 await expect(page.getByRole('link',{name:'View on OpenStreetMap',exact:true})).toHaveAttribute('href','https://www.openstreetmap.org/way/2')
 await expect(page.getByText('Hours: not reported',{exact:true})).toHaveCount(0)
})
