import { test as base, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const pdfPath = path.join(root, 'public/northstar-demo.pdf');
const fixture = JSON.parse(await fs.readFile(path.join(root, 'examples/northstar.project.json'), 'utf8'));
const baseline = fixture.baseline.text;
const candidate = fixture.candidate.text;
const verification = 'I verified the row, column and value in the original PDF.';
const test = base.extend<{ audit: void }>({
  audit: [async ({ page, browser }, use, info) => {
    const errors: string[] = [], traffic: string[] = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('requestfailed', r => traffic.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`));
    page.on('response', r => { if (r.status() >= 400) traffic.push(`HTTP ${r.status()} ${r.url()}`); });
    await use();
    await info.attach('browser-audit', { body: JSON.stringify({ browserVersion: browser.version(), url: page.url(), scripts: await page.locator('script[src]').evaluateAll(els=>els.map(el=>el.getAttribute('src'))), errors, traffic }, null, 2), contentType: 'application/json' });
    if (!info.title.includes('network outage')) { expect(errors, 'Unexpected browser errors').toEqual([]); expect(traffic, 'Unexpected failed requests').toEqual([]); }
    else { expect(traffic.some(t => t.includes('northstar-demo.pdf')), 'Outage was actually exercised').toBe(true); expect(errors.filter(e=>e.startsWith('pageerror'))).toEqual([]); }
  }, { auto: true }],
});
async function start(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Run comparison', exact: true })).toBeEnabled();
  await expect(page.locator('.render-status')).toBeHidden();
  await expect(page.locator('canvas')).toBeVisible();
}
async function shot(page: Page, name: string) { await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true }); }
async function click(page: Page, name: string) { await page.getByRole('button', { name, exact: true }).click(); }
async function upload(page: Page, button: string, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: button, exact: true }).first().click();
  await (await chooser).setFiles(file);
}
async function newProject(page: Page) {
  await click(page, 'New project'); await click(page, 'Continue');
  await expect(page.getByRole('heading', { name: '0 source-linked checks' })).toBeVisible();
}
async function region(page: Page) { await page.getByText('Enter region bounds with keyboard', { exact: true }).click(); await click(page, 'Apply region'); }
async function exportJson(page: Page) {
  await click(page, 'Export project');
  const data = JSON.parse(await page.getByRole('textbox', { name: 'Project JSON' }).inputValue());
  await click(page, 'Close export'); return data;
}
async function importJson(page: Page, data: object) {
  await upload(page, 'Open project', { name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await click(page, 'Continue');
  await expect(page.getByText('Project opened. Attach the matching source PDF to view evidence and run checks.', { exact: true })).toBeVisible();
}
async function candidateText(page: Page, value: string, format = 'markdown') {
  await click(page, 'Extraction outputs');
  const panel = page.locator('.output-card').filter({ has: page.getByRole('heading', { name: 'Candidate', exact: true }) });
  await panel.getByRole('combobox', { name: 'Format', exact: true }).selectOption(format);
  await page.getByRole('textbox', { name: 'Candidate extraction text' }).fill(value);
  await click(page, 'Run comparison');
}

test('first visit explains synthetic errors and filters preserve source context', async ({ page }) => {
  await start(page);
  await expect(page.locator('.demo-banner')).toContainText('synthetic catalogue');
  await expect(page.locator('.comparison-summary')).toContainText('2 new regressions');
  await expect(page.locator('.check-item')).toHaveCount(3);
  await click(page, 'Regressions 2'); await expect(page.locator('.check-item')).toHaveCount(2);
  await page.locator('.check-item').filter({ hasText: 'Cove desk' }).click();
  await expect(page.locator('.detail-panel')).toContainText('249.00');
  await expect(page.locator('.detail-panel')).toContainText('Row “Cove desk” is missing.');
  await click(page, 'Locate source'); await expect(page.getByRole('status').filter({hasText:'highlighted'})).toBeVisible();
  await click(page, 'Review 0'); await expect(page.getByText('No checks need review in this run.')).toBeVisible();
  await click(page, 'All 3'); await expect(page.locator('.check-item')).toHaveCount(3);
  await shot(page, 'review');
});
test('PDF navigation and zoom actually change rendered document; source restores page', async ({ page }) => {
  await start(page); const before = await page.locator('canvas').boundingBox();
  await click(page, 'Next page'); await expect(page.locator('canvas')).toHaveAttribute('aria-label','Source PDF page 2');
  await expect(page.getByRole('button',{name:'Next page',exact:true})).toBeDisabled();
  await click(page, 'Zoom in'); await expect(page.getByRole('button',{name:'125%',exact:true})).toBeVisible();
  await expect.poll(async()=> (await page.locator('canvas').boundingBox())!.width).toBeGreaterThan(before!.width);
  await click(page,'125%'); await expect(page.getByRole('button',{name:'100%',exact:true})).toBeVisible();
  await click(page,'Zoom out'); await expect(page.getByRole('button',{name:'75%',exact:true})).toBeVisible();
  await click(page,'Previous page'); await expect(page.locator('canvas')).toHaveAttribute('aria-label','Source PDF page 1');
  await shot(page,'pdf-zoom');
});
test('help modal supports keyboard close and restores focus', async ({ page }) => {
  await start(page); await page.getByRole('button',{name:'How it works'}).click();
  await expect(page.getByRole('dialog',{name:'How Proofwork works'})).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Attach the original PDF');
  await shot(page,'help'); await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button',{name:'How it works'})).toBeFocused();
  await click(page,'Run comparison'); await expect(page.locator('.comparison-summary')).toContainText('2 new regressions');
});
test('new project cancel preserves work, confirmed empty state explains next step', async ({ page }) => {
  await start(page); await click(page,'New project'); await shot(page,'replace-dialog');
  await click(page,'Cancel'); await expect(page.locator('.check-item')).toHaveCount(3);
  await newProject(page); await expect(page.getByRole('button',{name:'Run comparison',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'New check',exact:true})).toBeDisabled();
  await expect(page.getByRole('heading',{name:'Attach your source PDF'})).toBeVisible(); await shot(page,'empty');
  await click(page,'Try the synthetic demo'); await expect(page.locator('.check-item')).toHaveCount(3);
});
test('full first-user task uploads PDF and both outputs, manually verifies fact and catches swap', async ({ page }) => {
  await start(page); await newProject(page); await upload(page,'Attach source PDF',pdfPath);
  await expect(page.getByText('Source PDF attached. Your document stays in this browser.',{exact:true})).toBeVisible();
  await click(page,'Extraction outputs');
  for (const [name,text] of [['Baseline',baseline],['Candidate',candidate]]) {
    const panel=page.locator('.output-card').filter({has:page.getByRole('heading',{name,exact:true})});
    const chooser=page.waitForEvent('filechooser'); await panel.getByRole('button',{name:'Upload file',exact:true}).click();
    await (await chooser).setFiles({name:`${name.toLowerCase()}.md`,mimeType:'text/markdown',buffer:Buffer.from(text)});
    await expect(panel.getByText('1 table detected')).toBeVisible();
  }
  await page.getByRole('button',{name:'Source & checks'}).click(); await click(page,'New check'); await region(page);
  await page.getByRole('combobox',{name:'Row label column',exact:true}).selectOption('Product');
  await page.getByLabel('Row label',{exact:true}).fill('Atlas chair');
  await page.getByRole('combobox',{name:'Value column',exact:true}).selectOption('2024 (USD)');
  await page.getByLabel('Expected value',{exact:true}).fill('125.60');
  await expect(page.getByRole('button',{name:'Save verified check',exact:true})).toBeDisabled();
  await page.getByLabel(verification).check(); await click(page,'Save verified check'); await click(page,'Run comparison');
  await expect(page.locator('.check-item')).toHaveCount(1); await expect(page.locator('.inline-diff')).toContainText('125.60');
  await expect(page.locator('.inline-diff')).toContainText('119.00'); await expect(page.locator('.comparison-summary')).toContainText('1 new regressions');
  await shot(page,'first-task-result');
});
test('cell prefill plus real pointer evidence saves a new contract', async ({ page }) => {
  await start(page); await click(page,'New check');
  await click(page,'Use Atlas chair / 2023 (USD) / 119.00');
  await expect(page.getByLabel('Expected value',{exact:true})).toHaveValue('119.00');
  await page.locator('canvas').scrollIntoViewIfNeeded(); const b=(await page.locator('canvas').boundingBox())!;
  await page.mouse.move(b.x+b.width*.09,b.y+b.height*.21); await page.mouse.down();
  await page.mouse.move(b.x+b.width*.9,b.y+b.height*.44,{steps:12}); await page.mouse.up();
  await expect(page.locator('.region-state')).toContainText('Evidence selected');
  await expect(page.getByRole('button',{name:'Save verified check',exact:true})).toBeDisabled();
  await page.getByLabel(verification).check(); await shot(page,'authoring'); await click(page,'Save verified check');
  await expect(page.locator('.check-item')).toHaveCount(4); const data=await exportJson(page);
  expect(data.contracts[3].expected).toBe('119.00'); expect(data.contracts[3].evidence.rect.width).toBeGreaterThan(.7);
  await click(page,'Run comparison'); await expect(page.locator('.comparison-summary')).toContainText('3 new regressions');
});
test('edit preserves identity, resets confirmation on fact change, cancel is safe', async ({ page }) => {
  await start(page); await click(page,'Edit check');
  await expect(page.getByLabel('Expected value',{exact:true})).toHaveValue('125.60');
  await page.getByLabel(verification).check(); await page.getByLabel('Expected value',{exact:true}).fill('125.6');
  await expect(page.getByLabel(verification)).not.toBeChecked();
  await click(page,'Cancel new check'); await expect(page.locator('.expected-value')).toHaveText('125.60');
  await click(page,'Edit check'); await page.getByLabel('Check name optional',{exact:true}).fill('QA edited price');
  await page.getByLabel(verification).check(); await click(page,'Save verified check');
  await expect(page.locator('.check-item')).toHaveCount(3); await expect(page.locator('.outcome-pair')).toHaveCount(0);
  const data=await exportJson(page); expect(data.contracts[0].id).toBe('demo-atlas'); expect(data.contracts[0].title).toBe('QA edited price');
  await click(page,'Run comparison'); await expect(page.locator('.comparison-summary')).toContainText('2 new regressions');
});
test('delete cancellation then committed deletion updates suite and allows continuation', async ({ page }) => {
  await start(page); await click(page,'Delete check'); await click(page,'Cancel'); await expect(page.locator('.check-item')).toHaveCount(3);
  await click(page,'Delete check'); await click(page,'Continue'); await expect(page.locator('.check-item')).toHaveCount(2);
  await click(page,'Run comparison'); await expect(page.locator('.comparison-summary')).toContainText('1 new regressions');
});
test('native download contains portable project; reopen and matching PDF run roundtrip', async ({ page }) => {
  await start(page); await click(page,'Export project');
  const downloadPromise=page.waitForEvent('download'); await click(page,'Download JSON'); const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('proofwork-project.json'); expect(await download.failure()).toBeNull();
  const saved=test.info().outputPath('downloaded-project.json'); await download.saveAs(saved);
  const data=JSON.parse(await fs.readFile(saved,'utf8')); expect(data.contracts).toHaveLength(3); expect(data.source.hash).toBe(fixture.source.hash);
  expect(Object.keys(data.source).sort()).toEqual(['hash','name','pages']); await click(page,'Close export');
  await upload(page,'Open project',saved); await click(page,'Continue');
  await expect(page.getByRole('button',{name:'Run comparison',exact:true})).toBeDisabled();
  await upload(page,'Attach source PDF',pdfPath); await click(page,'Run comparison');
  await expect(page.locator('.comparison-summary')).toContainText('2 new regressions'); await shot(page,'roundtrip');
});
test('invalid project, corrupt PDF and mismatched source preserve work and recover', async ({ page }) => {
  await start(page);
  await upload(page,'Open project',{name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{oops')});
  await expect(page.getByRole('alert')).toContainText('Your current work is unchanged. Choose a Proofwork project JSON'); await expect(page.locator('.check-item')).toHaveCount(3); await shot(page,'invalid-json');
  await click(page,'Dismiss message'); await expect(page.getByRole('alert')).toBeHidden();
  await upload(page,'Attach source PDF',{name:'bad.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')});
  await expect(page.getByRole('alert')).toContainText('does not match');
  const other=Buffer.concat([await fs.readFile(pdfPath),Buffer.from('\n% another-source\n')]);
  await upload(page,'Attach source PDF',{name:'other.pdf',mimeType:'application/pdf',buffer:other});
  await expect(page.getByRole('alert')).toContainText('does not match'); await shot(page,'source-mismatch');
  await click(page,'Run comparison'); await expect(page.locator('.comparison-summary')).toContainText('2 new regressions');
  await newProject(page); await upload(page,'Attach source PDF',{name:'bad.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')});
  await expect(page.getByRole('alert')).toBeVisible(); await upload(page,'Attach source PDF',pdfPath);
  await expect(page.getByRole('button',{name:'New check',exact:true})).toBeEnabled();
});
test('empty baseline and invalid evidence cannot create a falsely verified check', async ({ page }) => {
  await start(page); await click(page,'Extraction outputs'); await page.getByRole('textbox',{name:'Baseline extraction text'}).fill('');
  await page.getByRole('button',{name:'Source & checks'}).click(); await click(page,'New check');
  await expect(page.getByText('Add a baseline extraction with a supported table in Extraction outputs first.')).toBeVisible();
  await region(page); await page.getByLabel('width %',{exact:true}).fill('99'); await click(page,'Apply region');
  await expect(page.getByRole('alert')).toContainText('contained within the page');
  await expect(page.getByRole('button',{name:'Save verified check',exact:true})).toBeDisabled(); await shot(page,'invalid-region');
  await click(page,'Cancel new check'); await click(page,'Extraction outputs');
  await page.getByRole('textbox',{name:'Baseline extraction text'}).fill(baseline); await click(page,'Run comparison');
  await expect(page.locator('.comparison-summary')).toContainText('2 new regressions');
});
for (const [name,text,format,result] of [
  ['empty candidate','','markdown','3 candidate checks did not pass'],
  ['malformed markdown','| Product | 2024 (USD) |\n| --- | --- |\n| Atlas chair | 125.60 | unexpected |','markdown','3 need review'],
  ['duplicate row',baseline+'\n| Atlas chair | 119.00 | 125.60 |','markdown','1 need review'],
  ['nested table','<table><tr><th>Product</th><th>2024 (USD)</th></tr><tr><td>Atlas chair</td><td><table><tr><td>125.60</td></tr></table></td></tr></table>','html','3 need review'],
] as const) test(`${name} blocks gate with clear outcomes, corrected output passes`,async({page})=>{
  await start(page); await candidateText(page,text,format);
  await expect(page.locator(result.includes('need review')?'.comparison-summary':'.gate-summary')).toContainText(result);
  await shot(page,name.replaceAll(' ','-')); await candidateText(page,baseline); await expect(page.locator('.gate-summary')).toContainText('Saved checks passed');
});
test('HTML upload and preview preserve table facts and never execute embedded markup',async({page})=>{
  await start(page); await click(page,'Extraction outputs');
  const panel=page.locator('.output-card').filter({has:page.getByRole('heading',{name:'Candidate',exact:true})});
  const html='<script>document.title="UNSAFE EXECUTED"</script><table><tr><th>Product</th><th>2024 (USD)</th></tr><tr><td>Atlas chair</td><td>125.60</td></tr><tr><td>Cove desk</td><td>249.00</td></tr><tr><td>Reed lamp</td><td>45.00</td></tr></table>';
  const chooser=page.waitForEvent('filechooser'); await panel.getByRole('button',{name:'Upload file'}).click(); await(await chooser).setFiles({name:'candidate.html',mimeType:'text/html',buffer:Buffer.from(html)});
  await panel.getByRole('button',{name:'Table preview 1',exact:true}).click(); await expect(panel.getByRole('cell',{name:'125.60',exact:true})).toBeVisible();
  await expect(page).toHaveTitle('Proofwork · PDF regression workbench'); await shot(page,'html-preview');
  await click(page,'Run comparison'); await expect(page.locator('.gate-summary')).toContainText('Saved checks passed');
});
test('device draft refresh keeps edited checks, requires PDF, opt-out removes persisted copy',async({page})=>{
  await start(page); await click(page,'Edit check'); await page.getByLabel('Check name optional').fill('Persisted QA price');
  await page.getByLabel(verification).check(); await click(page,'Save verified check');
  await page.getByLabel('Keep a draft on this device').check(); await expect(page.locator('.device-save-bar')).toContainText('Saved on this device');
  await page.reload(); await expect(page.getByText('Device draft restored. Attach the matching PDF to view source evidence.',{exact:true})).toBeVisible();
  await expect(page.locator('.check-item')).toHaveCount(3); await expect(page.locator('.check-item').first()).toContainText('Persisted QA price');
  await expect(page.getByRole('button',{name:'Run comparison',exact:true})).toBeDisabled(); await shot(page,'restored-draft');
  await upload(page,'Attach source PDF',pdfPath); await click(page,'Run comparison'); await expect(page.locator('.comparison-summary')).toContainText('2 new regressions');
  await page.getByLabel('Keep a draft on this device').uncheck(); await expect(page.locator('.device-save-bar')).toContainText('Export to keep your work');
  await page.reload(); await expect(page.locator('.demo-banner')).toBeVisible(); await expect(page.locator('.check-item').first()).not.toContainText('Persisted QA price');
});
test('keyboard-only evidence and form completion retains a visible focus and valid business result',async({page})=>{
  await start(page); await page.getByRole('button',{name:'New check',exact:true}).focus(); await page.keyboard.press('Enter');
  await page.getByText('Enter region bounds with keyboard',{exact:true}).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Apply region',exact:true}).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Use Atlas chair / 2023 (USD) / 119.00',exact:true}).focus(); await page.keyboard.press('Enter');
  await page.getByLabel(verification).focus(); await page.keyboard.press('Space');
  await page.getByRole('button',{name:'Save verified check',exact:true}).focus();
  const outline=await page.getByRole('button',{name:'Save verified check',exact:true}).evaluate(el=>getComputedStyle(el).outlineStyle); expect(outline).not.toBe('none');
  await shot(page,'keyboard-focus'); await page.keyboard.press('Enter'); await expect(page.locator('.check-item')).toHaveCount(4);
  await page.getByRole('button',{name:'Run comparison',exact:true}).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.comparison-summary')).toContainText('3 new regressions');
});
test('navigation and browser back do not discard saved facts inside the workspace',async({page})=>{
  await start(page); await page.getByRole('button',{name:'Source & checks'}).click(); await click(page,'Extraction outputs');
  await page.getByRole('button',{name:'Review results'}).click(); await expect(page.locator('.check-item')).toHaveCount(3);
  await page.getByRole('link',{name:'Proofwork',exact:true}).click(); await expect(page.locator('.check-item')).toHaveCount(3);
  // Views are in-memory tabs and do not create history entries. Back to a prior route requires a draft/export.
  await page.goto('./#qa-history'); await page.goBack(); await expect(page.locator('.check-item')).toHaveCount(3);
});
test('network outage displays actionable load error and retry recovers',async({page})=>{
  await page.route('**/northstar-demo.pdf',route=>route.abort('failed')); await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('Check your connection, then choose Try the synthetic demo to retry'); await expect(page.getByRole('button',{name:'Run comparison',exact:true})).toBeDisabled(); await shot(page,'network-error');
  await page.unroute('**/northstar-demo.pdf'); await click(page,'Try the synthetic demo');
  await expect(page.getByRole('button',{name:'Run comparison',exact:true})).toBeEnabled(); await click(page,'Run comparison');
  await expect(page.locator('.comparison-summary')).toContainText('2 new regressions');
});
for (const width of [1440,768,390,320]) test(`responsive ${width}px supports review, menus, authoring and no page overflow`,async({page})=>{
  await page.setViewportSize({width,height:900}); await start(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await shot(page,`review-${width}`);
  if(width<=650){await page.locator('.mobile-project-menu summary').click(); await expect(page.getByRole('button',{name:'Open project',exact:true})).toBeVisible(); await page.getByRole('button',{name:'Export project',exact:true}).click(); await expect(page.getByRole('dialog',{name:'Export project JSON'})).toBeVisible(); await click(page,'Close export');}
  await click(page,'New check'); await click(page,'Use Atlas chair / 2023 (USD) / 119.00'); await region(page); await page.getByLabel(verification).check(); await shot(page,`form-${width}`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await click(page,'Save verified check'); await click(page,'Run comparison'); await expect(page.locator('.check-item')).toHaveCount(4);
});

test('copy JSON really reaches clipboard and can be pasted into an input',async({page})=>{
  await start(page); await click(page,'Export project');
  const json=await page.getByRole('textbox',{name:'Project JSON'}).inputValue();
  await click(page,'Copy JSON'); await expect(page.getByRole('button',{name:'✓ JSON copied',exact:true})).toBeVisible();
  await click(page,'Close export'); await click(page,'Extraction outputs');
  const input=page.getByRole('textbox',{name:'Candidate extraction text'});
  await input.fill(''); await input.focus(); await page.keyboard.press('Control+V');
  await expect(input).toHaveValue(json); expect(JSON.parse(await input.inputValue()).contracts).toHaveLength(3);
});
test('clipboard rejection explains manual recovery inside the active modal',async({page})=>{
  await start(page); await click(page,'Export project');
  // Simulate a denied clipboard write, without altering project state or the native copy shortcut.
  await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new DOMException('Permission denied','NotAllowedError');};});
  const input=page.getByRole('textbox',{name:'Project JSON'}); const json=await input.inputValue();
  await click(page,'Copy JSON');
  await expect(page.getByRole('dialog',{name:'Export project JSON'}).getByRole('alert')).toContainText('Select and copy');
  await shot(page,'clipboard-denied'); await input.focus(); await page.keyboard.press('Control+C');
  await click(page,'Close export'); await click(page,'Extraction outputs');
  const target=page.getByRole('textbox',{name:'Candidate extraction text'});
  await target.fill(''); await target.focus(); await page.keyboard.press('Control+V'); await expect(target).toHaveValue(json);
});
test('blank expected fact is rejected by form validation and can be corrected',async({page})=>{
  await start(page); await click(page,'New check'); await region(page); await click(page,'Use Atlas chair / 2023 (USD) / 119.00');
  await page.getByLabel('Expected value',{exact:true}).fill(''); await page.getByLabel(verification).check(); await click(page,'Save verified check');
  await expect(page.locator('.check-item')).toHaveCount(0);
  const input=page.getByLabel('Expected value',{exact:true});
  expect(await input.evaluate((el: HTMLInputElement)=>el.validationMessage)).not.toBe('');
  await expect(input).toBeFocused(); await shot(page,'required-value');
  await input.fill('119.00'); await page.getByLabel(verification).check(); await click(page,'Save verified check');
  await click(page,'Run comparison'); await expect(page.locator('.check-item')).toHaveCount(4);
});
test('table and header selectors reset stale confirmation and save the selected table identity',async({page})=>{
  await start(page); await click(page,'Extraction outputs');
  await page.getByRole('textbox',{name:'Baseline extraction text'}).fill(baseline+'\n\nSecond table\n\n'+baseline);
  await page.getByRole('button',{name:'Source & checks'}).click(); await click(page,'New check'); await region(page);
  await click(page,'Use Atlas chair / 2023 (USD) / 119.00'); await page.getByLabel(verification).check();
  await page.getByRole('combobox',{name:'Table',exact:true}).selectOption('1'); await expect(page.getByLabel(verification)).not.toBeChecked();
  await click(page,'Use Atlas chair / 2024 (USD) / 125.60'); await page.getByLabel(verification).check();
  await page.getByRole('combobox',{name:'Header row',exact:true}).selectOption('1'); await expect(page.getByLabel(verification)).not.toBeChecked();
  await page.getByRole('combobox',{name:'Header row',exact:true}).selectOption('0');
  await click(page,'Use Atlas chair / 2024 (USD) / 125.60'); await page.getByLabel(verification).check(); await click(page,'Save verified check');
  const data=await exportJson(page); expect(data.contracts[3].tableIndex).toBe(1); expect(data.contracts[3].headerRow).toBe(0);
  await candidateText(page,baseline+'\n\nSecond table\n\n'+baseline); await expect(page.locator('.gate-summary')).toContainText('Saved checks passed');
});

test('slow initial PDF load disables actions and completes when the request resumes',async({page})=>{
  let release!:()=>void; const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/northstar-demo.pdf',async route=>{await gate; await route.continue();});
  await page.goto('./');
  await expect(page.getByRole('button',{name:'Run comparison',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Attach source PDF',exact:true}).first()).toBeDisabled();
  await expect(page.getByRole('status').filter({hasText:'Opening PDF'})).toBeVisible(); await shot(page,'loading');
  release(); await expect(page.getByRole('button',{name:'Run comparison',exact:true})).toBeEnabled();
  await click(page,'Run comparison'); await expect(page.locator('.comparison-summary')).toContainText('2 new regressions');
});
test('Tab stays inside export, Escape returns to confirmation and export-first preserves work',async({page})=>{
  await start(page); await click(page,'New project'); await click(page,'Export first');
  await expect(page.getByRole('dialog',{name:'Export project JSON'})).toBeVisible();
  await expect(page.locator('.check-item')).toHaveCount(3);
  for(let i=0;i<9;i++){await page.keyboard.press('Tab'); expect(await page.evaluate(()=>Boolean(document.activeElement?.closest('dialog[open]')))).toBe(true);}
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog',{name:'Export project JSON'})).toBeHidden();
  await expect(page.getByRole('dialog',{name:'Replace or remove work?'})).toBeVisible();
  await click(page,'Cancel'); await expect(page.getByRole('dialog')).toBeHidden();
  await click(page,'Run comparison'); await expect(page.locator('.comparison-summary')).toContainText('2 new regressions');
});
