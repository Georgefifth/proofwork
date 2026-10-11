from pathlib import Path
import json,hashlib,subprocess,datetime
root=Path(__file__).resolve().parent
facts=[]
def add(id,doc,group,idx,page,rowcol,row,valcol,value,outcome,category,note='',bbox=None,header=0):
 if group=='docling':
  d=json.loads((root/'downloads'/group/(doc+'.json')).read_text());t=d['tables'][idx];p=d['pages'][str(page)]['size'];b=t['prov'][0]['bbox'];bbox={'x':b['l']/p['width'],'y':(p['height']-b['t'])/p['height'],'width':(b['r']-b['l'])/p['width'],'height':(b['t']-b['b'])/p['height']}
 facts.append(dict(id=id,document=doc,group=group,tableIndex=idx,page=page,headerRow=header,rowColumn=rowcol,rowLabel=row,valueColumn=valcol,expected=value,expectedCandidateStatus=outcome,category=category,sourceVerified=True,verifiedBy='Original rendered PDF independently read by evaluator; not product output',referenceImage=f'reference/{doc}-p{page}.png',rect=bbox or {'x':.05,'y':.1,'width':.9,'height':.75},note=note,holdout=doc in ['2305.03393v1','small_page_size']))
add('tf-tabula','2203.01017v2','docling',5,7,'Model','Tabula','Simple','78.0','pass','basic')
add('tf-repeated-model','2203.01017v2','docling',3,7,'Model','TableFormer','All','96.75','ambiguous','advanced','Model repeats for PTN, FTN, TB, STN; composite row key unsupported.')
add('dln-count','2206.01062','docling',0,4,'class label','Caption','Count','22524','pass','basic')
add('dln-multilevel','2206.01062','docling',0,4,'class label','Caption','% of Total - Train','2.04','pass','intermediate','Upstream flattens the two header levels into unique composite strings.')
add('dln-duplicate-columns','2206.01062','docling',3,7,'Class-count','Caption','11','68','ambiguous','advanced','Two header levels are required to distinguish 11/Doc from 11/Page; current single selected row cannot distinguish both.')
add('ibm-datatype','redp5110_sampled','docling',1,8,'Column name','FUNCTION_ID','Data type','VARCHAR(30)','pass','basic')
add('ibm-port','redp5110_sampled','docling',5,12,'Global variable','CLIENT_PORT','Type','INTEGER','pass','intermediate')
add('geo-area','elsevier-00','docling',0,7,'Evaluation elements','Dimension','G1 - Binga Waterfalls','Area','pass','intermediate')
add('geo-age','elsevier-00','docling',0,7,'Evaluation elements','Age','G4 - Cabeça da Baleia','Albian','pass','intermediate','Unicode accented column and long multilingual names.')
add('earn-2024','earnings','olmocr',0,1,'Year Ended','Research and development','Jan 28, 2024','2,532','pass','intermediate',bbox={'x':.12,'y':.72,'width':.78,'height':.17})
add('earn-missing-2025','earnings','olmocr',0,1,'Year Ended','Cost of revenue','Jan 26, 2025','178','fail','advanced','Natural upstream error: 2025 heading absent/replaced by 2023; UI cannot author missing header without correcting baseline.',bbox={'x':.12,'y':.72,'width':.78,'height':.17})
add('earn-duplicate-2023','earnings','olmocr',0,1,'Year Ended','Cost of revenue','Jan 29, 2023','$138','ambiguous','advanced','Natural upstream duplicated 2023 header. Original source is 138 with separate USD sign.',bbox={'x':.12,'y':.72,'width':.78,'height':.17})
add('discovery-malformed','discoverworld_crazy_table4','olmocr',0,1,'Task','Simplified Clustering','ReACT - Procedure','0.87','unsupported','advanced','Natural upstream Markdown has six header cells vs twelve body cells and inaccurate task labels.',bbox={'x':.1,'y':.15,'width':.8,'height':.41})
add('otsl-merged','2305.03393v1','docling',1,10,'Data set','PubTabNet','TEDs - simple','0.965','fail','advanced','Natural snapshot combines OTSL and HTML separate source rows into 0.965 0.969. Correct checker must reject expected one source value.')
add('small-headerless','small_page_size','olmocr',0,1,'Component','Fatty matter','Parts','20','fail','edge','Original historical table and upstream pipe rows have no header/separator. Current format cannot address this fact.',bbox={'x':.15,'y':.69,'width':.65,'height':.08})
for f in facts:
 p=root/'downloads'/f['group']/(f['document']+'.pdf');f['sourceSha256']=hashlib.sha256(p.read_bytes()).hexdigest()
 md=root/'downloads'/f['group']/(f['document']+'.md');f['inputSha256']=hashlib.sha256(md.read_bytes()).hexdigest()
(root/'oracle.json').write_text(json.dumps({'frozenAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'facts':facts,'negativeDocuments':['amt_handbook_sample','lincoln_letter','multi_column_miss','table_mislabeled_as_picture'],'externalSynthetic':['mathfuncs','table_misidentified_as_form']},indent=2,ensure_ascii=False)+'\n')
(root/'FROZEN.sha256').write_text('\n'.join(hashlib.sha256((root/f).read_bytes()).hexdigest()+'  '+f for f in ['PLAN.md','oracle.json','manifest.json'])+'\n')
print('Frozen',len(facts),'source-verified facts; holdout facts',sum(x['holdout'] for x in facts))
