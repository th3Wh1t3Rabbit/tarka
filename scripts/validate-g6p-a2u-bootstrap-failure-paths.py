"""Offline source-contract probes, NOT authorization reports or provider evidence.

No credential resolver, transport, persistence adapter or environment inspection.
Synthetic specimens exist only in memory and are labeled in the diagnostic.
"""
import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


def probe_reports(overlay):
    schemas = {
        "offline": json.loads((overlay / "04_NQ5_OFFLINE_PRECALL_AUTHORIZATION_REPORT.schema.json").read_text()),
        "account": json.loads((overlay / "05_NQ5_ACCOUNT_PREFLIGHT_REDACTED.schema.json").read_text()),
    }
    validators = {}
    for name, schema in schemas.items():
        Draft202012Validator.check_schema(schema)
        validators[name] = Draft202012Validator(schema, format_checker=FormatChecker())

    common = {
        "schema_version": "1.0.0", "status": "PASS",
        "exception_id": "LEAD-NQ5-ACCOUNT-PREFLIGHT-BOOTSTRAP-001",
        "parent_authorization_id": "LEAD-NQ5-UNIFIED-CASEBOARD-UTILITY-001",
        "generated_at_utc": "2026-09-16T00:00:00Z",
    }
    offline = {
        **common, "candidate_commit": "0" * 40, "candidate_tree": "0" * 40,
        "mandatory_offline_gates": {name: "PASS" for name in schemas["offline"]["properties"]["mandatory_offline_gates"]["required"]},
        "credential_resolution_attempted": False, "provider_calls_issued": 0,
        "AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT": True,
    }
    account = {
        **common, "ACCOUNT_PREFLIGHT_PASS": True, "credential_status": "PRESENT_REDACTED",
        "request": {"method": "GET", "host": "api.nansen.ai", "path": "/api/v1/account",
                    "attempts_issued": 1, "retries": 0, "redirects": 0, "body_sent": False,
                    "query_sent": False, "qualification_counted": False, "public_indexed": False},
        "response": {"http_status": 200, "request_id": None, "credits_cost": 0,
                     "credits_used": 0, "credits_remaining_header": 1000, "actual_credit_delta": 0},
        "storage": {"primary_raw_sha256": "a" * 64, "mirror_raw_sha256": "a" * 64,
                    "bytes_equal": True, "raw_payload_packaged": False, "private_paths_redacted": True},
        "ledger": {"question_lens": "ADMIN", "purpose_code": "ACCOUNT_PREFLIGHT",
                   "qualification_counted": False, "public_call_id": None,
                   "terminal_status": "COMPLETED_PRIVATE_NONQUALIFICATION"},
        "account": {"plan_class": None, "available_credits": 1000, "included_credits": None,
                    "promotional_credits": None, "purchased_credits": None,
                    "actual_cash_spend_usd": None, "identity_fields_included": False},
        "secret_scan": "PASS",
    }
    cases = []

    def check(name, kind, specimen, expected_valid):
        errors = sorted(validators[kind].iter_errors(specimen), key=lambda error: str(list(error.absolute_path)))
        cases.append({
            "name": name, "schema": kind, "synthetic_test_only": True,
            "expected_valid": expected_valid, "valid": not errors,
            "expectation_met": (not errors) == expected_valid,
            "errors": [{"instance_path": "/" + "/".join(map(str, error.absolute_path)),
                        "schema_path": "/" + "/".join(map(str, error.absolute_schema_path)),
                        "message": error.message} for error in errors],
        })

    check("offline_PASS_positive_control", "offline", offline, True)
    blocked = copy.deepcopy(offline)
    blocked.update(status="BLOCKED_WITH_EVIDENCE", AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT=False)
    check("offline_BLOCKED_all_gates_PASS_control", "offline", blocked, True)
    for gate in offline["mandatory_offline_gates"]:
        for outcome in ("FAIL", "NOT_VERIFIED"):
            failed = copy.deepcopy(blocked)
            failed["mandatory_offline_gates"][gate] = outcome
            failed["blockers"] = [{"id": "SYNTHETIC_TEST_GATE_FAILURE", "gate": gate}]
            check(f"offline_BLOCKED_{gate}_{outcome}", "offline", failed, False)
    check("account_PASS_positive_control", "account", account, True)
    failed_account = copy.deepcopy(account)
    failed_account.update(status="BLOCKED_WITH_EVIDENCE", ACCOUNT_PREFLIGHT_PASS=False)
    failed_account["ledger"]["terminal_status"] = "FAILED_PRIVATE_NONQUALIFICATION"
    failed_account["response"]["http_status"] = 500
    check("account_BLOCKED_500_control", "account", failed_account, True)
    mismatch = copy.deepcopy(failed_account)
    mismatch["storage"].update(bytes_equal=False, mirror_raw_sha256="b" * 64)
    check("account_BLOCKED_storage_mismatch", "account", mismatch, False)
    privacy = copy.deepcopy(failed_account)
    privacy["secret_scan"] = "FAIL"
    check("account_BLOCKED_secret_scan_failure", "account", privacy, False)
    return {
        "diagnostic_version": "1.0.0", "status": "BLOCKED_WITH_EVIDENCE",
        "diagnostic_kind": "SUPPLIED_SCHEMA_FAILURE_STATE_REPRESENTATION",
        "is_authorization_report": False, "synthetic_probes_only": True,
        "probe_execution": "PASS" if all(case["expectation_met"] for case in cases) else "FAIL",
        "source_admission": "BLOCKED_FAILURE_REPORT_CONTRACT",
        "AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT": False, "AUTHORIZED_TO_ISSUE": False,
        "credential_resolution_attempted": False, "provider_calls_issued": 0,
        "qualification_counted": 0, "cases": cases,
        "required_direction": "Corrected Lead-supplied schemas permitting truthful failed/not-verified gates and storage/privacy failure states in BLOCKED reports; preserve strict PASS constraints.",
    }


if __name__ == "__main__":
    source = Path(__file__).resolve().parent.parent / "docs/overlays/g6p-a2u-bootstrap-v1.0.0"
    result = probe_reports(source)
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["probe_execution"] == "PASS" else 1)
