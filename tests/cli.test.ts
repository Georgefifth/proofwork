import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { demoProject } from '../src/demo.ts';

test('CLI enforces failed, passing, empty and source-mismatch gates', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'proofwork-test-'));
  try {
    const pdfFile = new URL('../public/northstar-demo.pdf', import.meta.url);
    const hash = createHash('sha256').update(await readFile(pdfFile)).digest('hex');
    const p = demoProject(hash), file = join(directory, 'project.json');
    const invoke = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'cli/check.ts', file, ...args], { encoding: 'utf8' });
    await writeFile(file, JSON.stringify(p));
    const failed = invoke('--json');
    assert.equal(failed.status, 1, failed.stderr);
    assert.equal(JSON.parse(failed.stdout).candidateGate, 'blocked');
    const outputFile = join(directory, 'fixed.md');
    await writeFile(outputFile, p.baseline.text);
    const passed = invoke('--candidate', outputFile, '--pdf', pdfFile.pathname, '--json');
    assert.equal(passed.status, 0, passed.stderr);
    assert.equal(JSON.parse(passed.stdout).candidateGate, 'passed');
    const badPdf = join(directory, 'other.pdf'); await writeFile(badPdf, 'a different source');
    assert.equal(invoke('--pdf', badPdf).status, 2);
    p.contracts = []; await writeFile(file, JSON.stringify(p));
    assert.equal(invoke().status, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
