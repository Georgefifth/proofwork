import { firefox, expect } from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';import { performance } from 'node:perf_hooks';
const root=path.dirname(new URL(import.meta.url).pathname),phase=process.argv[2],url=process.argv[3]||'http://127.0.0.1:5173/';
const out=path.join(root,'runs',phase+'-browser');fs.mkdirSync(out,{recursive:false});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))),oracle=JSON.parse(fs.readFileSync(path.join(root,'oracle.json')));
const file=(doc,ext)=>path.join(root,manifest.find(m=>m.document===doc&&m.local.endsWith(ext)).local);
const browser=await firefox.launch({headless:true});const results=[];
const click=(p,n)=>p.getByRole('button',{name:n,exact:true}).click();
async function upload(p,n,f){const chooser=p.waitForEvent('filechooser');await p.getByRole('button',{name:n,exact:true}).first().click();await(await chooser).setFiles(f);}
async function ready(p){await expect(p.locator('.render-status')).toBeHidden({timeout:60000});await expect(p.locator('canvas')).toBeVisible();await expect.poll(()=>p.locator('canvas').evaluate(c=>c.width)).toBeGreaterThan(0);await expect(p.locator('.render-error')).toHaveCount(0);}
async function go(p,n){if(await p.getByRole('spinbutton',{name:'Source page',exact:true}).count()){await p.getByRole('spinbutton',{name:'Source page',exact:true}).fill(String(n));await p.getByRole('spinbutton',{name:'Source page',exact:true}).press('Enter');}else{const current=Number((await p.locator('canvas').getAttribute('aria-label')).match(/(\d+)$/)[1]);for(let j=current;j!==n;j+=n>current?1:-1)await click(p,n>current?'Next page':'Previous page');}await expect(p.locator('canvas')).toHaveAttribute('aria-label',`Source PDF page ${n}`);await ready(p);}
for(const m of manifest.filter(m=>m.local?.endsWith('.pdf')&&(!process.env.DOCS||process.env.DOCS.split(',').includes(m.document)))){
 if(phase.startsWith('initial-live')&&oracle.facts.some(f=>f.document===m.document&&f.holdout))continue;
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),p=await context.newPage();p.setDefaultTimeout(12000); const errors=[],failedRequests=[],uploads=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));p.on('request',r=>{if(r.method()==='POST')uploads.push(r.url());});
 const record={document:m.document,url,stratum:m.provenanceStratum,expectedPages:null,source:'FAIL',navigation:'BLOCKED',authoring:'NOT_APPLICABLE',errors,failedRequests,uploads};
 try{
 await p.goto(url);record.assets=await p.locator('script[src],link[rel=stylesheet]').evaluateAll(nodes=>nodes.map(n=>n.src||n.href));await expect(p.getByRole('button',{name:'Run comparison',exact:true})).toBeEnabled({timeout:60000});await ready(p);await click(p,'New project');await click(p,'Continue');
 let start=performance.now();await upload(p,'Attach source PDF',file(m.document,'.pdf'));await expect(p.getByText('Source PDF attached. Your document stays in this browser.',{exact:true})).toBeVisible({timeout:60000});await ready(p);record.firstRenderMs=Math.round(performance.now()-start);record.source='PASS';
 const nav=await p.locator('.page-nav').innerText(),pages=Number(nav.match(/of\s+(\d+)/)[1]);record.expectedPages=pages;
 if(pages>50&&!(await p.getByRole('spinbutton',{name:'Source page',exact:true}).count())){record.navigation='BLOCKED';record.navigationReason=`Only next/previous controls: last page requires ${pages-1} clicks. Full traversal not executed.`;await go(p,3);}else{start=performance.now();await go(p,pages);record.lastPageMs=Math.round(performance.now()-start);record.navigation='PASS';}
 await p.screenshot({path:path.join(out,m.document+'-source.png'),fullPage:true});
 const f=oracle.facts.find(f=>f.document===m.document&&f.expectedCandidateStatus==='pass')||oracle.facts.find(f=>f.document===m.document);
 if(manifest.some(x=>x.document===m.document&&x.local.endsWith('.md'))){await click(p,'Extraction outputs');for(const name of ['Baseline','Candidate']){const card=p.locator('.output-card').filter({has:p.getByRole('heading',{name,exact:true})});const chooser=p.waitForEvent('filechooser');await card.getByRole('button',{name:'Upload file',exact:true}).click();await(await chooser).setFiles(file(m.document,'.md'));}record.tableInventory=await p.locator('.output-card').first().innerText();}
 if(f){await p.getByRole('button',{name:/^Source & checks/}).click();await go(p,f.page);await click(p,'New check');
 if(await p.getByText('Add a baseline extraction with a supported table in Extraction outputs first.',{exact:true}).count()){record.authoring='BLOCKED';record.authoringReason='No supported table detected from unmodified upstream output.';await p.screenshot({path:path.join(out,m.document+'-authoring.png'),fullPage:true});}
 else{
 await p.getByRole('combobox',{name:'Table',exact:true}).selectOption(String(f.tableIndex));
 if(!(await p.getByRole('combobox',{name:'Row label column',exact:true}).locator('option').allTextContents()).includes(f.rowColumn)||!(await p.getByRole('combobox',{name:'Value column',exact:true}).locator('option').allTextContents()).includes(f.valueColumn)){record.authoring='BLOCKED';record.authoringReason='Required source header is unavailable in native output selector.';}
 else{
 await p.getByText('Enter region bounds with keyboard',{exact:true}).click();for(const [n,v] of [['Left %',f.rect.x],['Top %',f.rect.y],['width %',f.rect.width],['height %',f.rect.height]])await p.getByLabel(n,{exact:true}).fill(String(Math.round(v*1000)/10));await click(p,'Apply region');await p.getByRole('combobox',{name:'Row label column',exact:true}).selectOption(f.rowColumn);await p.getByLabel('Row label',{exact:true}).fill(f.rowLabel);await p.getByRole('combobox',{name:'Value column',exact:true}).selectOption(f.valueColumn);await p.getByLabel('Expected value',{exact:true}).fill(f.expected);await p.getByLabel('I verified the row, column and value in the original PDF.',{exact:true}).check();await click(p,'Save verified check');await click(p,'Run comparison');
 await expect(p.locator('.check-item')).toHaveCount(1);const body=await p.locator('.detail-panel').innerText();record.resultText=body;record.authoring='PASS';record.expectedFactStatus=f.expectedCandidateStatus;
 if(f.expectedCandidateStatus==='pass')await expect(p.locator('.gate-summary')).toContainText('passed');else await expect(p.locator('.gate-summary')).toContainText('Candidate needs attention');
 await click(p,'Export project');const json=JSON.parse(await p.getByRole('textbox',{name:'Project JSON'}).inputValue());expect(json.contracts[0].expected).toBe(f.expected);expect(json.source.hash).toBe(f.sourceSha256);expect(json.contracts[0].evidence.page).toBe(f.page);await click(p,'Close export');record.export='PASS';}
 await p.screenshot({path:path.join(out,m.document+'-authoring.png'),fullPage:true});}
 }
 expect(uploads).toHaveLength(0);expect(errors).toHaveLength(0);expect(failedRequests).toHaveLength(0);
 }catch(e){record.exception=e.message;record.test='FAIL';await p.screenshot({path:path.join(out,m.document+'-failure.png'),fullPage:true}).catch(()=>{});}
 results.push(record);console.log(m.document,record.source,record.navigation,record.authoring,record.exception||'');await context.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({phase,url,browser:'headless Firefox',results},null,2));
}
await browser.close();
