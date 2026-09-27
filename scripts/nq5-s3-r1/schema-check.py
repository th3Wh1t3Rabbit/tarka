import json,pathlib,jsonschema,copy
r=pathlib.Path("artifacts/g6p-s3")
count=0
for p in sorted((r/"SCHEMAS").glob("*.json")):
    data=json.loads((r/"REPORTS"/p.name.removesuffix(".schema.json")).read_text())
    v=jsonschema.Draft202012Validator(json.loads(p.read_text()))
    v.validate(data);bad=copy.deepcopy(data);bad["UNDECLARED_PROVIDER_FIELD"]="SYNTHETIC"
    assert list(v.iter_errors(bad));count+=1
candidate=json.loads(pathlib.Path("artifacts/g6p-s3-r1/REPORTS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json").read_text())
jsonschema.Draft202012Validator(json.loads((r/"SCHEMAS/TE_IFACE_CORPUS_FINAL_CANDIDATE.json.schema.json").read_text())).validate(candidate)
print(json.dumps({"status":"PASS","preservedSchemas":count,"closedSchemaRejections":count,"newCandidateUsesPreservedSchema":True}))
