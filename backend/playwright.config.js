import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

process.env.TEST_MODE = '1'
const { default: Env } = await import('./src/util/Env.js')

const testEnv = { ...process.env, TEST_MODE: '1' }

const webServer = [
  {
    command: 'node ./index.js',
    url: Env.getBackendApplicationUrl(),
    env: testEnv,
    reuseExistingServer: false,
    timeout: 60_000,
  },
]

const frontEndPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../', 'frontend')
if (fs.existsSync(frontEndPath)) {
  webServer.push({
    command: 'npm run dev -- -p 3012',
    cwd: frontEndPath,
    url: Env.getSpaApplicationUrl(),
    // O proxy do Next (app/api/[...path]) usa BACKEND_URL: aponta para o
    // backend de teste em vez do container de dev (backend-daosa:3000).
    env: { ...testEnv, BACKEND_URL: Env.getBackendApplicationUrl() },
    reuseExistingServer: false,
    timeout: 120_000,
  })
}

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.spec.js',
  outputDir: './test/e2e/.output/result',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: './test/e2e/.output/report' }],
  ],
  workers: 1,
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: Env.getSpaApplicationUrl(),
    trace: 'on-first-retry',
    screenshot: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer,
})