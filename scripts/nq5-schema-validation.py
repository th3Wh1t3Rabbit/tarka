"""Local-only schema validation, with non-echoing diagnostics."""
import json
import sys
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent.parent / "docs/overlays/g6p-a2u-v1.0.1"
FILES = {
    "clues": "05_CASE_CLUE_QUERY_AND_QUESTION_LENS.schema.json",
    "terminal": "06_CASE_TERMINAL_AND_CASEBOARD_CONTRACT.schema.json",
    "proof": "07_EVIDENCE_ROUTE_PUZZLE_AND_PROOF.schema.json",
    "results": "08_RESULT_CARD_AND_TRACE_THREAD.schema.json",
    "ledger": "03_PRIVATE_CALL_LEDGER.schema.json",
    "public": "04_PUBLIC_CALL_INDEX.schema.json",
}

def local_refs(value):
    if isinstance(value, dict):
        if "$ref" in value and not value["$ref"].startswith("#/"):
            raise ValueError("Remote reference forbidden")
        for child in value.values(): local_refs(child)
    elif isinstance(value, list):
        for child in value: local_refs(child)

try:
    data = json.load(sys.stdin, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    schema = json.loads((ROOT / FILES[data["kind"]]).read_text()) if data["kind"] in FILES else data["schema"]
    local_refs(schema)
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    objects = data["objects"] if "objects" in data else [data["object"]]
    if not isinstance(objects, list): raise ValueError()
    errors = [{"code": "SCHEMA_" + str(error.validator).upper()} for obj in objects for error in validator.iter_errors(obj)]
    result = {"valid": not errors, "errors": errors}
except Exception:
    result = {"valid": False, "errors": [{"code": "INVALID_LOCAL_SCHEMA_INPUT"}]}
print(json.dumps(result))
raise SystemExit(0 if result["valid"] else 1)
