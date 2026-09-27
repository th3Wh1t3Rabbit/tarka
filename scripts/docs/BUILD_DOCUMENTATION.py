#!/usr/bin/env python3
"""Build the public searchable documentation site from README.md and docs/."""
from pathlib import Path
from urllib.parse import urlsplit,unquote
from markdown_it import MarkdownIt
import json,re,html,posixpath,shutil,sys,hashlib,base64,mimetypes
ROOT=Path(__file__).resolve().parents[2];G=ROOT;release=True
md=MarkdownIt('commonmark',{'html':True}).enable('table')
nav=json.loads((ROOT/'scripts/docs/navigation.json').read_text())
def slug(s):
 s=re.sub(r'<[^>]+>','',s).lower();s=re.sub(r'[^\w\-\s]','',s);return re.sub(r'\s','-',s)
def routepath(p):return 'index.html' if p=='README.md' else str(Path(p).with_suffix('.html'))
def target(key,href):
 u=urlsplit(href)
 if u.scheme or u.netloc:return None
 p=posixpath.normpath(posixpath.join(posixpath.dirname(key),unquote(u.path))) if u.path else key
 return p,unquote(u.fragment)
def render(key,text):
 toks=md.parse(text);seen={};toc=[]
 def recurse(xs):
  for t in xs:
   if t.type=='link_open':
    h=t.attrGet('href');v=target(key,h)
    if v:
     p,anchor=v
     if p.endswith('.md') and (p=='README.md' or p.startswith('docs/')):
      t.attrSet('data-doc',p);t.attrSet('data-anchor',anchor)
      t.attrSet('href',posixpath.relpath(routepath(p),posixpath.dirname(routepath(key)) or '.')+('#'+anchor if anchor else ''))
     elif (G/p).is_file():
      if p.startswith('docs/'):
       if Path(p).suffix.lower() in ['.png','.jpg','.jpeg','.webp']:t.attrSet('data-image-link',p)
       else:t.attrSet('data-asset',p)
      else:
       t.attrSet('href','https://github.com/th3Wh1t3Rabbit/tarka/blob/main/'+p)
       t.attrSet('data-repository-asset',p)
   if t.type=='image':
    v=target(key,t.attrGet('src'))
    if v and (G/v[0]).is_file():
     t.attrSet('data-image',v[0]);t.attrSet('loading','lazy');t.attrSet('decoding','async')
   if t.children:recurse(t.children)
 recurse(toks)
 for i,t in enumerate(toks):
  if t.type=='heading_open':
   title=toks[i+1].content;k=slug(title);n=seen.get(k,0);seen[k]=n+1;k=k+(f'-{n}'if n else'');t.attrSet('id',k)
   if t.tag in ['h2','h3']:toc.append({'id':k,'title':title,'level':int(t.tag[1])})
 out=md.renderer.render(toks,md.options,{})
 out=re.sub(r'<p><em>(Terminal reference ·.*?)</em></p>',r'<p class="figure-caption"><em>\1</em></p>',out,flags=re.S)
 return out,toc
P={}
markdown_files=[G/'README.md',*sorted((G/'docs').rglob('*.md'))]
for p in markdown_files:
 k=p.relative_to(G).as_posix();text=p.read_text();r,toc=render(k,text)
 P[k]={'title':next((l[2:]for l in text.splitlines()if l.startswith('# ')),p.stem),'html':r,'text':text,'toc':toc,'spoiler':k.startswith('docs/spoilers/')or k.startswith('docs/script/')or k.startswith('docs/data/requests/')or k in ['docs/data/request-log.md','docs/data/records.md']}
