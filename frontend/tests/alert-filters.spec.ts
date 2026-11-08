import {getAlertCommunityTags,matchesCommunityPercentage} from '../src/services/alertCommunity'
import {compareAlertPriority} from '../src/services/alertFilters'
import type {PublicAlert} from '../src/publicDataTypes'
import {test,expect} from '@playwright/test'
test.use({launchOptions:{args:[]}})
const source=(name:string,data:unknown)=>({name,data,status:'available',classification:'live_warnings',retrievedAt:new Date().toISOString(),vintage:'Test fixture',sourceUrl:'https://api.weather.gov',error:null})
const county=(id:string,name:string,x:number)=>({type:'Feature',id,properties:{GEOID:id,NAME:name},geometry:{type:'Polygon',coordinates:[[[x,29],[x+1,29],[x+1,30],[x,30],[x,29]]]}})
const alert=(id:string,event:string,severity:string,countyIds=['48201'])=>({id,event,severity,countyIds,area:countyIds.includes('48201')?'Harris County':'Galveston County',urgency:'Immediate',certainty:'Observed',headline:id,description:'* WHAT...Moderate flooding is occurring and forecast.\n\n* WHERE...Test River.\n\n* IMPACTS...Water covers low-lying roads.\n\n* ADDITIONAL DETAILS...Flood stage is 8 feet.',instruction:'Do not drive through flooded roads.',sent:'2026-11-07T20:00:00Z',effective:null,expires:'2099-01-01T00:00:00Z',ends:null,geometry:null,sourceUrl:'https://www.weather.gov/alerts'})
const payload={state:'TX',sources:{
  noaa:source('NOAA / National Weather Service',{alerts:[alert('severe-flood','Flood Warning','Severe'),alert('minor-flood','Flood Warning','Minor',['48167']),alert('unusual','Heavy Freezing Spray Warning','Moderate'),alert('unknown','Special Weather Statement','Unknown'),{...alert('expired','Expired Test Alert','Extreme'),expires:'2000-01-01T00:00:00Z'}],truncated:false,updated:null}),
  boundaries:source('TIGER',{type:'FeatureCollection',features:[county('48201','Harris County',-96),county('48167','Galveston County',-95)]}),
  fema:source('FEMA',{records:[],limit:200,truncated:false}),nri:source('NRI',{counties:[]})}}
test.beforeEach(async({page})=>{
  await page.route('**/api/public/state/TX',r=>r.fulfill({json:payload}))
  await page.route('**/api/public/county/*',r=>r.fulfill({json:{countyId:r.request().url().split('/').pop(),sources:{acs:{...source('ACS',null),status:'unavailable'},fema:payload.sources.fema,nri:payload.sources.nri}}}))
  await page.goto('/map',{waitUntil:'domcontentloaded'})
})
test('dropdown includes every current alert type and individual record; severity and county filters agree',async({page})=>{
  const dropdown=page.getByLabel('Disaster type')
  await expect(dropdown.locator('option[value="all"]')).toHaveText('All active alerts (4)')
  await expect(dropdown.locator('option[value="event:Heavy Freezing Spray Warning"]')).toHaveCount(1)
  await expect(dropdown.locator('option[value="event:Special Weather Statement"]')).toHaveCount(1)
  await expect(dropdown.locator('option[value="alert:expired"]')).toHaveCount(0)
  const overview=page.getByRole('complementary',{name:'Area overview',exact:true})
  await dropdown.selectOption('event:Flood Warning')
  await page.getByRole('button',{name:'Apply filters'}).click()
  await expect(overview.locator('.overview-stats>div').first()).toContainText('2')
  await page.getByLabel('Severity',{exact:true}).selectOption('Minor')
  await page.getByRole('button',{name:'Apply filters'}).click()
  await expect(overview.locator('.area-severity-badge').first()).toHaveText('Minor')
  await expect(overview.locator('.overview-stats>div').first()).toContainText('1')
  // Severity selection must not remove choices from the dropdown.
  await expect(dropdown.locator('option[value="event:Heavy Freezing Spray Warning"]')).toHaveCount(1)
  await page.getByLabel('Severity',{exact:true}).selectOption('')
  await page.getByRole('button',{name:'Apply filters'}).click()
  await page.getByLabel('Public data county').selectOption('48201')
  await page.getByRole('button',{name:'Apply filters'}).click()
  await expect(overview.locator('.area-severity-badge').first()).toHaveText('Severe')
  await expect(overview.locator('.overview-stats>div').first()).toContainText('1')
  await dropdown.selectOption('event:Special Weather Statement')
  await page.getByRole('button',{name:'Apply filters'}).click()
  await expect(overview.locator('.area-severity-badge').first()).toHaveText('Unknown')
  await page.getByLabel('Severity',{exact:true}).selectOption('Severe')
  await page.getByRole('button',{name:'Apply filters'}).click()
  await expect(overview.locator('.area-alert-severity')).toContainText('No matching alerts')
})
test('selecting an alert shows affected area, severity, flood category and official impacts separately',async({page})=>{
  await page.getByLabel('Disaster type').selectOption('event:Flood Warning')
  await page.getByRole('button',{name:'Apply filters'}).click()
  await page.getByRole('complementary',{name:'Area overview',exact:true}).getByRole('link',{name:'View impacts',exact:true}).first().click()
  await expect(page).toHaveURL(/\/insights\?state=TX&alert=severe-flood/)
  const details=page.locator('.public-alert-detail')
  await expect(details).toContainText('NWS alert severitySevere')
  await expect(details).toContainText('Affected areaHarris County')
  await expect(details).toContainText('River flood category: Moderate')
  await expect(details).toContainText('Water covers low-lying roads.')
  await expect(details).toContainText('Do not drive through flooded roads.')
  await expect(details).toContainText('NWS alert severity and river flood category are different measures')
  await page.screenshot({path:'test-results/live-alert-severity.png',fullPage:true})
})

