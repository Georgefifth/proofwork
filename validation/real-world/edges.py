import pathlib,json,re,subprocess,time,hashlib
R=pathlib.Path(__file__).resolve().parent;out=R/'runs/edges';out.mkdir(exist_ok=False);p=json.loads((R/'runs/initial/tf-tabula.project.json').read_text());raw=p['baseline']['text'];lines=raw.splitlines();tables=[]
for i in range(1,len(lines)):
 c=lines[i].strip().strip('|').split('|')
 if len(c)>1 and all(re.fullmatch(r'\s*:?-+:?\s*',v) for v in c):
  j=i+1
  while j<len(lines) and '|' in lines[j] and lines[j].strip():j+=1
  tables.append((i-1,j))
a,b=tables[0];c,d=tables[5];reordered='\n'.join(lines[:a]+lines[c:d]+lines[b:c]+lines[a:b]+lines[d:]);cases=[('table-order-changed',reordered,1,'fail'),('empty-candidate','',1,'fail'),('oversized-extraction',(raw*100)[:5_000_001],2,'error')];results=[]
(out/'FROZEN.json').write_text(json.dumps({'recordedBeforeExecution':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'cases':[{'id':name,'expectedExit':code,'expected':status,'candidateSha256':hashlib.sha256(text.encode()).hexdigest()} for name,text,code,status in cases]},indent=2)+'\n')
for name,text,code,status in cases:
 f=out/(name+'.md');f.write_text(text);t=time.perf_counter();proc=subprocess.run(['node','--import','tsx','cli/check.ts',str(R/'runs/initial/tf-tabula.project.json'),'--candidate',str(f),'--pdf',str(R/'downloads/docling/2203.01017v2.pdf'),'--json'],cwd=R.parent.parent,capture_output=True,text=True);(out/(name+'.stdout.json')).write_text(proc.stdout);(out/(name+'.stderr.txt')).write_text(proc.stderr);actual=json.loads(proc.stdout)['results'][0]['candidate']['status'] if proc.stdout.startswith('{') else 'error';results.append({'id':name,'expected':status,'actual':actual,'exit':proc.returncode,'expectedExit':code,'wallMs':round((time.perf_counter()-t)*1000,2),'verdict':'PASS' if actual==status and code==proc.returncode else 'FAIL','scope':'documented table-ordinal limitation' if name.startswith('table-order') else 'real-derived edge supplement','reason':proc.stderr or json.loads(proc.stdout)['results'][0]['candidate']['reason']})
(out/'results.json').write_text(json.dumps({'results':results},indent=2)+'\n');print(results)
