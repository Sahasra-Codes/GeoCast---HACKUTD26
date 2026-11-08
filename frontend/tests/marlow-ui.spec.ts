import {test,expect,type Page} from '@playwright/test'
import {readFileSync} from 'node:fs'
const root=new URL('../../data/scenarios/',import.meta.url)
const scenario=JSON.parse(readFileSync(new URL('hurricane-marlow.json',root),'utf8'))
const snapshot=JSON.parse(readFileSync(new URL('hurricane-marlow.snapshot.json',root),'utf8'))
const plans=JSON.parse(readFileSync(new URL('hurricane-marlow.plans.json',root),'utf8'))
const resources=snapshot.resources
async function mount(page:Page,component:string,props={},enabled=false){
 await page.goto('/login')
 await page.evaluate(async({component,props,enabled})=>{
  localStorage.removeItem('geocast.scenario');if(enabled)localStorage.setItem('geocast.scenario','hurricane-marlow')
  const react='/node_modules/.vite/deps/react.js',domPath='/node_modules/.vite/deps/react-dom_client.js',componentPath='/src/components/'+component+'.tsx'
  const React=(await import(react)).default,dom=await import(domPath),Component=(await import(componentPath)).default
  const mount=document.createElement('div');document.body.replaceChildren(mount)
  ;(dom.createRoot||dom.default.createRoot)(mount).render(React.createElement('div',{className:'real-app geocast'},React.createElement(Component,{closeFilters:()=>{},showFilters:true,...props})))
 },{component,props,enabled})
}
async function setSimulation(page:Page,enabled:boolean){await page.evaluate(async enabled=>{const path='/src/services/scenario.ts';(await import(path)).setScenarioEnabled(enabled)},enabled)}
test.beforeEach(async({page})=>{
 await page.route('**/api/public/state/TX*',route=>{const simulation=new URL(route.request().url()).searchParams.has('scenario');const data=structuredClone(snapshot.state);if(simulation){data.sources.noaa.data.alerts.push(...scenario.alerts);data.simulated=true};return route.fulfill({json:data})})
 await page.route('**/api/public/demographics/TX*',route=>route.fulfill({json:{status:'unavailable',data:null,name:'Census',retrievedAt:snapshot.capturedAt}}))
 await page.route('**/api/public/priority/census/TX*',route=>route.fulfill({json:snapshot.census}))
 await page.route('**/api/public/priority/resources/*',route=>route.fulfill({json:new URL(route.request().url()).searchParams.has('scenario')?resources:snapshot.resources}))
 await page.route('**/api/public/county/*',route=>route.fulfill({json:{countyId:new URL(route.request().url()).pathname.split('/').pop(),sources:{acs:{status:'unavailable',data:null},fema:{status:'unavailable',data:null},nri:{status:'unavailable',data:null}}}}))
})

test('simulation state adds labeled fictional alerts and ranking evidence, and off restores real alerts',async({page})=>{
 await mount(page,'InsightsPage')
 const alerts=page.locator('.insights-event');const before=await alerts.count()
 await setSimulation(page,true)
 await expect(alerts.filter({hasText:'SIMULATED:'})).toHaveCount(3)
 for(const alert of await alerts.filter({hasText:'SIMULATED:'}).all())await expect(alert.locator('.simulated-badge')).toBeVisible()
 const row=page.getByRole('row',{name:'Select Brooks County',exact:true})
 await expect(row).toContainText('64')
 await expect(row.locator('.simulated-badge')).toBeVisible()
 await row.getByRole('button',{name:'Evidence for Brooks County',exact:true}).click()
 await expect(page.locator('.priority-evidence')).toContainText('Only the storm is fictional. County Census inputs and resource records are real.')
 await expect(page.getByRole('link',{name:'View simulated relief plan',exact:true})).toHaveAttribute('href','/reports/relief?county=48047')
 await setSimulation(page,false)
 await expect(alerts.filter({hasText:'SIMULATED:'})).toHaveCount(0)
 await expect(page.locator('.insights-selected .simulated-badge')).toHaveCount(0)
})

test('Resources shows real shelters even while the fictional storm is enabled',async({page})=>{
 await page.route('**/api/public/alerts*',route=>route.fulfill({json:{status:'available',data:{alerts:scenario.alerts}}}))
 await page.route('**/api/resources/shelter?*',route=>route.fulfill({json:{source:'FEMA Open Shelters',status:'available',retrievedAt:snapshot.capturedAt,note:'Real shelters reported open within 50 miles of the selected county center.',items:[{title:'Real shelter fixture',description:'Source-reported address',distanceMiles:12.5},...scenario.shelters]}}))
 await mount(page,'ResourcesPage',{},true)
 await page.getByRole('button',{name:'Emergency Shelters Real shelters near the selected area',exact:true}).click()
 await page.getByLabel('Resource state',{exact:true}).selectOption('TX')
 await page.getByRole('button',{name:'Find resources',exact:true}).click()
 await expect(page.locator('.resource-result-grid article')).toHaveCount(1)
 await expect(page.locator('.resource-result-grid .simulated-badge')).toHaveCount(0)
 await expect(page.locator('.resource-result-grid')).toContainText('Real shelter fixture')
 await expect(page.locator('.resource-result-grid')).toContainText('12.5 miles')
})

