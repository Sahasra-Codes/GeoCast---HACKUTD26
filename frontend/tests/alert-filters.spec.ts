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
  await expect(overview.locator('.overview-stats>div').first()).toContainText('2')
  await page.getByLabel('Severity',{exact:true}).selectOption('Minor')
  await expect(overview.locator('.area-severity-badge')).toHaveText('Minor')
  await expect(overview.locator('.overview-stats>div').first()).toContainText('1')
  // Severity selection must not remove choices from the dropdown.
  await expect(dropdown.locator('option[value="event:Heavy Freezing Spray Warning"]')).toHaveCount(1)
  await page.getByLabel('Severity',{exact:true}).selectOption('')
  await page.getByLabel('Public data county').selectOption('48201')
  await expect(overview.locator('.area-severity-badge')).toHaveText('Severe')
  await expect(overview.locator('.overview-stats>div').first()).toContainText('1')
  await dropdown.selectOption('event:Special Weather Statement')
  await expect(overview.locator('.area-severity-badge')).toHaveText('Unknown')
  await page.getByLabel('Severity',{exact:true}).selectOption('Severe')
  await expect(overview.locator('.area-severity-badge')).toHaveText('No matching alerts')
})
test('selecting an alert shows affected area, severity, flood category and official impacts separately',async({page})=>{
  await page.getByLabel('Disaster type').selectOption('event:Flood Warning')
  await page.getByRole('complementary',{name:'Area overview',exact:true}).locator('.area-alert-severity>button').first().click()
  const details=page.locator('.public-alert-detail')
  await expect(details).toContainText('NWS alert severitySevere')
  await expect(details).toContainText('Affected areaHarris County')
  await expect(details).toContainText('River flood category: Moderate')
  await expect(details).toContainText('Water covers low-lying roads.')
  await expect(details).toContainText('Do not drive through flooded roads.')
  await expect(details).toContainText('NWS alert severity and river flood category are different measures')
  await page.screenshot({path:'test-results/live-alert-severity.png',fullPage:true})
})
