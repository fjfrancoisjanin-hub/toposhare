// Contrôle du site de test en ligne, après déploiement. Lancé par la CI : npx playwright test -c playwright.preview.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/preview',
  timeout: 30_000,
  retries: 1,
  reporter: 'list',
  use: { ...devices['Pixel 7'], baseURL: 'https://toposhare-test.web.app', locale: 'fr-FR', serviceWorkers: 'block' },
});