test('report loads its cached plan without Gemini and carries simulation labeling',async({page})=>{
 let count=0
 await page.route('**/api/relief/scenario-plans/48131',route=>{count++;return route.fulfill({json:{...plans['48131'],cached:true}})})
 await mount(page,'ReliefPage',{reportCounty:'48131'},true)
 await expect(page.getByRole('region',{name:'Generated relief plan'})).toBeVisible()
 await expect(page.locator('.relief-plan-header .simulated-badge')).toBeVisible()
 await expect(page.locator('.relief-plan-header')).not.toContainText(/cached/i)
 await expect(page.locator('.relief-plan-text')).toContainText('SIMULATED: Hurricane Marlow (fictional)')
 await expect(page.getByRole('button',{name:'Regenerate',exact:true})).toBeVisible()
 expect(count).toBe(1)
 await setSimulation(page,false)
 await expect(page.getByRole('region',{name:'Generated relief plan'})).toHaveCount(0)
})

test('map storm illustration spins only with simulation enabled and honors reduced motion',async({page})=>{
 await page.goto('/login')
 await page.evaluate(async({alerts})=>{
  localStorage.setItem('geocast.scenario','hurricane-marlow')
  const react='/node_modules/.vite/deps/react.js',domPath='/node_modules/.vite/deps/react-dom_client.js',mapPath='/src/components/USMap.tsx',apiPath='/src/services/api.ts'
  const React=(await import(react)).default,dom=await import(domPath),Map=(await import(mapPath)).default,geography=await (await import(apiPath)).getGeography()
  const mount=document.createElement('div');mount.style.height='800px';document.body.replaceChildren(mount)
  const noop=()=>{}
  ;(dom.createRoot||dom.default.createRoot)(mount).render(React.createElement('div',{className:'real-app geocast'},React.createElement('div',{style:{height:'700px',position:'relative'}},React.createElement(Map,{geography,data:{events:[],predictions:[],resources:[],updatedAt:'',mode:'connected'},layer:'activity',showPopup:false,showForecast:false,showOverlays:false,publicMapData:{counties:{type:'FeatureCollection',features:[]},alerts,risk:[],declarationCountyIds:[],showAlerts:true,showRisk:false,showDeclarations:false},onEvent:noop,onRegion:noop,onExplore:noop,onClosePopup:noop,onResource:noop}))))
 },{alerts:scenario.alerts})
 await expect(page.locator('.marlow-storm')).toHaveCount(1,{timeout:30000})
 await expect(page.getByText('Illustration, not observed radar',{exact:true})).toBeVisible()
 expect(await page.locator('.marlow-swirl').evaluate(element=>getComputedStyle(element).animationName)).toBe('marlow-spin')
 await page.emulateMedia({reducedMotion:'reduce'})
 expect(await page.locator('.marlow-swirl').evaluate(element=>getComputedStyle(element).animationName)).toBe('none')
 await setSimulation(page,false)
 await expect(page.locator('.marlow-storm')).toHaveCount(0)
})

test('Safety Guides stay real when only the hurricane is fictional',async({page})=>{
 await page.route('**/api/public/alerts*',route=>route.fulfill({json:{status:'available',data:{alerts:scenario.alerts}}}))
 await page.route('**/api/resources/safety?*',route=>route.fulfill({json:{source:'National Weather Service + Ready.gov',status:'available',retrievedAt:snapshot.capturedAt,note:'Official safety guidance',items:[{title:'Hurricane safety',description:'Official guidance',url:'https://www.weather.gov/safety/hurricane'},{title:'Flood safety',description:'Official guidance',url:'https://www.weather.gov/safety/flood'}]}}))
 await mount(page,'ResourcesPage',{},true)
 await page.getByRole('button',{name:'Safety Guides Official county alerts and safety guidance',exact:true}).click()
 await page.getByLabel('Resource state',{exact:true}).selectOption('TX')
 await page.getByRole('button',{name:'Find resources',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Hurricane safety',exact:true})).toBeVisible()
 await expect(page.locator('.resource-result-grid .simulated-badge')).toHaveCount(0)
 await expect(page.locator('.resource-source')).not.toContainText('Marlow')
})

test('Hurricane simulation is a disaster filter applied only after Apply filters',async({page})=>{
 await mount(page,'PublicDataWorkspace')
 const disaster=page.getByLabel('Disaster type',{exact:true})
 await expect(page.getByRole('checkbox',{name:'Simulate major event',exact:true})).toHaveCount(0)
 await expect(disaster.locator('option',{hasText:'Hurricane (simulation)'})).toHaveCount(1)
 await disaster.selectOption('simulation:hurricane-marlow')
 expect(await page.evaluate(()=>localStorage.getItem('geocast.scenario'))).toBeNull()
 await expect(page.locator('.marlow-storm')).toHaveCount(0)
 await page.getByRole('button',{name:'Apply filters',exact:true}).click()
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('geocast.scenario'))).toBe('hurricane-marlow')
 await expect(page.locator('.marlow-storm')).toHaveCount(1,{timeout:30000})
 await disaster.selectOption('all')
 expect(await page.evaluate(()=>localStorage.getItem('geocast.scenario'))).toBe('hurricane-marlow')
 await page.getByRole('button',{name:'Apply filters',exact:true}).click()
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('geocast.scenario'))).toBeNull()
 await expect(page.locator('.marlow-storm')).toHaveCount(0)
})

test('report fetch failure shows general guidance without exposing cache terminology',async({page})=>{
 await page.route('**/api/relief/scenario-plans/48131',route=>route.abort('failed'))
 await mount(page,'ReliefPage',{reportCounty:'48131'},true)
 await expect(page.locator('.general-guidance-label')).toContainText('General guidance')
 await expect(page.locator('.relief-plan-text')).toContainText('Local counts, impacts, resource capacity, and facility availability remain unverified.')
 await expect(page.locator('.relief-page')).not.toContainText(/cached/i)
 await expect(page.getByRole('button',{name:'Regenerate',exact:true})).toBeVisible()
})
