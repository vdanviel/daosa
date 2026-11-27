import { test, expect } from '@playwright/test'

test.describe('Register', () => {

  test.beforeEach(async ({ page }) => {

    await page.goto('/register')

  })

test('faz registro com dados e segue', async ({ page }) => {
  const consoleErrors = []
  const pageErrors = []
  const failedRequests = []

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  expect(consoleErrors).toEqual([])

  page.on('pageerror', err => pageErrors.push(err.message))
  expect(pageErrors).toEqual([])

  page.on('requestfailed', req =>
    failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`)
  )
  expect(failedRequests).toEqual([])

  await page.getByLabel('Nome da empresa ou seu nome').fill('Empresa Teste')
  await page.getByLabel('CPF ou CNPJ').fill('662.893.380-64')
  await page.getByLabel('E-mail').fill(Date.now() + '@email.com')
  await page.getByLabel('Senha').fill('password')

  const [response] = await Promise.all([
    page.waitForResponse(res =>
      res.url().includes('register') && res.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Criar conta' }).click(),
  ])

  expect(response.status()).toBe(201)

  await expect(page).not.toHaveURL(/\/register/)

})
  
})