import json,pathlib,jsonschema,copy
root=pathlib.Path("artifacts/g6p-s3")
count=0
for p in sorted((root/"SCHEMAS").glob("*.json")):
    report=root/"REPORTS"/p.name.removesuffix(".schema.json")
    data=json.loads(report.read_text())
    validator=jsonschema.Draft202012Validator(json.loads(p.read_text()))
    validator.validate(data)
    bad=copy.deepcopy(data);bad["UNDECLARED_PROVIDER_FIELD"]="SYNTHETIC"
    assert list(validator.iter_errors(bad)), "additional field admitted"
    count+=1
print(json.dumps({"status":"PASS","schemas":count,"closedSchemaRejections":count}))