test('priority uses severity then urgency within a selected severity',()=>{
  const moderate={...alert('moderate','Flood Warning','Moderate'),urgency:'Expected'} as PublicAlert
  const immediate={...moderate,id:'immediate',urgency:'Immediate'}
  const severe={...moderate,id:'severe',severity:'Severe'}
  expect([moderate,severe,immediate].sort(compareAlertPriority).map(a=>a.id)).toEqual(['severe','immediate','moderate'])
})
test('Moderate selection uses the compact severity scale',async({page})=>{
  await page.getByLabel('Severity',{exact:true}).selectOption('Moderate')
  await page.getByRole('button',{name:'Apply filters'}).click()
  await expect(page.locator('.area-severity-badge').first()).toHaveText('Moderate')
  await expect(page.locator('.severity-scale')).toBeVisible()
  await expect(page.locator('.severity-scale-labels .selected')).toHaveText('Moderate')
  await expect(page.locator('.public-map-key')).toContainText('focused on highest priority')
  await expect(page.locator('.live-radar-status')).toHaveCount(0)
})

test('filter edits and clearing wait for Apply filters',async({page})=>{
  const badge=page.locator('.area-severity-badge').first()
  await expect(badge).toHaveText('Severe')
  await page.getByLabel('Severity',{exact:true}).selectOption('Moderate')
  await expect(badge).toHaveText('Severe')
  await expect(page.locator('.severity-scale-labels .selected')).toHaveCount(0)
  await page.getByRole('button',{name:'Apply filters'}).click()
  await expect(badge).toHaveText('Moderate')
  await expect(page.locator('.severity-scale-labels .selected')).toHaveText('Moderate')
  await page.getByRole('button',{name:'Clear filters',exact:true}).click()
  await expect(badge).toHaveText('Moderate')
  await page.getByRole('button',{name:'Apply filters'}).click()
  await expect(badge).toHaveText('Severe')
})

test('all states waits for Apply and displays alerts without map icons',async({page})=>{
  const tornado={...alert('national-tornado','Tornado Warning','Extreme'),geometry:{type:'Polygon',coordinates:[[[-96,29],[-95,29],[-95,30],[-96,29]]]}}
  const fire=alert('national-fire','Red Flag Warning','Severe',['48167'])
  const flood=alert('national-flood','Flood Warning','Moderate')
  await page.route('**/api/public/state/ALL',r=>r.fulfill({json:{...payload,state:'ALL',sources:{...payload.sources,noaa:source('NOAA',{alerts:[tornado,fire,flood],truncated:false,updated:null})}}}))
  await page.getByLabel('Public data state').selectOption('ALL')
  const overview=page.getByRole('complementary',{name:'Area overview',exact:true})
  await expect(overview.locator('h2+p')).toContainText('TX')
  await page.getByRole('button',{name:'Apply filters'}).click()
  await expect(overview.locator('h2+p')).toContainText('All states')
  await expect(overview.locator('.overview-alert-card')).toHaveCount(3)
  await expect(page.locator('.public-alert-marker')).toHaveCount(0)
  await overview.getByRole('link',{name:'View impacts',exact:true}).first().click()
  await expect(page.locator('.public-alert-detail')).toContainText('Tornado Warning | Extreme')
})

