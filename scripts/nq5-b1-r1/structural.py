"""Bounded schema diagnostics. Never output validation messages or instance values."""
import json
import re
import sys
from jsonschema import Draft202012Validator, FormatChecker

approved_names = set()
def name(value):
    value = str(value)
    return value if value in approved_names and re.fullmatch(r"[a-z][a-z_]{0,47}", value) else "REDACTED_FIELD_NAME"

def kind(value):
    if value is None: return "null"
    if isinstance(value, bool): return "boolean"
    if isinstance(value, dict): return "object"
    if isinstance(value, list): return "array"
    if isinstance(value, str): return "string"
    return "number"

try:
    request = json.load(sys.stdin)
    def local_refs(value):
        if isinstance(value, dict):
            if "$ref" in value and not value["$ref"].startswith("#/"): raise ValueError()
            for child in value.values(): local_refs(child)
        elif isinstance(value, list):
            for child in value: local_refs(child)
    local_refs(request["schema"])
    Draft202012Validator.check_schema(request["schema"])
    def declare(schema):
        if isinstance(schema, dict):
            approved_names.update(schema.get("properties", {}).keys())
            for value in schema.values(): declare(value)
        elif isinstance(schema, list):
            for value in schema: declare(value)
    declare(request["schema"])
    findings = []
    def flatten(error):
        yield error
        for child in error.context:
            yield from flatten(child)
    errors = (nested for error in Draft202012Validator(request["schema"], format_checker=FormatChecker()).iter_errors(request["object"]) for nested in flatten(error))
    for error in errors:
        pointer = "".join("/" + (str(p) if isinstance(p, int) else name(p)).replace("~", "~0").replace("/", "~1") for p in error.absolute_path)
        missing = [name(n) for n in error.schema.get("required", []) if isinstance(error.instance, dict) and n not in error.instance] if error.validator == "required" else []
        unknown = [name(n) for n in error.instance if n not in error.schema.get("properties", {})] if error.validator == "additionalProperties" and isinstance(error.instance, dict) else []
        expected = error.schema.get("type", [])
        expected = expected if isinstance(expected, list) else [expected]
        expected = [n for n in expected if n in ["null", "boolean", "object", "array", "string", "number", "integer"]]
        validator = error.validator if error.validator in {"type", "required", "additionalProperties", "anyOf", "oneOf", "allOf", "enum", "format", "minimum", "maximum", "pattern", "minItems", "maxItems"} else "OTHER"
        findings.append({"code": "SCHEMA_" + validator.upper(), "pointer": pointer, "expectedTypes": expected, "observedType": kind(error.instance), "missingFieldNames": sorted(missing), "unknownFieldNames": sorted(unknown)})
        if len(findings) >= 64: break
    # Deduplicate repeat required-field findings without revealing any values.
    findings = list({json.dumps(f, sort_keys=True): f for f in findings}.values())
    print(json.dumps({"status": "PASS" if not findings else "FAIL", "code": "SCHEMA_ACCEPTED" if not findings else "SCHEMA_REJECTED", "findings": findings}, sort_keys=True))
except Exception:
    print(json.dumps({"status": "FAIL", "code": "SCHEMA_DIAGNOSTIC_UNAVAILABLE", "findings": []}))
    sys.exit(1)
