"""Execute normal public CLI; oracle remains evaluator-only. Never overwrite a run."""
import json,pathlib,hashlib,subprocess,time,sys,platform,statistics
ROOT=pathlib.Path(__file__).resolve().parent; APP=ROOT.parent.parent
phase=sys.argv[1]; out=ROOT/'runs'/phase
out.mkdir(parents=True,exist_ok=False)
manifest=json.loads((ROOT/'manifest.json').read_text()); oracle=json.loads((ROOT/'oracle.json').read_text())
def path(doc,ext):return ROOT/next(x['local'] for x in manifest if x['document']==doc and x['local'].endswith(ext))
def project(f,text):
 pdf=path(f['document'],'.pdf'); info=subprocess.check_output(['pdfinfo',str(pdf)],text=True);pages=int(next(s.split(':')[1] for s in info.splitlines() if s.startswith('Pages:')))
 return {'version':1,'name':f['document'],'source':{'name':pdf.name,'hash':f['sourceSha256'],'pages':pages},'baseline':{'name':f['document']+'.md','format':'markdown','text':text},'candidate':{'name':f['document']+'.md','format':'markdown','text':text},'contracts':[{'id':f['id'],'title':f['rowLabel']+' / '+f['valueColumn'],'tableIndex':f['tableIndex'],'headerRow':f['headerRow'],'rowColumn':f['rowColumn'],'rowLabel':f['rowLabel'],'valueColumn':f['valueColumn'],'expected':f['expected'],'evidence':{'page':f['page'],'sourceHash':f['sourceSha256'],'rect':f['rect']}}]}
def run(f,text,case,expected):
 p=project(f,text); pf=out/(case+'.project.json');pf.write_text(json.dumps(p,ensure_ascii=False)); rss=out/(case+'.resource.txt');t=time.perf_counter()
 proc=subprocess.run(['/usr/bin/time','-f','%M','-o',str(rss),'node','--import','tsx','cli/check.ts',str(pf),'--candidate',str(path(f['document'],'.md')) if case==f['id'] else str(out/(case+'.candidate.md')),'--pdf',str(path(f['document'],'.pdf')),'--json'],cwd=APP,capture_output=True,text=True)
 duration=time.perf_counter()-t;(out/(case+'.stdout.json')).write_text(proc.stdout);(out/(case+'.stderr.txt')).write_text(proc.stderr)
 data=json.loads(proc.stdout) if proc.stdout.startswith('{') else {};result=(data.get('results') or [{}])[0].get('candidate',{})
 peak=int(rss.read_text().strip().splitlines()[-1]); return {'id':case,'document':f['document'],'holdout':f['holdout'],'stratum':'natural' if case==f['id'] else 'real-derived-fault','expected':expected,'actual':result.get('status','error'),'actualValue':result.get('actual'),'reason':result.get('reason',proc.stderr),'exit':proc.returncode,'wallMs':round(duration*1000,2),'peakRssKiB':peak,'verdict':'PASS' if result.get('status')==expected else 'FAIL','inputSha256':hashlib.sha256(text.encode()).hexdigest()}
results=[]
for f in oracle['facts']:
 if phase=='initial' and f['holdout']:continue
 text=path(f['document'],'.md').read_text(); assert hashlib.sha256(text.encode()).hexdigest()==f['inputSha256']; assert hashlib.sha256(path(f['document'],'.pdf').read_bytes()).hexdigest()==f['sourceSha256']
 results.append(run(f,text,f['id'],f['expectedCandidateStatus']))
 # Deterministic, pre-registered mutations: target value changed everywhere, removal of row, precision/sign changes.
 if phase!='initial' and f['expectedCandidateStatus']=='pass':
  for kind,replacement in [('changed',f['expected']+'X'),('precision',f['expected']+'0'),('sign','-'+f['expected'])]:
   mutant=text.replace(f['expected'],replacement);case=f['id']+'-'+kind;(out/(case+'.candidate.md')).write_text(mutant);results.append(run(f,mutant,case,'fail'))
  mutant='\n'.join(line for line in text.split('\n') if not ('|' in line and f['rowLabel'] in line));case=f['id']+'-deleted-row';(out/(case+'.candidate.md')).write_text(mutant);results.append(run(f,mutant,case,'fail'))
summary={'phase':phase,'recordedAtUtc':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'environment':{'os':platform.platform(),'node':subprocess.check_output(['node','-v'],text=True).strip()},'results':results,'counts':{s:sum(r['verdict']==s for r in results) for s in ['PASS','FAIL','BLOCKED','INCONCLUSIVE']},'scope':'CLI exact fact checking; expected source facts verified on PDF independently; mutation stratum is synthetic derived, not natural errors.'}
(out/'results.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n'); print(json.dumps(summary['counts']));print([(r['id'],r['actual'],r['reason']) for r in results if r['verdict']=='FAIL'])
