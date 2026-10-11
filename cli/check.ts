#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compareProject, validateProject, type Extraction } from '../src/engine.ts';

async function main() {
  const args = process.argv.slice(2);
  const projectFile = args.shift();
  if (!projectFile || projectFile === '--help') {
    console.log('Usage: npm run check -- project.json [--baseline file.md] [--candidate file.md] [--pdf source.pdf] [--json]');
    console.log('HTML files are detected by .html/.htm extension. Other output files are treated as Markdown.');
    process.exitCode = projectFile === '--help' ? 0 : 2; return;
  }
  const options: Record<string, string | boolean> = {};
  while (args.length) {
    const key = args.shift()!;
    if (key === '--json') { options.json = true; continue; }
    if (!['--baseline', '--candidate', '--pdf'].includes(key) || !args[0] || args[0].startsWith('--')) throw new Error(`Unknown option or missing value: ${key}`);
    options[key.slice(2)] = args.shift()!;
  }
  const project = validateProject(JSON.parse(await readFile(projectFile, 'utf8')));
  if (!project.contracts.length) throw new Error('No verified checks exist. An empty suite cannot satisfy the gate.');
  for (const which of ['baseline', 'candidate'] as const) {
    const file = options[which];
    if (typeof file === 'string') {
      const text = await readFile(file, 'utf8');
      if (text.length > 5_000_000) throw new Error(`${which} output exceeds the 5 MB limit.`);
      project[which] = { name: file, format: /\.html?$/i.test(file) ? 'html' : 'markdown', text } satisfies Extraction;
    }
  }
  if (typeof options.pdf === 'string') {
    const bytes = await readFile(options.pdf);
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== project.source.hash) throw new Error('Source PDF hash does not match the human-reviewed evidence.');
  }
  const results = compareProject(project);
  const failed = results.filter(r => r.candidate.status !== 'pass');
  if (options.json) console.log(JSON.stringify({ project: project.name, sourceHash: project.source.hash, checked: results.length, candidateGate: failed.length ? 'blocked' : 'passed', results }, null, 2));
  else {
    console.log(`Proofwork · ${project.name}`);
    console.log(`${results.length} verified facts · candidate gate ${failed.length ? 'BLOCKED' : 'PASSED'}`);
    for (const result of results) {
      const c = result.contract;
      console.log(`\n[${result.candidate.status.toUpperCase()} / ${result.change}] ${c.title}`);
      console.log(`  Page ${c.evidence.page}, table ${c.tableIndex + 1}: ${c.rowLabel} → ${c.valueColumn}`);
      console.log(`  Expected: ${c.expected}; actual: ${result.candidate.actual ?? '(not uniquely available)'}`);
      console.log(`  ${result.candidate.reason}`);
    }
    console.log('\nOnly saved, human-verified facts are covered. Use --pdf to verify source identity.');
  }
  process.exitCode = failed.length ? 1 : 0;
}
main().catch(error => { console.error(`Proofwork: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 2; });
