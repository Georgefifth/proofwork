"""Restore only pinned public corpus files; verify SHA-256, never mutate oracle/manifest."""
import pathlib,json,urllib.request,hashlib,concurrent.futures
R=pathlib.Path(__file__).resolve().parent
items=json.loads((R/'manifest.json').read_text())+[json.loads((R/'TOOL-MANIFEST.json').read_text())]
def get(m):
 target=R/m.get('local',m.get('file'))
 if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==m['sha256']:return target.name+' verified cache'
 req=urllib.request.Request(m['url'],headers={'User-Agent':'Proofwork-validation-replay/1.0'})
 with urllib.request.urlopen(req,timeout=90) as response:data=response.read(60_000_001)
 if hashlib.sha256(data).hexdigest()!=m['sha256']:raise ValueError('Pinned checksum mismatch: '+m['url'])
 target.parent.mkdir(exist_ok=True,parents=True);target.write_bytes(data);return target.name+' restored'
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for message in pool.map(get,items):print(message)
(R/'reference').mkdir(exist_ok=True)