test('Insights without a selected alert has a clear empty state',async({page})=>{
 await page.goto('/insights')
 await expect(page.getByRole('heading',{name:'Alert insights'})).toBeVisible()
 await expect(page.getByRole('status')).toContainText('Select an alert on the map')
})
test('Insights handles an alert that is no longer active',async({page})=>{
 await page.goto('/insights?state=TX&alert=missing')
 await expect(page.getByRole('status')).toContainText('no longer in the active feed')
})

test('clicking a state opens its own alerts and severity',async({page})=>{
 const topology={type:'Topology',objects:{states:{type:'GeometryCollection',geometries:[{type:'Polygon',id:'06',properties:{name:'California'},arcs:[[0]]}]},counties:{type:'GeometryCollection',geometries:[]}},arcs:[[[-124,24],[-67,24],[-67,49],[-124,49],[-124,24]]]}
 await page.route('**/data/us-counties.topo.json',r=>r.fulfill({json:topology}))
 await page.route('**/api/public/state/TX',r=>r.fulfill({json:{...payload,sources:{...payload.sources,boundaries:source('TIGER',{type:'FeatureCollection',features:[]})}}}))
 await page.route('**/api/public/state/CA',r=>r.fulfill({json:{...payload,state:'CA',sources:{...payload.sources,noaa:source('NOAA',{alerts:[alert('ca-freeze','Freeze Warning','Severe',['06059'])],updated:null,truncated:false}),boundaries:source('TIGER',{type:'FeatureCollection',features:[county('06059','Orange County',-118)]})}}}))
 await page.reload()
 const canvas=page.locator('.map-canvas')
 await expect(canvas).toHaveAttribute('data-boundaries-ready','true',{timeout:45000})
 await expect(canvas).toHaveAttribute('data-camera-moving','false')
 const box=await canvas.boundingBox()
 if(!box)throw new Error('Map is missing')
 await page.mouse.click(box.x+box.width/2,box.y+box.height/2)
 await expect(page.getByLabel('Public data state')).toHaveValue('CA')
 const overview=page.getByRole('complementary',{name:'Area overview',exact:true})
 await expect(overview.locator('h2+p')).toContainText('CA')
 await expect(overview.locator('.overview-alert-card')).toContainText('Freeze Warning')
 await expect(overview.locator('.area-severity-badge')).toHaveText('Severe')
 await expect(page.locator('.public-alert-marker')).toHaveCount(0)
})

test('county overview leads with readable facts and keeps technical details collapsed',async({page})=>{
 const metric=(estimate:number,marginOfError:number|null)=>({estimate,marginOfError,variable:'fixture'})
 const acs={countyId:'48201',name:'Harris County',period:'2020-2024',population:metric(9742,null),households:metric(3053,170),noVehicleHouseholds:metric(329,122),noInternetHouseholds:metric(938,261),vehicleUniverse:metric(3053,170),internetUniverse:metric(3053,170),noVehiclePercent:10.8,noInternetPercent:30.7}
 await page.route('**/api/public/county/48201',r=>r.fulfill({json:{countyId:'48201',sources:{acs:source('Census ACS',acs),nri:source('FEMA National Risk Index',{counties:[{countyId:'48201',riskRating:'Relatively Low',resilienceRating:'Very Low',socialVulnerabilityRating:'Very High'}]}),fema:payload.sources.fema}}}))
 await page.getByLabel('Public data county').selectOption('48201')
 await page.getByRole('button',{name:'Apply filters'}).click()
 await page.getByRole('button',{name:'View official source records'}).click()
 const drawer=page.getByRole('complementary',{name:'County overview',exact:true})
 await expect(drawer.getByRole('heading',{name:'Harris County'})).toBeVisible()
 await expect(drawer.locator('.county-fact-grid')).toContainText('9,742')
 await expect(drawer.locator('.county-household-stat').first()).toContainText('10.8%')
 await expect(drawer.getByText('of households have no vehicle',{exact:true})).toBeVisible()
 await expect(drawer.locator('.county-data-details')).not.toHaveAttribute('open','')
 await expect(drawer.getByText('Long-term risk',{exact:false})).toBeVisible()
 await expect(drawer.locator('.county-risk-list')).not.toBeVisible()
 await drawer.getByText('Sources & data details',{exact:true}).click()
 await expect(drawer.getByText('9,742; margin of error: Not available',{exact:true})).toBeVisible()
 await drawer.getByText('Long-term risk',{exact:false}).click()
 await expect(drawer.locator('.county-risk-list')).toContainText('Community resilience (FEMA)')
 await page.screenshot({path:'test-results/simple-county-overview.png',fullPage:true})
 await drawer.getByRole('button',{name:'Close county overview'}).click()
 await expect(drawer).toHaveCount(0)
})