asset_files=[*sorted((G/'docs/data').rglob('*')),*sorted((G/'docs/script').glob('*.json'))]
assets={p.relative_to(G).as_posix():p.read_text()for p in asset_files if p.is_file()and p.suffix in ['.json','.csv']}
imageData={p.relative_to(G).as_posix():'data:'+mimetypes.guess_type(p.name)[0]+';base64,'+base64.b64encode(p.read_bytes()).decode() for p in sorted((G/'docs').rglob('*')) if p.is_file() and p.suffix.lower() in ['.png','.jpg','.jpeg','.webp']}
scriptCoverage=json.loads((G/'docs/script/SCRIPT_EXPLORER_COVERAGE.json').read_text())
data={'pages':P,'assets':assets,'atlas':json.loads((G/'docs/data/requests.json').read_text()),'scriptCoverage':scriptCoverage,'nav':nav,'readingOrder':json.loads((ROOT/'scripts/docs/reading-order.json').read_text()),'version':'1.0.0'}
def encode(d):return json.dumps(d,ensure_ascii=False,separators=(',',':')).replace('<',r'\u003c').replace('>',r'\u003e').replace('&',r'\u0026')
payload=encode(data)
inlinePayload=encode({**data,'imageData':imageData})
css=(ROOT/'scripts/docs/site.css').read_text();app=(ROOT/'scripts/docs/site.js').read_text()
L=json.loads((ROOT/'scripts/docs/release-links.json').read_text())['links']
def chrome(key,inline):
 pref=posixpath.relpath('.',posixpath.dirname(routepath(key)) or '.')+'/'
 links=''.join(f'<a href="{html.escape(L[k]["url"],quote=True)}">{label}</a>'for k,label in [('play','Play'),('downloads','Download'),('repository','GitHub'),('documentation','Docs')])
 navigation=''.join(f'<section class="navgroup"><h2>{html.escape(group)}</h2>'+''.join(f'<a data-doc="{p}" href="'+((pref+'docs/data/request-log.html')if p=='@calls'else(pref+routepath(p)))+f'">{html.escape(label)}</a>'for p,label in rows)+'</section>'for group,rows in nav)
 body=P[key]['html'];title=html.escape(P[key]['title'])
 return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">{''if release else'<meta name="robots" content="noindex,nofollow">'}<title>{title} · Tarka</title>{'<style>'+css+'</style>'if inline else'<link rel="stylesheet" href="'+pref+'assets/site.css">'}</head><body data-start="{key}" data-base="{pref}" data-inline="{str(inline).lower()}"><aside id="rail"><div class="brand">TARKA</div><div class="subbrand">A case worth following</div><div class="toplinks">{links}</div><label for="search" class="subbrand" style="display:block;margin-bottom:7px">Search documentation</label><input id="search" class="search" type="search" placeholder="Topics, questions, tokens…"><label class="search-options"><input type="checkbox" id="spoilerSearch">Include evidence / spoilers</label><button id="menu">CONTENTS</button><nav id="nav" aria-label="Documentation">{navigation}</nav></aside><main>{''if release else'<div class="draftbar"><b>REVIEW DRAFT</b>Terminal-reference figures are included. Final links, production parity and release checks remain open. Not published.</div>'}<div class="toolbar"><span id="crumb" class="crumb">{title}</span><button id="downloadMd" class="quiet-button">Save Markdown</button></div><div class="docgrid"><article id="article" tabindex="-1">{body}</article><nav id="toc" class="toc" aria-label="On this page"></nav></div></main>{'<script id="data" type="application/json">'+inlinePayload+'</script><script>'+app+'</script>'if inline else'<script src="'+pref+'assets/library.js"></script><script src="'+pref+'assets/site.js"></script>'}</body></html>'''
site=ROOT/'docs-site'
if site.exists():shutil.rmtree(site)
(site/'assets').mkdir(parents=True)
(site/'assets/site.css').write_text(css);(site/'assets/site.js').write_text(app);(site/'assets/library.js').write_text('window.__TARKA_LIBRARY='+payload+';\n')
for k in P:
 f=site/routepath(k);f.parent.mkdir(parents=True,exist_ok=True);f.write_text(chrome(k,False))
for k in imageData:
 f=site/k;f.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(G/k,f)
for k,v in assets.items():
 f=site/k;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(v)
(site/'.nojekyll').write_text('');(site/'robots.txt').write_text('User-agent: *\nAllow: /\n')
(site/'404.html').write_text('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found · Tarka</title><link rel="stylesheet" href="/assets/site.css"></head><body><main style="max-width:760px;margin:10vh auto;padding:24px"><article><h1>Page not found</h1><p>That documentation page does not exist.</p><p><a href="/">Return to the documentation library</a></p></article></main></body></html>''')
(site/'build-manifest.json').write_text(json.dumps({'version':'1.0.0','pages':len(P),'request_pages':sum(1 for k in P if k.startswith('docs/data/requests/RQ-')),'compiled_records':len(json.loads((G/'docs/data/records.json').read_text())),'script_explorer_result':scriptCoverage['result'],'script_explorer_routes':scriptCoverage['sourceTotals']['runtimeTranscriptRoutes'],'script_explorer_deliveries':scriptCoverage['sourceTotals']['runtimeTranscriptDeliveries'],'script_explorer_unexplained_omissions':len(scriptCoverage['invariants']['unexplainedOmissions']),'markdown_sha256':{k:hashlib.sha256((G/k).read_bytes()).hexdigest()for k in P},'single_source':True,'spoiler_search_default':False,'image_count':len(imageData),'static_image_bytes':sum((G/k).stat().st_size for k in imageData)},indent=2)+'\n')
print('PASS_BUILD_DOCUMENTATION',len(P),'pages',site.name)
