import { test, expect } from '@playwright/test'
import { testUser, TEST_PASSWORD } from "../helper/http.js";

test.describe('Login', () => {

  test.beforeEach(async ({ page }) => {

    await page.goto('/login')

  })

  test('faz login com e-mail e senha e vai para a área logada', async ({ page }) => {

    const user = await testUser();

    await page.getByLabel('E-mail').fill(user.email)
    await page.getByLabel('Senha').fill(TEST_PASSWORD)

    // Espera a chamada de login do backend junto com o clique, para validar o JWT.
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/login') && res.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Entrar' }).click(),
    ])

    expect(response.status()).toBe(200)

    // Confere que saiu da tela de login. Troque pela rota/elemento da sua home.
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('mostra erro com senha incorreta e continua no login', async ({ page }) => {
    await page.getByLabel('E-mail').fill('e2e@example.com')
    await page.getByLabel('Senha').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()

    // Texto real devolvido pelo backend: "Email ou senha inválidos."
    await expect(page.getByText(/credenciais inválidas|e-?mail ou senha/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
  
})