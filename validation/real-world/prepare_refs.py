from pathlib import Path
import json,subprocess,hashlib
root=Path(__file__).resolve().parent
render=[('docling','2203.01017v2',7),('docling','2206.01062',4),('docling','2206.01062',7),('docling','redp5110_sampled',8),('docling','redp5110_sampled',12),('docling','elsevier-00',7),('docling','elsevier-00',11),('docling','2305.03393v1',9),('docling','2305.03393v1',10),('olmocr','earnings',1),('olmocr','discoverworld_crazy_table4',1),('olmocr','small_page_size',1),('docling','amt_handbook_sample',1),('docling','table_misidentified_as_form',1),('docling','table_mislabeled_as_picture',1)]
for group,n,page in render:
 p=root/'downloads'/group/(n+'.pdf');out=root/'reference'/(n+'-p'+str(page))
 subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-singlefile','-scale-to','1600','-png',str(p),str(out)],check=True,capture_output=True,timeout=45)
 print(out.name,flush=True)
