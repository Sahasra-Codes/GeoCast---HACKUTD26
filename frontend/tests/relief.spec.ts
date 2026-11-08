import {test,expect} from '@playwright/test'
test.use({launchOptions:{args:[]}})
async function openRelief(page:import('@playwright/test').Page){
 await page.goto('/login')
 await page.evaluate(async()=>{
  const reactUrl='/node_modules/.vite/deps/react.js',domUrl='/node_modules/.vite/deps/react-dom_client.js',componentUrl='/src/components/ReliefPage.tsx'
  const React=(await import(reactUrl)).default,dom=await import(domUrl),Relief=(await import(componentUrl)).default
  const mount=document.createElement('div');document.body.replaceChildren(mount)
  ;(dom.createRoot||dom.default.createRoot)(mount).render(React.createElement('div',{className:'geocast real-app content-page'},React.createElement(Relief)))
 })
}
test('Relief asks for city and state, leaves county optional, and generates a plan without crowded data',async({page})=>{
 let input:unknown
 await page.route('**/api/relief/plan',async route=>{input=route.request().postDataJSON();await route.fulfill({json:{id:'test',title:'Relief plan for Dallas, TX',text:'1. Situation\nSource-backed test plan.\n2. First 6 hours\nVerify resource access.',generatedAt:'2026-11-08T10:00:00Z',model:'test',draft:true,alerts:[]}})})
 await openRelief(page)
 await expect(page.locator('.relief-events')).toHaveCount(0)
 await expect(page.locator('.relief-tags')).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Generate relief plan',exact:true})).toBeDisabled()
 await page.getByLabel('City',{exact:true}).fill('Dallas')
 await page.getByLabel('State',{exact:true}).selectOption('TX')
 await expect(page.getByLabel('County (optional)',{exact:true})).not.toHaveAttribute('required','')
 await page.getByRole('button',{name:'Generate relief plan',exact:true}).click()
 await expect(page.getByRole('region',{name:'Generated relief plan'})).toContainText('Verify resource access.')
 expect(input).toEqual({city:'Dallas',state:'TX',county:''})
 await expect(page.getByRole('button',{name:'Download plan',exact:true})).toBeVisible()
 expect(await page.locator('.relief-request-card').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)')
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

test('Relief waits for source loading and Gemini, and permits an explicit county',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});let input:unknown
 await page.route('**/api/relief/plan',async route=>{input=route.request().postDataJSON();await gate;await route.fulfill({status:503,json:{error:'Gemini unavailable. Please retry.'}})})
 await openRelief(page)
 await page.getByLabel('City',{exact:true}).fill('Dallas')
 await page.getByLabel('State',{exact:true}).selectOption('TX')
 await expect(page.getByLabel('County (optional)',{exact:true})).toBeEnabled()
 await page.getByLabel('County (optional)',{exact:true}).selectOption('48113')
 await page.getByRole('button',{name:'Generate relief plan',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('Loading local Insights and Resources')
 await expect(page.getByRole('button',{name:'Creating your plan...',exact:true})).toBeDisabled()
 release()
 await expect(page.locator('.general-guidance-label')).toContainText('General guidance')
 expect(input).toEqual({city:'Dallas',state:'TX',county:'48113'})
 await expect(page.getByRole('region',{name:'Generated relief plan'})).toContainText('Local information or plan generation could not load')
 await expect(page.getByRole('button',{name:'Generate relief plan',exact:true})).toBeEnabled()
})

test('location validation errors still ask for correction instead of inventing a local plan',async({page})=>{
 await page.route('**/api/relief/plan',route=>route.fulfill({status:422,json:{error:'City not found. Check the city and state.'}}))
 await openRelief(page);await page.getByLabel('City',{exact:true}).fill('Unknown city');await page.getByLabel('State',{exact:true}).selectOption('TX')
 await page.getByRole('button',{name:'Generate relief plan',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('City not found')
 await expect(page.getByRole('region',{name:'Generated relief plan'})).toHaveCount(0)
})
