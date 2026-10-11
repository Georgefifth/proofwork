import original from '../../playwright.config';
import { defineConfig } from '@playwright/test';
import path from 'node:path';
export default defineConfig({ ...original, testDir: path.join(process.cwd(), 'qa'), outputDir: path.join(process.cwd(), 'validation/real-world/runs', process.env.QA_PHASE || 'regression-artifacts'), reporter: [['list'], ['json', {outputFile: path.join(process.cwd(), 'validation/real-world/runs', (process.env.QA_PHASE || 'regression') + '-results.json')}]] });
