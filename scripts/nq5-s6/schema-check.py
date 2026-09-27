import json,pathlib,jsonschema
r=pathlib.Path('artifacts/g6p-s6/REPORTS')
s=json.loads((r/'FUTURE_ARCHIVE_ENVELOPE.schema.json').read_text())
jsonschema.Draft202012Validator.check_schema(s)
v=jsonschema.Draft202012Validator(s)
ok={'schemaVersion':'1.0.0','indexPath':'ART_INDEX.json','manifestPath':'MANIFEST.sha256','members':[{'path':'TEST.png','bytes':1,'sha256':'a'*64,'purpose':'PNG'}],'externalApprovalReferences':[],'licenseReferences':[]}
v.validate(ok)
for name,change in [('extra',lambda x:x.update(extra=True)),('path',lambda x:x['members'][0].update(path='../TEST.png')),('missing',lambda x:x.pop('manifestPath')),('approval-forgery',lambda x:x.update(PrincipalApproved=True)),('bad-hash',lambda x:x['members'][0].update(sha256='x'))]:
    x=json.loads(json.dumps(ok));change(x)
    assert list(v.iter_errors(x)),name
print(json.dumps({'status':'PASS','closedSchema':'FUTURE_ARCHIVE_ENVELOPE@1.0.0','syntheticNonproductionExample':True,'schemaTamperRejections':5,'actualArchiveValidated':False,'approvalGranted':False}))
