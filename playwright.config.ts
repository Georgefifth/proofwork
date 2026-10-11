import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './qa', timeout: 45_000, expect: { timeout: 12_000 },
  fullyParallel: false, workers: 2, retries: 0,
  outputDir: 'qa/artifacts/run',
  reporter: [['list'], ['json', { outputFile: 'qa/artifacts/results.json' }], ['html', { outputFolder: 'qa/artifacts/html', open: 'never' }]],
  use: { browserName: 'firefox', headless: true, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure', actionTimeout: 12_000 },
  projects: [
    { name: 'live-firefox', use: { baseURL: 'https://georgefifth.github.io/proofwork/' } },
    { name: 'local-firefox', use: { baseURL: 'http://127.0.0.1:5173/' } },
  ],
});
