// Tests de bout en bout, en vue mobile. Lancés par `npm run test:e2e` (émulateurs Firebase démarrés autour).
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'fr-FR',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'], browserName: 'chromium' } },
  ],
  webServer: { command: 'node tests/serve.js 4173', port: 4173, reuseExistingServer: !process.env.CI },
});
