import { test, expect } from '@playwright/test'
const fc = (features: unknown[]) => ({ type:'FeatureCollection',features })
const feature = (id: string, name: string, west: number, east: number) => ({ type:'Feature',id,properties:{GEOID:id,NAME:name,BASENAME:name.replace(' County','')},geometry:{type:'Polygon',coordinates:[[[west,29],[east,29],[east,31],[west,31],[west,29]]]}})
const source = (name: string, classification: string, data: unknown, status='available', error: string|null=null) => ({ name,classification,data,status,error,sourceUrl:'https://www.census.gov',vintage:'Test fixture vintage',retrievedAt:'2026-11-07T18:00:00Z' })
const harris = feature('48201','Harris County',-96,-95)
const galveston = feature('48167','Galveston County',-95,-94)
const nri={countyId:'48201',name:'Harris',riskScore:90,riskRating:'Very High',expectedAnnualLoss:1234,socialVulnerabilityScore:75,socialVulnerabilityRating:'High',resilienceScore:60,resilienceRating:'Relatively Moderate',hurricaneRating:'Very High',inlandFloodRating:'High',coastalFloodRating:'Moderate'}
const declarations={records:[{id:'test-record',disasterNumber:1,declaration:'DR-1-TX',title:'HISTORICAL TEST RECORD',type:'Hurricane',declarationType:'DR',declaredAt:'2024-01-01T00:00:00Z',beganAt:null,endedAt:null,area:'Harris County',countyId:'48201',updatedAt:'2024-01-02T00:00:00Z'}],limit:100,truncated:false}
const stateData={state:'TX',generatedAt:'2026-11-07T18:00:00Z',sources:{
 noaa:source('NOAA / National Weather Service','live_warnings',{alerts:[{id:'test-alert',event:'Flood Warning',severity:'Severe',urgency:'Expected',certainty:'Likely',area:'Harris County',headline:'Test warning headline',description:'Official test warning text',instruction:'Test instruction text',sent:'2026-11-07T17:00:00Z',effective:null,expires:'2099-11-07T23:00:00Z',ends:null,countyIds:['48201'],geometry:null,sourceUrl:'https://www.weather.gov/alerts'}],updated:null,truncated:false}),
 fema:source('FEMA OpenFEMA declarations','historical_records',declarations),boundaries:source('Census TIGERweb counties','geographic_boundaries',fc([harris,galveston])),nri:source('FEMA National Risk Index','historical_risk_context',{counties:[nri]})}}
const countyData={countyId:'48201',generatedAt:'2026-11-07T18:00:00Z',sources:{acs:source('Census ACS 2024 five-year estimates','survey_estimates',null,'configuration_required','Set an activated CENSUS_API_KEY in backend/.env to load ACS estimates.'),fema:stateData.sources.fema,nri:stateData.sources.nri}}

test('public data keeps live alerts, survey availability, historic records and boundaries separate',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/public/state/TX',r=>r.fulfill({json:stateData}))
 await page.route('**/api/public/county/48201',r=>r.fulfill({json:countyData}))
 await page.route('**/api/public/boundaries/tracts/48201',r=>r.fulfill({json:source('Census TIGERweb tracts','geographic_boundaries',fc([feature('48201000100','Census Tract 1',-95.9,-95.4)]))}))
 await page.goto('/')
 await expect(page.getByRole('button',{name:'Public sources',exact:true})).toHaveAttribute('aria-pressed','true')
 await expect(page.locator('.public-details-title h2')).toHaveText('Harris County')
 await expect(page.locator('.public-details')).toContainText('CENSUS_API_KEY')
 await expect(page.locator('.public-details')).toContainText('Not an event probability, AI prediction, or live flood severity')
 await expect(page.locator('.public-details')).toContainText('HISTORICAL TEST RECORD')
 await expect(page.locator('.radar-playback')).toHaveCount(0)
 await expect(page.locator('.disaster-marker')).toHaveCount(0)
 await page.getByRole('button',{name:'Severe Flood Warning Harris County'}).click()
 await expect(page.locator('.public-alert-detail')).toContainText('Official test warning text')
 await expect(page.locator('.public-alert-detail')).toContainText('Test instruction text')
 await page.getByRole('checkbox',{name:/National Risk Index/}).check()
 await page.getByRole('checkbox',{name:/TIGER census tracts/}).check()
 await expect(page.locator('.public-details')).toContainText('1 tract boundaries')
 await expect(page.locator('.map-canvas')).toHaveAttribute('data-boundaries-ready','true',{timeout:45000})
 await page.screenshot({path:'test-results/public-sources.png',fullPage:true})
 expect(errors).toEqual([])
})

test('public source outage never silently substitutes demo alerts',async({page})=>{
 await page.route('**/api/public/**',r=>r.fulfill({status:503,json:{detail:'unavailable'}}))
 await page.goto('/')
 await expect(page.locator('.public-map-error')).toContainText('public-data backend is unavailable')
 await expect(page.locator('.disaster-marker')).toHaveCount(0)
 await page.getByRole('button',{name:'Demo scenarios',exact:true}).click()
 await expect(page.locator('.radar-playback')).toBeVisible()
 await expect(page.locator('.disaster-marker')).toHaveCount(2,{timeout:45000})
})

test('ACS counts and own-universe percentages render as survey estimates',async({page})=>{
 const metric=(estimate:number,moe:number)=>({estimate,marginOfError:moe,variable:'test-variable'})
 const acs={countyId:'48201',name:'Harris County, Texas',period:'2020–2024',population:metric(1000,20),households:metric(150,10),noVehicleHouseholds:metric(10,2),vehicleUniverse:metric(100,10),noInternetHouseholds:metric(40,5),internetUniverse:metric(200,10),noVehiclePercent:10,noInternetPercent:20}
 await page.route('**/api/public/state/TX',r=>r.fulfill({json:stateData}))
 await page.route('**/api/public/county/48201',r=>r.fulfill({json:{...countyData,sources:{...countyData.sources,acs:source('Census ACS 2024 five-year estimates','survey_estimates',acs)}}}))
 await page.goto('/')
 await expect(page.locator('.acs-values')).toContainText('1,000')
 await expect(page.locator('.acs-values')).toContainText('± 20 MOE')
 await expect(page.locator('.public-percentages')).toContainText('10%')
 await expect(page.locator('.public-percentages')).toContainText('20%')
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
