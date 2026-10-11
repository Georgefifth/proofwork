import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkContract, compareProject, normalize, parseTables, validateProject, type Contract, type Extraction } from '../src/engine.ts';
import { baselineText, demoProject } from '../src/demo.ts';

const hash = 'a'.repeat(64);
const contract = (): Contract => structuredClone(demoProject(hash).contracts[0]);
const markdown = (text: string): Extraction => ({ name: 'output.md', format: 'markdown', text });
const html = (text: string): Extraction => ({ name: 'output.html', format: 'html', text });
const check = (output: Extraction, c = contract()) => checkContract(c, parseTables(output), hash);

test('demo exposes a wrong-column value and missing row, with a passing control', () => {
  const results = compareProject(demoProject(hash));
  assert.deepEqual(results.map(r => r.change), ['regression', 'regression', 'unchanged']);
  assert.deepEqual(results.map(r => r.candidate.status), ['fail', 'fail', 'pass']);
  assert.equal(results[0].candidate.actual, '119.00');
  assert.match(results[1].candidate.reason, /Row.*missing/);
});

test('text presence alone does not pass a wrong row-column relationship', () => {
  const project = demoProject(hash);
  assert.ok(project.candidate.text.includes('125.60'));
  assert.equal(check(project.candidate).status, 'fail');
});

test('numeric precision, signs and units are not erased by normalization', () => {
  for (const wrong of ['125.6', '-125.60', '125.60 USD', '125,60']) {
    assert.equal(check(markdown(baselineText.replace('125.60', wrong))).status, 'fail', wrong);
  }
  assert.equal(normalize('  e\u0301 \n value  '), 'é value');
});

test('duplicate row labels are ambiguous even if one value matches', () => {
  const duplicate = baselineText + '\n| Atlas chair | 120.00 | 125.60 |';
  assert.equal(check(markdown(duplicate)).status, 'ambiguous');
});

test('duplicate selected column headers are ambiguous', () => {
  const duplicate = baselineText.replace('2023 (USD)', '2024 (USD)');
  assert.equal(check(markdown(duplicate)).status, 'ambiguous');
});

test('reordering columns preserves a named row-column contract', () => {
  assert.equal(check(markdown('| 2024 (USD) | Product | 2023 (USD) |\n| --- | --- | --- |\n| 125.60 | Atlas chair | 119.00 |')).status, 'pass');
});

test('missing table and missing column fail rather than pass', () => {
  assert.equal(check(markdown('No table here.')).status, 'fail');
  assert.equal(check(markdown(baselineText.replaceAll('2024 (USD)', '2025 (USD)'))).status, 'fail');
});

test('malformed Markdown table is unsupported', () => {
  assert.equal(check(markdown('| Product | 2024 (USD) |\n| --- | --- |\n| Atlas chair |')).status, 'unsupported');
});

test('escaped pipes, Unicode and inline decoration are parsed as cell text', () => {
  const c = contract(); c.rowLabel = 'Atlas | chair';
  assert.equal(check(markdown('| Product | 2024 (USD) |\n| --- | --- |\n| Atlas \\| chair | **125.60** |'), c).status, 'pass');
});

test('tables inside fenced code are not mistaken for extraction tables', () => {
  assert.equal(parseTables(markdown('```markdown\n' + baselineText + '\n```')).length, 0);
  assert.equal(parseTables(markdown('````markdown\n~~~\n' + baselineText + '\n```\n````')).length, 0);
});

test('oversized table review sets produce unresolved outcomes instead of throwing', () => {
  const long = '| Product | 2024 (USD) |\n| --- | --- |\n' + '| Atlas chair | 125.60 |\n'.repeat(2001);
  assert.equal(check(markdown(long)).status, 'unsupported');
  const many = ('| Product | 2024 (USD) |\n| --- | --- |\n| Atlas chair | 125.60 |\n\n').repeat(101);
  assert.equal(check(markdown(many)).status, 'unsupported');
});

test('HTML tables support spans and entities without executing scripts', () => {
  const output = html('<script>throw new Error("do not execute")</script><table><tr><th>Product</th><th>2024 (USD)</th></tr><tr><td>Atlas chair</td><td>125.60<script>malicious()</script></td></tr></table>');
  assert.equal(check(output).status, 'pass');
  const tables = parseTables(html('<table><tr><th rowspan="2">Product</th><th colspan="2">Year</th></tr><tr><th>2023</th><th>2024</th></tr><tr><td>Atlas &amp; Cove</td><td>119.00</td><td>125.60</td></tr></table>'));
  assert.deepEqual(tables[0].rows, [['Product', 'Year', 'Year'], ['Product', '2023', '2024'], ['Atlas & Cove', '119.00', '125.60']]);
  assert.equal(tables[0].issue, undefined);
});

test('nested HTML tables and oversized spans are unsupported', () => {
  for (const text of ['<table><tr><td><table><tr><td>125.60</td></tr></table></td></tr></table>', '<table><tr><td colspan="999999999">125.60</td></tr></table>', '<table><tr><td rowspan="0">125.60</td></tr></table>']) {
    assert.equal(check(html(text)).status, 'unsupported');
  }
});

test('evidence bound to a different PDF cannot pass', () => {
  const c = contract(); c.evidence.sourceHash = 'b'.repeat(64);
  assert.equal(check(markdown(baselineText), c).status, 'unsupported');
});

test('comparisons separate improvements, existing failures and unresolved outcomes', () => {
  const p = demoProject(hash);
  [p.baseline, p.candidate] = [p.candidate, p.baseline];
  assert.equal(compareProject(p)[0].change, 'improvement');
  p.candidate = p.baseline;
  assert.equal(compareProject(p)[0].change, 'existing-failure');
  p.candidate = markdown(baselineText + '\n| Atlas chair | 119.00 | 125.60 |');
  assert.equal(compareProject(p)[0].change, 'review');
});

test('project export roundtrip preserves human-reviewed contracts and outputs', () => {
  const p = demoProject(hash);
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
});

test('untrusted project rejects invalid evidence, duplicate IDs and changed source identity', () => {
  for (const mutate of [
    (p: ReturnType<typeof demoProject>) => { p.contracts[0].evidence.rect.width = 2; },
    (p: ReturnType<typeof demoProject>) => { p.contracts[0].evidence.page = 999; },
    (p: ReturnType<typeof demoProject>) => { p.contracts[1].id = p.contracts[0].id; },
    (p: ReturnType<typeof demoProject>) => { p.contracts[0].evidence.sourceHash = 'b'.repeat(64); },
    (p: ReturnType<typeof demoProject>) => { p.contracts[0].tableIndex = -1; }
  ]) {
    const p = demoProject(hash); mutate(p); assert.throws(() => validateProject(p), /Invalid project/);
  }
  assert.throws(() => validateProject(null), /Invalid project/);
  assert.throws(() => validateProject({ version: 99 }), /Invalid project/);
});
