"""Predefined derived mutations of external outputs. Kept separate from natural corpus."""
import runpy,sys,pathlib,json,re,copy,hashlib,subprocess,time
# Reuse public CLI runner helpers without executing its top-level loop.
R=pathlib.Path(__file__).resolve().parent; APP=R.parent.parent
out=R/'runs/supplement';out.mkdir(exist_ok=False)
manifest=json.loads((R/'manifest.json').read_text());facts=json.loads((R/'oracle.json').read_text())['facts']
def path(doc,ext):return R/next(m['local'] for m in manifest if m['document']==doc and m['local'].endswith(ext))
def execute(f,original,candidate,case,expected):
 info=subprocess.check_output(['pdfinfo',str(path(f['document'],'.pdf'))],text=True);pages=int(next(s.split(':')[1] for s in info.splitlines() if s.startswith('Pages:')))
 p={'version':1,'name':f['document'],'source':{'name':f['document']+'.pdf','hash':f['sourceSha256'],'pages':pages},'baseline':{'name':'native.md','format':'markdown','text':original},'candidate':{'name':'candidate.md','format':'markdown','text':candidate},'contracts':[{'id':f['id'],'title':f['rowLabel'],'tableIndex':f['tableIndex'],'headerRow':0,'rowColumn':f['rowColumn'],'rowLabel':f['rowLabel'],'valueColumn':f['valueColumn'],'expected':f['expected'],'evidence':{'page':f['page'],'rect':f['rect'],'sourceHash':f['sourceSha256']}}]};pf=out/(case+'.project.json');pf.write_text(json.dumps(p,ensure_ascii=False));(out/(case+'.candidate.md')).write_text(candidate);rss=out/(case+'.rss.txt');t=time.perf_counter()
 proc=subprocess.run(['/usr/bin/time','-f','%M','-o',str(rss),'node','--import','tsx','cli/check.ts',str(pf),'--pdf',str(path(f['document'],'.pdf')),'--json'],cwd=APP,capture_output=True,text=True);ms=(time.perf_counter()-t)*1000;(out/(case+'.stdout.json')).write_text(proc.stdout);(out/(case+'.stderr.txt')).write_text(proc.stderr);v=json.loads(proc.stdout)['results'][0]
 return {'id':case,'document':f['document'],'stratum':'oracle-correction' if case=='dln-corrected' else 'real-derived-supplement','expected':expected,'actual':v['candidate']['status'],'baselineStatus':v['baseline']['status'],'change':v['change'],'reason':v['candidate']['reason'],'verdict':'PASS' if v['candidate']['status']==expected else 'FAIL','exit':proc.returncode,'wallMs':round(ms,2),'peakRssKiB':int(rss.read_text().strip().splitlines()[-1]),'candidateSha256':hashlib.sha256(candidate.encode()).hexdigest()}
results=[]; inventory=[]
# Freeze concrete candidate hashes BEFORE invoking product on the supplement.
for f in facts:
 if f['expectedCandidateStatus']!='pass':continue
 raw=path(f['document'],'.md').read_text();lines=raw.splitlines();tables=[]
 for i in range(1,len(lines)):
  cells=lines[i].strip().strip('|').split('|')
  if len(cells)>1 and all(re.fullmatch(r'\s*:?-+:?\s*',c) for c in cells):
   end=i+1
   while end<len(lines) and '|' in lines[end] and lines[end].strip():end+=1
   tables.append((i-1,end))
 start,end=tables[f['tableIndex']];grid=[l.strip().strip('|').split('|') for l in lines[start:end]];headers=[c.strip() for c in grid[0]];vc=headers.index(f['valueColumn']);rc=headers.index(f['rowColumn']);ri=next(i for i,row in enumerate(grid[2:],2) if row[rc].strip()==f['rowLabel'])
 def mutate(g):return '\n'.join(lines[:start]+['|'+'|'.join(row)+'|' for row in g]+lines[end:])
 cases=[]
 for kind,replacement in [('changed',f['expected']+'X'),('precision',f['expected']+'0'),('sign','-'+f['expected']),('unit',f['expected']+' USD')]:
  g=copy.deepcopy(grid);g[ri][vc]=replacement;cases.append((kind,mutate(g),'fail'))
 g=copy.deepcopy(grid);del g[ri];cases.append(('deleted-row',mutate(g),'fail'))
 g=copy.deepcopy(grid);g.insert(ri,list(g[ri]));cases.append(('duplicate-row',mutate(g),'ambiguous'))
 g=copy.deepcopy(grid);other=next(c for c in range(len(headers)) if c not in [vc,rc]);g[0][other]=g[0][vc];cases.append(('duplicate-header',mutate(g),'ambiguous'))
 g=copy.deepcopy(grid);g[ri][other],g[ri][vc]=g[ri][vc],g[ri][other];cases.append(('wrong-column',mutate(g),'fail'))
 cases.append(('reorder-columns',mutate([list(reversed(row)) for row in grid]),'pass'))
 g=copy.deepcopy(grid);g[ri][vc]=' '+g[ri][vc]+'  ';cases.append(('whitespace',mutate(g),'pass'))
 g=copy.deepcopy(grid);g[ri][vc]+='<script>throw new Error("injected")</script>';cases.append(('script-as-data',mutate(g),'pass'))
 for kind,candidate,expected in cases:inventory.append((f,raw,candidate,f['id']+'-'+kind,expected))
(out/'FROZEN.json').write_text(json.dumps({'recordedBeforeExecution':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'cases':[{'id':x[3],'expected':x[4],'sha256':hashlib.sha256(x[2].encode()).hexdigest()} for x in inventory]},indent=2)+'\n')
for x in inventory:results.append(execute(*x))
f=copy.deepcopy(next(f for f in facts if f['id']=='dln-duplicate-columns'));f.update(json.loads((R/'ORACLE-ERRATUM.json').read_text())['correction']);raw=path(f['document'],'.md').read_text();results.append(execute(f,raw,raw,'dln-corrected','pass'))
(out/'results.json').write_text(json.dumps({'results':results,'counts':{v:sum(r['verdict']==v for r in results) for v in ['PASS','FAIL','BLOCKED','INCONCLUSIVE']}},indent=2)+'\n');print(json.dumps(json.loads((out/'results.json').read_text())['counts']));print([(r['id'],r['actual'],r['reason']) for r in results if r['verdict']=='FAIL'])
