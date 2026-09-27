import copy,json,pathlib,jsonschema
r=pathlib.Path('artifacts/g6p-s5')
s=r/'SCHEMAS';s.mkdir(parents=True,exist_ok=True)
read=lambda n:json.loads((r/'REPORTS'/n).read_text())
def closed(properties):
 return {'type':'object','properties':properties,'required':list(properties),'additionalProperties':False}
string={'type':'string','minLength':1}
identifier={'type':'string','pattern':r'^[A-Za-z][A-Za-z0-9_.-]{0,127}$'}
sha={'type':'string','pattern':'^[a-f0-9]{64}$'}
integer={'type':'integer','minimum':0}
boolean={'type':'boolean'}
nullable_id={'anyOf':[identifier,{'type':'null'}]}
array=lambda item:{'type':'array','items':item}
point=closed({'x':integer,'y':integer})
bounds=closed({'x':integer,'y':integer,'width':{'type':'integer','minimum':1},'height':{'type':'integer','minimum':1}})
asset=closed(dict(id=identifier,path={'type':'string','pattern':r'^(?!/)(?!.*(?:^|/)\.\.(?:/|$))[A-Za-z0-9_./-]+\.png$'},sha256=sha,version=string,kind={'enum':['ACTOR','PROP','ROOM','TERMINAL']},width={'type':'integer','minimum':1,'maximum':1920},height={'type':'integer','minimum':1,'maximum':1080},channels={'const':'RGBA'},exclusiveFootBaseline={'anyOf':[integer,{'type':'null'}]},anchor=point,transparentBounds=bounds,paletteId=identifier,materialShadingId=identifier,provenance=string,license=string,previewEvidence={**array(identifier),'minItems':1,'uniqueItems':True},approvalReceiptId=nullable_id,derivativeOf=nullable_id,bakedText={'const':False},bakedEvidence={'const':False}))
asset['allOf']=[{'if':{'properties':{'kind':{'const':'ACTOR'}}},'then':{'properties':{'width':{'const':48},'height':{'const':88},'exclusiveFootBaseline':{'const':84},'anchor':{'properties':{'y':{'const':84}}}}}}]
frame=closed({'order':integer,'assetId':identifier,'durationMs':{'type':'integer','minimum':1,'maximum':60000},'hold':boolean})
contact=closed({'frame':integer,'propId':identifier,'actorAnchor':point,'propAnchor':point,'evidenceId':identifier})
ownership=closed({'frame':integer,'propId':identifier,'from':identifier,'to':identifier})
clip=closed(dict(id=identifier,version=string,sha256=sha,frames={**array(frame),'minItems':1},loop=boolean,cancellation={'enum':['IMMEDIATE','AT_FRAME_BOUNDARY','FINISH_REQUIRED_CONTACT']},entrance=identifier,exit=identifier,facing={'enum':['FRONT','LEFT','RIGHT','BACK']},mirrorAllowed=boolean,staticFallback=identifier,contacts=array(contact),ownershipEvents=array(ownership),frontHandOcclusion={'enum':['NONE','FRONT_HAND','PROP_FRONT','LAYER_SPLIT']},paletteId=identifier,materialShadingId=identifier,approvalReceiptId=nullable_id))
cap=closed(dict(id=identifier,required=boolean,clipIds={**array(identifier),'uniqueItems':True},staticAssetId=identifier,semanticFallback=string,contentIdentity=sha))
approval=closed(dict(id=identifier,assetOrClipId=identifier,version=string,sha256=sha,status={'const':'USER_APPROVED_EXACT_VERSION'},authority={'const':'PRINCIPAL'}))
intake=closed(dict(schemaVersion={'const':'1.0.0'},archiveId=identifier,version=string,manifestAuthority={'const':'AUTHORITATIVE_INDEX'},assets={**array(asset),'minItems':1},clips=array(clip),capabilities=array(cap),approvalReceipts=array(approval)))
schemas={'VIEWPORT_TERMINAL_CONTRACT.json':{'type':'object','const':read('VIEWPORT_TERMINAL_CONTRACT.json')},'SYNTHETIC_INTAKE_EXAMPLE.json':intake}
for n,schema in schemas.items():
 schema={'$schema':'https://json-schema.org/draft/2020-12/schema',**schema}
 (s/(n+'.schema.json')).write_text(json.dumps(schema,indent=2)+'\n')
 v=jsonschema.Draft202012Validator(schema);v.validate(read(n));bad=copy.deepcopy(read(n));bad['UNDECLARED_FIELD']='SYNTHETIC'
 assert list(v.iter_errors(bad))
print(json.dumps({'status':'PASS','schemas':2,'closedExtraFieldRejections':2,'pixelExample':'SYNTHETIC_METADATA_ONLY','semanticCrossChecks':'S5 pure validator + exact local replay required; schema alone is not approval'}))
