import copy,json
from pathlib import Path
import jsonschema
r=Path('artifacts/g6p-s2-r1')
s=json.loads((r/'SCHEMAS/MERIDIAN_ACTIVITY_INPUT.schema.json').read_text())
sample=json.loads((r/'INPUTS/PRINCIPAL_SAMPLE_TRANSFORMED.json').read_text())
cpp=json.loads((r/'INPUTS/CPP_SAFE_TRANSFORMED_INPUT.json').read_text())
cases=[]
def changed(name,x,edit):
 q=copy.deepcopy(x);edit(q);cases.append((name,q))
changed('logical row classified provider',cpp,lambda q:q['rows'][0].update(measurement_class='PROVIDER_REQUEST_ROW'))
changed('logical unknown credits zero-imputed',cpp,lambda q:q['rows'][0].update(displayed_credits=0))
changed('ledger class classified provider',sample,lambda q:q.update(source_class='PROJECT_LEDGER_SUMMARY'))
changed('missing exact measurement',sample,lambda q:q.pop('measurement_class'))
changed('negative displayed credits',sample,lambda q:q['rows'][0].update(displayed_credits=-1))
changed('source artifact bytes negative',sample,lambda q:q['source_artifact'].update(bytes=-1))
changed('unknown provider credits zero-imputed',sample,lambda q:q.update(credit_semantics='UNKNOWN'))
changed('aggregate-only synthesizes rows',sample,lambda q:q.update(measurement_class='AGGREGATE_ONLY',bounded_counts={'measurement':'PROJECT_LOGICAL_OPERATION','lowerBound':3772,'upperBound':None},credit_semantics='UNKNOWN'))
changed('non-billed commitment relabeled billed',cpp,lambda q:q['planning_commitment'].update(metric='EXACT_BILLED_CREDITS'))
changed('business field outside closed input',sample,lambda q:q.update(unrelated_business_values='FORBIDDEN_SYNTHETIC'))
for name,q in cases:
 try:jsonschema.validate(q,s)
 except jsonschema.ValidationError:pass
 else:raise AssertionError(name)
report_schema=json.loads((r/'SCHEMAS/MERIDIAN_ACCOUNT_ACTIVITY_REPORT.json.schema.json').read_text())
assert report_schema['properties']['observed']['properties']['credits']['anyOf']==[{'type':'integer','minimum':0},{'type':'null'}]
print(json.dumps({'status':'PASS','schemaFalseSuccessRejections':len(cases),'nullableReportCredits':True,'localOnly':True,'cases':[n for n,_ in cases]}))
