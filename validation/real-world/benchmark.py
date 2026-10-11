"""Reviewed pure table-only adapter from pinned official olmOCR code. No model/scripts."""
import pathlib,json,ast,types,sys,time,re,unicodedata,dataclasses,enum,typing,hashlib
from rapidfuzz import fuzz
R=pathlib.Path(__file__).resolve().parent
# table_parsing.py contains only standard-library/BeautifulSoup imports and pure definitions.
p=R/'downloads/olmocr/table_parsing.py'; mod=types.ModuleType('reviewed_table_parser');sys.modules[mod.__name__]=mod
exec(compile(ast.parse(p.read_text()),str(p),'exec'),mod.__dict__)
# Exclude all file I/O, threading, math, model code and imports from upstream tests.py.
p=R/'downloads/olmocr/tests.py';names={'TestType','TestChecked','ValidationError','normalize_text','BasePDFTest','TableTest'}
tree=ast.parse(p.read_text()); tree.body=[n for n in tree.body if isinstance(n,(ast.ClassDef,ast.FunctionDef)) and n.name in names]
ns={**vars(typing),'re':re,'unicodedata':unicodedata,'Enum':enum.Enum,'dataclass':dataclasses.dataclass,'fuzz':fuzz,'parse_html_tables':mod.parse_html_tables,'parse_markdown_tables':mod.parse_markdown_tables}
exec(compile(tree,str(p),'exec'),ns)
manifest=json.loads((R/'manifest.json').read_text());oracle=json.loads((R/'oracle.json').read_text());own=json.loads((R/'runs/final/results.json').read_text());own['results']=[x for x in own['results'] if x['stratum']=='natural']+json.loads((R/'runs/supplement/results.json').read_text())['results'];byid={f['id']:f for f in oracle['facts']};rows=[]
for r in own['results']:
 f=byid.get(r['id']) or next((f for f in oracle['facts'] if r['id'].startswith(f['id']+'-')),None)
 if r['id']=='dln-corrected':
  f=dict(byid['dln-duplicate-columns']);f.update(json.loads((R/'ORACLE-ERRATUM.json').read_text())['correction'])
 p=R/next(m['local'] for m in manifest if m['document']==f['document'] and m['local'].endswith('.md')) if r['stratum'] in ['natural','oracle-correction'] else R/'runs/supplement'/(r['id']+'.candidate.md')
 text=p.read_text();t=time.perf_counter();test=ns['TableTest'](pdf=f['document']+'.pdf',page=f['page'],id=r['id'],type='table',cell=f['expected'],top_heading=f['valueColumn'],left_heading=f['rowLabel'],max_diffs=0)
 ok,reason=test.run(text);elapsed=(time.perf_counter()-t)*1000
 rows.append({'id':r['id'],'stratum':r['stratum'],'proofworkStatus':r['actual'],'officialTableTestPass':ok,'officialReason':reason,'officialEvalMs':round(elapsed,3),'naiveTextPresence':f['expected'] in text,'comparable':f['expectedCandidateStatus']=='pass' and not any(r['id'].endswith('-'+suffix) for suffix in ['duplicate-row','duplicate-header','script-as-data','reorder-columns']),'inputSha256':hashlib.sha256(text.encode()).hexdigest()})
hf=next(f for f in oracle['facts'] if f['id']=='small-headerless');hp=R/next(m['local'] for m in manifest if m['document']==hf['document'] and m['local'].endswith('.md'));special=ns['TableTest'](pdf='small_page_size.pdf',page=1,id='headerless-adjacency',type='table',cell='20',left='Fatty matter',max_diffs=0).run(hp.read_text())
out={'additionalCapabilityProbe':{'id':'headerless-adjacency','officialPass':special[0],'officialReason':special[1],'proofworkWorkflow':'BLOCKED: named columns cannot be declared for headerless native input','scope':'same source fact and native input, adapted relation semantics: no invented top header; qualitative capability comparison, outside fixed fact-score denominator'},'revision':next(m['revision'] for m in manifest if m.get('upstreamRepo')=='allenai/olmocr'),'method':'Exact max_diffs=0 official TableTest adapter, top_heading + left_heading, identical whole extraction Markdown. TableTest existence relationship semantics cannot express Proofwork strict uniqueness or table ordinal. No extractor execution, full published benchmark score, or wall-time speed comparison: CLI includes startup/hash vs TableTest eval-only.','results':rows}
(R/'runs/benchmark.json').write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
for row in rows:
 if row['stratum']=='natural':print(row['id'],row['proofworkStatus'],row['officialTableTestPass'],row['naiveTextPresence'])
