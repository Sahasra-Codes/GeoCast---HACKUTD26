import {test,expect} from '@playwright/test'
import {safeLoginDestination} from '../src/services/loginRedirect'
for(const path of ['/map','/insights','/relief','/resources','/insights?state=TX&alert=example']){
 test(`signed-out visitor must sign in for ${path}`,async({page})=>{
  const requests:string[]=[]
  page.on('request',request=>{if(request.url().includes('/api/public/'))requests.push(request.url())})
  await page.goto(path)
  await expect(page).toHaveURL(/\/login\?next=/)
  expect(new URL(page.url()).searchParams.get('next')).toBe(path)
  await expect(page.getByRole('heading',{name:'Sign in',exact:true})).toBeVisible()
  await expect(page.getByRole('navigation',{name:'Main navigation'})).toHaveCount(0)
  await expect(page.getByText('Continue without signing in')).toHaveCount(0)
  expect(requests).toEqual([])
 })
}
test('login destination accepts local links and rejects external or looping destinations',()=>{
 expect(safeLoginDestination('/insights?state=TX&alert=example')).toBe('/insights?state=TX&alert=example')
 for(const value of [null,'https://evil.example','//evil.example','/\\evil.example','/login','/login/?next=/map','/map\n'])expect(safeLoginDestination(value)).toBe('/map')
})
