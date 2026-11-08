import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
const plans=JSON.parse(readFileSync(new URL('../../data/scenarios/hurricane-marlow.plans.json',import.meta.url),'utf8'))
test('actual cached Gemini plan renders headings, bold labels and nested lists without raw Markdown',async({page})=>{
 await page.goto('/login')
 await page.evaluate(async text=>{
  const reactPath='/node_modules/.vite/deps/react.js',domPath='/node_modules/.vite/deps/react-dom_client.js',componentPath='/src/components/ReliefPlanText.tsx',cssPath='/src/components/ReliefPage.css'
  const React=(await import(reactPath)).default,dom=await import(domPath),Text=(await import(componentPath)).default;await import(cssPath)
  const mount=document.createElement('div');document.body.replaceChildren(mount)
  ;(dom.createRoot||dom.default.createRoot)(mount).render(React.createElement('div',{className:'real-app relief-page'},React.createElement(Text,{text})))
 },plans['48409'].text)
 for(const name of ['Situation','First 6 Hours','Next 24-72 Hours','Community Needs','Resource Coordination','Sources and Gaps'])await expect(page.getByRole('heading',{name,exact:true})).toBeVisible()
 await expect(page.locator('strong').filter({hasText:/^Event:$/})).toBeVisible()
 await expect(page.locator('ul ul')).not.toHaveCount(0)
 await expect(page.locator('.relief-plan-text')).not.toContainText('###')
 await expect(page.locator('.relief-plan-text')).not.toContainText('**Event:**')
 await expect(page.locator('.relief-plan-text')).toContainText('70,181')
 expect(await page.locator('.relief-plan-text').evaluate(element=>getComputedStyle(element).whiteSpace)).toBe('normal')
})