test('disaster groups and community tags use the same county estimates as filters',async({page})=>{
 const data={...payload,sources:{...payload.sources,noaa:source('NOAA',{alerts:[alert('harris-flood','Flood Warning','Severe'),alert('galveston-flood','Flood Watch','Minor',['48167']),alert('galveston-freeze','Freeze Warning','Moderate',['48167'])]}),acs:source('Census ACS county indicators',{counties:[{countyId:'48201',name:'Harris County',noInternetPercent:30,noVehiclePercent:5},{countyId:'48167',name:'Galveston County',noInternetPercent:3,noVehiclePercent:20}],period:'2020-2024'})}}
 await page.route('**/api/public/state/TX',r=>r.fulfill({json:data}))
 await page.reload()
 const overview=page.getByRole('complementary',{name:'Area overview',exact:true})
 const flood=overview.locator('section[aria-label="Flood alerts"]')
 await expect(flood.locator('.overview-alert-card')).toHaveCount(2)
 await expect(overview.locator('section[aria-label="Winter weather alerts"]')).toBeVisible()
 const first=flood.locator('.overview-alert-card').first()
 await expect(first.locator('[data-tag="internet"]')).toContainText('30% of households had no internet access')
 await expect(first.locator('[data-tag="vehicle"]')).toHaveCount(0)
 await expect(flood.locator('.overview-alert-card').last().locator('[data-tag="vehicle"]')).toContainText('20% of households had no vehicle available')
 await page.getByRole('checkbox',{name:/Households without internet/}).check()
 await expect(flood.locator('.overview-alert-card')).toHaveCount(2)
 await page.getByRole('button',{name:'Apply filters'}).click()
 await expect(flood.locator('.overview-alert-card')).toHaveCount(1)
 await expect(overview.locator('section[aria-label="Winter weather alerts"]')).toHaveCount(0)
 await expect(first.locator('[data-tag="internet"]')).toHaveAttribute('title',/Census estimate: at least 10%.*Harris County/)
 await expect(first.locator('[data-tag="internet"]')).toContainText('30% of households')
 await expect(first.locator('[data-tag="internet"]')).toContainText('Census estimate / 2020-2024')
 await expect(first).toContainText('not current outages')
 await page.screenshot({path:'test-results/grouped-alerts-community-tags.png',fullPage:true})
})
test('community tags do not invent missing data or use counties outside the alert',()=>{
 const data={...payload,sources:{...payload.sources,acs:source('ACS',{counties:[{countyId:'48201',name:'Harris County',noInternetPercent:null,noVehiclePercent:9},{countyId:'48167',name:'Galveston County',noInternetPercent:80,noVehiclePercent:50}]})}} as unknown as import('../src/publicDataTypes').PublicStateData
 expect(getAlertCommunityTags(alert('flood','Flood Warning','Severe') as PublicAlert,data,10)).toEqual([])
 expect(getAlertCommunityTags(alert('flood','Flood Warning','Severe') as PublicAlert,data,5).map(t=>t.id)).toEqual(['vehicle'])
})

test('community percentages reject missing or invalid values',()=>{
 for(const value of [null,undefined,NaN,Infinity,-1,101])expect(matchesCommunityPercentage(value,10)).toBe(false)
 expect(matchesCommunityPercentage(20,10)).toBe(true)
 expect(matchesCommunityPercentage(9.9,10)).toBe(false)
})
