import {test,expect} from '@playwright/test'

test('ranking waits for resources, uses partial data, exposes evidence and compares modes',async({page})=>{
 let release!:()=>void
 const ready=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/api/public/priority/census/TX',route=>route.fulfill({json:{sources:{},counties:{
  '48001':{pct65plus:0,pctNoVehicle:0,pctBelowPoverty:0,pctNoInternet:0},
  '48003':{pct65plus:40,pctNoVehicle:20,pctBelowPoverty:35,pctNoInternet:25}
 }}}))
 await page.route('**/api/public/priority/resources/*',async route=>{
  await ready
  const id=new URL(route.request().url()).pathname.split('/').pop()
  const common={retrievedAt:'2026-11-08T10:00:00Z',items:[],note:''}
  await route.fulfill({json:{shelter:{...common,status:'available',source:'FEMA Open Shelters',note:'No open shelters reported'},food:{...common,status:'unavailable',source:'OSM food banks'},medical:{...common,status:'available',source:'OSM hospitals',items:[{coordinates:{latitude:.5,longitude:id==='48001'?.5:2.5}}]}}})
 })
 await page.goto('/login')
 await page.evaluate(async()=>{
  const reactUrl='/node_modules/.vite/deps/react.js',domUrl='/node_modules/.vite/deps/react-dom_client.js',componentUrl='/src/components/PriorityRanking.tsx'
  const React=(await import(reactUrl)).default,dom=await import(domUrl),Ranking=(await import(componentUrl)).default
  const mount=document.createElement('div');document.body.replaceChildren(mount)
  const now=Date.parse('2026-11-08T10:00:00Z')
  const alert=(id:string,severity:string)=>({id,event:'Flood Warning',countyIds:[id],severity,certainty:'Observed',urgency:'Immediate',expires:'2099-01-01',ends:null,effective:null})
  const polygon=(x:number)=>({type:'Polygon',coordinates:[[[x,0],[x+1,0],[x+1,1],[x,1],[x,0]]]})
  ;(dom.createRoot||dom.default.createRoot)(mount).render(React.createElement(Ranking,{state:'TX',now,alerts:[alert('48001','Extreme'),alert('48003','Severe')],selectedId:'48003',geometry:{type:'FeatureCollection',features:[{type:'Feature',id:'48001',properties:{NAME:'Alpha County'},geometry:polygon(0)},{type:'Feature',id:'48003',properties:{NAME:'Beta County'},geometry:polygon(2)}]},onCounty:(id:string)=>{document.body.dataset.selectedCounty=id}}))
 })
 await expect(page.getByRole('status')).toContainText('Loading...')
 await expect(page.getByText('Data unavailable / alert only',{exact:true})).toHaveCount(0)
 await expect(page.getByRole('row',{name:/Select /})).toHaveCount(0)
 release()
 await expect(page.getByRole('button',{name:'Coverage gap',exact:true})).toHaveAttribute('aria-pressed','true')
 const rows=page.getByRole('row',{name:/Select /})
 await expect(rows).toHaveCount(2)
 await expect(rows.first()).toHaveAttribute('aria-label','Select Beta County')
 await expect(rows.first()).toContainText('Partial data')
 await expect(rows.first()).toContainText('No open shelters reported')
 await expect(rows.first().getByLabel('Rank change from severity only')).toContainText(String.fromCharCode(9650)+' 1')
 await page.getByRole('button',{name:'Evidence for Beta County',exact:true}).click()
 await expect(page.locator('.priority-evidence p').filter({hasText:/Resource categories used: medical/})).toBeVisible()
 await page.getByRole('button',{name:'Severity only',exact:true}).click()
 await expect(rows.first()).toHaveAttribute('aria-label','Select Alpha County')
 await expect(rows.first()).toContainText('100')
 await page.getByRole('checkbox',{name:'Only the selected event',exact:true}).check()
 await expect(rows).toHaveCount(1)
 await expect(rows.first()).toHaveAttribute('aria-label','Select Beta County')
 await rows.first().click()
 await expect(page.locator('body')).toHaveAttribute('data-selected-county','48003')
})
