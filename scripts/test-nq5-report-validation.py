"""Expanded in-memory synthetic regression matrix; never emits specimens."""
import contextlib
import copy
import importlib.util
import io
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()):
        spec.loader.exec_module(module)
    return module


ROOT = Path(__file__).resolve().parent.parent
runtime = load("nq5_runtime_validation", ROOT / "scripts/nq5-report-validation.py")
supplied = load("nq5_supplied_probes", runtime.OVERLAY / "05_VALIDATE_FAILURE_REPORT_SCHEMAS.py")
results = []


def check(name, kind, obj, expected):
    validation = runtime.validate_report(kind, obj)
    results.append({"name": name, "synthetic_test_only": True, "expected_valid": expected,
                    **validation, "expectation_met": validation["valid"] == expected})


check("offline_PASS_control", "offline", supplied.base_offline, True)
for gate in supplied.GATES:
    for state in ("FAIL", "NOT_VERIFIED"):
        failed = copy.deepcopy(supplied.base_offline)
        failed["mandatory_offline_gates"][gate] = state
        check("offline_PASS_rejects_" + gate + "_" + state, "offline", failed, False)
        failed.update(status="BLOCKED_WITH_EVIDENCE", AUTHORIZED_TO_ISSUE_ACCOUNT_PREFLIGHT=False,
                      blockers=[{"id": "SYNTHETIC_GATE_FAILURE", "summary": "Synthetic gate outcome", "gate": gate}])
        check("offline_BLOCKED_accepts_" + gate + "_" + state, "offline", failed, True)
check("account_PASS_control", "account", supplied.base_account, True)


def failure(name, mutate):
    passing = copy.deepcopy(supplied.base_account)
    mutate(passing)
    check("account_PASS_rejects_" + name, "account", passing, False)
    blocked = copy.deepcopy(passing)
    blocked.update(status="BLOCKED_WITH_EVIDENCE", ACCOUNT_PREFLIGHT_PASS=False,
                   blockers=[{"id": name, "summary": "Synthetic failure outcome"}])
    blocked["ledger"]["terminal_status"] = "FAILED_PRIVATE_NONQUALIFICATION"
    check("account_BLOCKED_accepts_" + name, "account", blocked, True)


for status in (301, 302, 307, 308, 400, 401, 403, 404, 405, 429, 500, 502, 503):
    failure("HTTP_" + str(status), lambda obj, status=status: obj["response"].update(http_status=status, transport_error_class="HTTP"))
for error in ("DNS", "TLS", "TIMEOUT", "TRANSPORT"):
    failure(error, lambda obj, error=error: obj["response"].update(http_status=None, actual_credit_delta=None, transport_error_class=error))
failure("STORAGE_MISMATCH", lambda obj: obj["storage"].update(persistence_status="FAIL", bytes_equal=False, mirror_raw_sha256="b" * 64))
failure("LEDGER", lambda obj: obj["ledger"].update(terminal_status="FAILED_PRIVATE_NONQUALIFICATION"))
failure("PRIVATE_REDACTION", lambda obj: obj["storage"].update(private_paths_redacted=False))
failure("SECRET_SCAN", lambda obj: obj.update(secret_scan="FAIL"))
failure("POSITIVE_CREDIT", lambda obj: obj["response"].update(actual_credit_delta=1))
failure("UNKNOWN_CREDIT", lambda obj: obj["response"].update(actual_credit_delta=None))
failure("UNPARSEABLE_BALANCE", lambda obj: obj["account"].update(available_credits=None))
failure("POSITIVE_COST", lambda obj: obj["response"].update(credits_cost=1))

for name, mutate in (
    ("HASH_FLAG_LIE", lambda obj: obj["storage"].update(mirror_raw_sha256="b" * 64)),
    ("HEADER_BODY_MISMATCH", lambda obj: obj["response"].update(credits_remaining_header=4999)),
    ("RAW_PACKAGED", lambda obj: obj["storage"].update(raw_payload_packaged=True)),
    ("REQUEST_IDENTIFIER", lambda obj: obj["response"].update(request_id="synthetic-opaque-identifier")),
    ("EMAIL", lambda obj: obj["account"].update(plan_class="synthetic@example.invalid")),
    ("PRIVATE_PATH", lambda obj: obj["response"].update(transport_error_class="/home/synthetic/private.json")),
    ("NONFINITE", lambda obj: obj["account"].update(available_credits=float("inf"))),
):
    obj = copy.deepcopy(supplied.base_account)
    mutate(obj)
    check("semantic_rejects_" + name, "account", obj, False)

for credential_state in ("NOT_RESOLVED", "MISSING_OR_UNREADABLE", "RESOLUTION_FAILED_REDACTED"):
    obj = copy.deepcopy(next(case[2] for case in supplied.cases if case[0] == "account_BLOCKED_before_attempt"))
    obj["credential_status"] = credential_state
    check("account_BLOCKED_before_attempt_" + credential_state, "account", obj, True)

obj = copy.deepcopy(supplied.base_account)
obj.update(status="BLOCKED_WITH_EVIDENCE", ACCOUNT_PREFLIGHT_PASS=False,
           blockers=[{"id": "ACCOUNT_CREDIT_RECONCILIATION_MISMATCH", "summary": "Synthetic observed disagreement"}])
obj["response"]["credits_remaining_header"] = 4999
obj["ledger"]["terminal_status"] = "FAILED_PRIVATE_NONQUALIFICATION"
check("blocked_documented_credit_disagreement", "account", obj, True)

sentinel = "SYNTHETIC_SENTINEL_" + "NOT_A_CREDENTIAL"
for name, mutate in (
    ("BLOCKER_EXTRA", lambda obj: obj["blockers"][0].update({"api" + "key": sentinel})),
    ("BLOCKER_ASSIGNMENT", lambda obj: obj["blockers"][0].update(summary=("api" + "key=" + sentinel))),
    ("UNKNOWN_KEY_ERROR_PATH", lambda obj: obj["blockers"][0].update({sentinel: "/home/synthetic/private"})),
):
    privacy_obj = copy.deepcopy(obj)
    mutate(privacy_obj)
    check("privacy_rejects_" + name, "account", privacy_obj, False)
    assert sentinel not in json.dumps(results[-1])

result = {"status": "PASS" if all(case["expectation_met"] for case in results) else "FAIL",
          "synthetic_test_only": True, "is_authorization_report": False,
          "case_count": len(results), "credential_resolution_attempted": False,
          "provider_calls_issued": 0, "qualification_counted": 0, "results": results}
print(json.dumps(result, indent=2))
raise SystemExit(0 if result["status"] == "PASS" else 1)
