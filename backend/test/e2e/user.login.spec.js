import { test, expect } from '@playwright/test'
import { testUser } from "../helper/http.js";

test.describe('Login', () => {

  test.beforeEach(async ({ page }) => {

    await page.goto('/login')

  })

  test('faz login com e-mail e senha e vai para a área logada', async ({ page }) => {

    const user = await testUser();

    await page.getByLabel('E-mail').fill(user.email)
    await page.getByLabel('Senha').fill("password")

    // Espera a chamada de login do backend junto com o clique, para validar o JWT.
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/login') && res.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Entrar' }).click(),
    ])

    expect(response.status()).toBe(200)

    expect(page).not.toHaveURL(/\/login/)
  })

  test('mostra erro com senha incorreta e continua no login', async ({ page }) => {
    page.getByLabel('E-mail').fill('e2e@example.com')
    page.getByLabel('Senha').fill('senha-errada')
    page.getByRole('button', { name: 'Entrar' }).click()

    // Texto real devolvido pelo backend: "Email ou senha inválidos."
    expect(page.getByText(/credenciais inválidas|e-?mail ou senha/i)).toBeVisible()
    expect(page).toHaveURL(/\/login/)
  })
  
})