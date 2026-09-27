"""Strict v1.0.2 report validation. Input is redacted report metadata only.

This module cannot resolve credentials or issue provider requests. Validation
errors intentionally contain paths/codes, never offending report values.
"""
import json
import math
import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent.parent
OVERLAY = ROOT / "docs/overlays/g6p-a2u-failure-schema-v1.0.2"
SCHEMAS = {
    "offline": "03_NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.schema.json",
    "account": "04_NQ5_ACCOUNT_PREFLIGHT_REDACTED.schema.json",
}


def safe_path(parts, schema):
    known = {"limit", "remaining", "reset_seconds", "retry_after_seconds"}

    def collect(value):
        if isinstance(value, dict):
            known.update(value.get("properties", {}).keys())
            for nested in value.values():
                collect(nested)
        elif isinstance(value, list):
            for nested in value:
                collect(nested)

    collect(schema)
    return "/" + "/".join(str(part) if isinstance(part, int) or part in known else "[redacted-key]" for part in parts)


def validate_report(kind, report):
    if kind not in SCHEMAS:
        return {"valid": False, "errors": [{"path": "/", "code": "UNSUPPORTED_REPORT_KIND"}]}
    schema = json.loads((OVERLAY / SCHEMAS[kind]).read_text())
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = [{"path": safe_path(error.absolute_path, schema),
               "code": "SCHEMA_" + str(error.validator).upper()} for error in validator.iter_errors(report)]
    # Do not inspect malformed structures semantically or render their values.
    if errors:
        return {"valid": False, "errors": errors}

    def fail(path, code):
        errors.append({"path": safe_path(path.strip("/").split("/"), schema), "code": code})

    def finite(value):
        return value is None or (not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value))

    def inspect_strings(value, current=""):
        if isinstance(value, str) and (re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", value) or re.search(r"(?:/home/|/Users/|/tmp/|Bearer\s+\S+|-----BEGIN .*PRIVATE KEY-----)", value) or re.search(r"(?:api|access|secret)[_-]?key\s*[:=]\s*\S+", value, re.IGNORECASE)):
            fail(current or "/", "UNREDACTED_STRING_METADATA")
        elif isinstance(value, dict):
            for key, nested in value.items():
                inspect_strings(nested, current + "/" + key)
        elif isinstance(value, list):
            for index, nested in enumerate(value):
                inspect_strings(nested, current + "/" + str(index))

    inspect_strings(report)
    for index, blocker in enumerate(report["blockers"]):
        if any(key not in {"id", "summary", "gate", "evidence_refs"} for key in blocker):
            fail("/blockers/" + str(index), "UNSAFE_BLOCKER_METADATA_PROJECTION")

    if kind == "account":
        storage, response, account = report["storage"], report["response"], report["account"]
        primary, mirror = storage["primary_raw_sha256"], storage["mirror_raw_sha256"]
        if storage["bytes_equal"] is True and (primary is None or mirror is None or primary != mirror):
            fail("/storage", "HASH_EQUALITY_CLAIM_NOT_SUPPORTED")
        if storage["persistence_status"] == "PASS" and (storage["bytes_equal"] is not True or primary is None or mirror is None or primary != mirror):
            fail("/storage", "PERSISTENCE_PASS_NOT_SUPPORTED")
        for key, value in response.items():
            if key.startswith("credits_") or key == "actual_credit_delta":
                if not finite(value):
                    fail("/response/" + key, "NONFINITE_CREDIT_METADATA")
        for key, value in account.items():
            if key.endswith("credits") or key == "actual_cash_spend_usd":
                if not finite(value):
                    fail("/account/" + key, "NONFINITE_ACCOUNT_METADATA")
        remaining, available = response["credits_remaining_header"], account["available_credits"]
        if remaining is not None and available is not None and remaining != available:
            # Blocked mismatch evidence may be represented, not used as success.
            matching = any(blocker["id"] == "ACCOUNT_CREDIT_RECONCILIATION_MISMATCH" for blocker in report["blockers"])
            if report["status"] == "PASS" or not matching:
                fail("/account/available_credits", "UNEXPLAINED_CREDIT_RECONCILIATION_MISMATCH")
        if report["status"] == "PASS" and response["transport_error_class"] is not None:
            fail("/response/transport_error_class", "PASS_WITH_TRANSPORT_FAILURE")
        allowed_errors = {None, "OFFLINE_GATES_NOT_PASS", "CREDENTIAL_UNAVAILABLE", "CREDENTIAL_RESOLUTION_FAILED", "DNS", "TLS", "TIMEOUT", "TRANSPORT", "HTTP", "PARSE", "SCHEMA", "PERSISTENCE", "LEDGER", "REDACTION", "CREDIT_RECONCILIATION"}
        if response["transport_error_class"] not in allowed_errors:
            fail("/response/transport_error_class", "UNREDACTED_TRANSPORT_ERROR")
        if report["request"]["attempts_issued"] == 0:
            for key in ("plan_class", "available_credits", "included_credits", "promotional_credits", "purchased_credits", "actual_cash_spend_usd"):
                if account[key] is not None:
                    fail("/account/" + key, "UNOBSERVED_ACCOUNT_METADATA")
        # Free-text metadata is constrained beyond the authority schema to avoid
        # shipping identity, private paths or error strings from provider bodies.
        allowed_plans = {None, "FREE", "PRO", "OTHER_REDACTED"}
        if account["plan_class"] not in allowed_plans:
            fail("/account/plan_class", "UNREDACTED_PLAN_METADATA")
        if response["request_id"] is not None:
            fail("/response/request_id", "REQUEST_IDENTIFIER_NOT_PROJECTED")
        rate_headers = response.get("rate_limit_headers", {})
        allowed_rate = {"limit", "remaining", "reset_seconds", "retry_after_seconds"}
        if any(key not in allowed_rate or not finite(value) or value is None or value < 0 for key, value in rate_headers.items()):
            fail("/response/rate_limit_headers", "UNSAFE_RATE_HEADER_PROJECTION")
    return {"valid": not errors, "errors": errors}


if __name__ == "__main__":
    try:
        request = json.load(sys.stdin, parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))
        result = validate_report(request.get("kind"), request.get("report"))
    except (ValueError, TypeError, KeyError, AttributeError):
        result = {"valid": False, "errors": [{"path": "/", "code": "INVALID_REDACTED_INPUT"}]}
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["valid"] else 1)
