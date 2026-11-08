import {test,expect} from '@playwright/test'
import {isCurrentAlert} from '../src/services/alertFilters'
import type {PublicAlert} from '../src/publicDataTypes'
test('active alerts exclude future, ended, expired and malformed timing',()=>{
 const now=Date.parse('2026-11-08T03:00:00Z')
 const alert={effective:'2026-11-08T01:00:00Z',expires:'2026-11-08T05:00:00Z',ends:null} as PublicAlert
 expect(isCurrentAlert(alert,now)).toBe(true)
 expect(isCurrentAlert({...alert,effective:'2026-11-08T04:00:00Z'},now)).toBe(false)
 expect(isCurrentAlert({...alert,ends:'2026-11-08T02:00:00Z'},now)).toBe(false)
 expect(isCurrentAlert({...alert,expires:'2026-11-08T02:00:00Z'},now)).toBe(false)
 expect(isCurrentAlert({...alert,expires:'invalid'},now)).toBe(false)
})
test('relief page offers official ways to help and keeps alert context',async({page})=>{
 const alert={id:'live-flood',event:'Flood Warning',severity:'Severe',area:'Test County',countyIds:['48201'],stateCodes:['TX'],effective:'2020-01-01T00:00:00Z',expires:'2099-01-01T00:00:00Z',ends:null,description:'Test impacts',sourceUrl:'https://www.weather.gov/alerts'}
 await page.route('**/api/public/alerts',r=>r.fulfill({json:{status:'available',data:{alerts:[alert],truncated:false}}}))
 await page.goto('/relief?state=TX&alert=live-flood')
 const actions=page.getByRole('region',{name:'Ways to provide relief'})
 await expect(actions.getByRole('link',{name:/Donate to disaster relief/})).toHaveAttribute('href','https://www.redcross.org/donate/donation.html/')
 await expect(actions.getByRole('link',{name:/Find volunteer opportunities/})).toHaveAttribute('href','https://www.redcross.org/volunteer/become-a-volunteer.html')
 await expect(page.locator('.relief-plan-scope')).toContainText('1 selected alerts')
 await expect(page.locator('.relief-simulation')).toHaveCount(0)
})
