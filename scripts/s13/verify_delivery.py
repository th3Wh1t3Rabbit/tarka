#!/usr/bin/env python3
"""Fixed-identity, live-reconstruction verifier for the S13-R3 delivery."""

from __future__ import annotations

import hashlib
import json
import re
import struct
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXPECTED = json.loads(r'''__EXPECTED_JSON__''')


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(rel: str, findings: list[str]):
    path = ROOT / rel
    if not path.is_file():
        findings.append(f"missing:{rel}")
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        findings.append(f"invalid_json:{rel}")
        return {}


def run(command: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, text=True, capture_output=True)


def fixed(rel: str, reason: str, findings: list[str]) -> bool:
    path = ROOT / rel
    expected = EXPECTED["files"].get(rel)
    if not expected or not path.is_file() or path.stat().st_size != expected["bytes"] or sha(path) != expected["sha256"]:
        findings.append(reason)
        return False
    return True


def verify_manifest(findings: list[str]) -> None:
    manifest = ROOT / "MANIFEST.sha256"
    if not manifest.is_file():
        findings.append("manifest_missing")
        return
    rows: dict[str, str] = {}
    for line in manifest.read_text(encoding="utf-8").splitlines():
        try:
            digest, rel = line.split("  ", 1)
        except ValueError:
            findings.append("manifest_format")
            continue
        if rel in rows or rel.startswith("/") or ".." in Path(rel).parts:
            findings.append("manifest_path_or_duplicate")
        rows[rel] = digest
    actual = {path.relative_to(ROOT).as_posix() for path in ROOT.rglob("*") if path.is_file() and path.name != "MANIFEST.sha256"}
    if set(rows) != actual:
        findings.append("manifest_members")
    for rel, digest in rows.items():
        path = ROOT / rel
        if not path.is_file() or sha(path) != digest:
            findings.append(f"manifest_hash:{rel}")
    if any("__pycache__" in rel or rel.endswith(".pyc") for rel in actual):
        findings.append("python_cache_in_delivery")


def verify_fixed(findings: list[str]) -> None:
    reasons = {
        "GIT/CANDIDATE.patch": "candidate_patch_fixed_identity",
        "GIT/candidate.bundle": "candidate_bundle_fixed_identity",
        "GIT/prerequisite.bundle": "prerequisite_bundle_fixed_identity",
        "GIT_STATE.json": "git_state_fixed_identity",
        "PRODUCTION/app.js": "production_app_fixed_identity",
        "PRODUCTION/app.js.map": "production_source_map_fixed_identity",
        "RUNTIME/s13-runtime.json": "runtime_fixed_hash",
        "NEGATIVE_PROBE_RESULTS.json": "negative_probe_results_fixed_identity",
        "SCREENSHOTS/01-broad-neutral-corpus.png": "screenshot_broad_fixed_identity",
        "SCREENSHOTS/02-caseboard-partial-proof.png": "screenshot_partial_proof_fixed_identity",
        "SCREENSHOTS/03-caseboard-completion-ready.png": "screenshot_exact_proof_fixed_identity",
        "SCREENSHOTS/04-direct-path-brcg-absent.png": "screenshot_brcg_absent_fixed_identity",
        "SCREENSHOTS/05-brcg-unlocked-by-back-read.png": "screenshot_brcg_unlocked_fixed_identity",
        "SCREENSHOTS/06-exact-count-query-receipt.png": "screenshot_receipt_fixed_identity",
    }
    for rel in EXPECTED["files"]:
        reason = reasons.get(rel, f"fixed_payload:{rel}")
        if rel in EXPECTED["logs"]:
            reason = f"raw_log_fixed_identity:{rel}"
        elif rel in EXPECTED["reports"]:
            reason = f"report_fixed_identity:{rel}"
        elif rel in EXPECTED["sources"]:
            reason = f"source_snapshot_fixed_identity:{rel}"
        fixed(rel, reason, findings)


def verify_runtime(findings: list[str]) -> None:
    runtime = load("RUNTIME/s13-runtime.json", findings)
    metrics = {"callAtlasReceipts": 101, "p2r1Receipts": 25, "e03Receipts": 76, "e03Curated": 45, "e03ReceiptOnly": 31, "semanticRecords": 227, "providerRows": 200, "credits": "112", "filterSequence": [98, 98, 74, 3, 2, 1], "r55CountSlots": [98, 3, 2]}
    if runtime.get("metrics") != metrics:
        findings.append("receipt_or_metric_totals")
    receipts = runtime.get("callAtlas", [])
    ids = [row.get("publicCallId") for row in receipts]
    if len(receipts) != 101 or len(set(ids)) != 101:
        findings.append("receipt_identity")
    e03 = [row for row in receipts if row.get("sourceCampaign") == "E03"]
    if len(e03) != 76 or any(row.get("acceptanceStatus") != "ACCEPTED_BY_CHATGPT_MAIN_LEAD" for row in e03):
        findings.append("acceptance_overlay")
    curated = [row for row in e03 if row.get("curatedEvidenceAcceptanceStatus") == "ACCEPTED_BY_CHATGPT_MAIN_LEAD"]
    receipt_only = [row for row in e03 if row.get("curatedEvidenceAcceptanceStatus") == "NOT_APPLICABLE_CALL_ATLAS_RECEIPT_ONLY"]
    if (len(curated), len(receipt_only)) != (45, 31):
        findings.append("classification_45_31")
    records = runtime.get("caseCorpus", [])
    record_ids = [row.get("recordId") for row in records]
    if len(records) != 227 or len(set(record_ids)) != 227:
        findings.append("corpus_identity")
    if any(row.get("sourcePublicCallId") in {item.get("publicCallId") for item in receipt_only} for row in records):
        findings.append("receipt_only_in_corpus")
    prebrief = runtime.get("prebrief", {})
    prebrief_text = json.dumps(prebrief).lower()
    if any(prebrief.get(key) is not False for key in ("individualRecordsIncluded", "filterPredicatesIncluded", "exactSlotFieldsIncluded")) or any(token in prebrief_text for token in ("hero.exact", "0xdae809", "8877507", "filter.unframed")):
        findings.append("prebrief_leak")
    if runtime.get("caseFileGate", {}).get("clueIds") != ["CLUE.CASE_FILE.DAI", "CLUE.CASE_FILE.AMOUNT_8_88M"]:
        findings.append("case_file_gate")
    stages = runtime.get("evidenceDelta", {}).get("stages", [])
    if [row.get("newCount") for row in stages] != [98, 98, 74, 3, 2, 1]:
        findings.append("evidence_delta")
    if not stages or stages[-1].get("survivingRecordIds") != ["HERO.EXACT_CONVERGENCE"]:
        findings.append("exact_survivor")
    proof = runtime.get("proof", {})
    exact = proof.get("exactRecord", {})
    contextual = proof.get("contextualCorroboration", {})
    if exact.get("recordId") != "HERO.EXACT_CONVERGENCE" or exact.get("fillsProofSlots") != ["AMOUNT", "RECEIVER", "LINK"] or exact.get("evidenceGradeCeiling") != "EXACT":
        findings.append("exact_hero_proof")
    if contextual.get("recordId") != "TGM.0bfe8fe9f886fa29" or contextual.get("fillsProofSlots", []) or contextual.get("evidenceGradeCeiling") != "CONTEXTUAL":
        findings.append("contextual_not_proof")
    brcg = runtime.get("brcg", {})
    bounded = brcg.get("boundedNoMatch", {})
    if brcg.get("e02RowsIncluded") is not False or brcg.get("playerDiscoveryOptional") is not True:
        findings.append("brcg_or_e02_boundary")
    if bounded.get("zeroResultClass") != "NO_MATCH_IN_ACCEPTED_CORPUS" or bounded.get("establishesGlobalAbsence") is not False or bounded.get("mayFalsifyTheory") is not False:
        findings.append("brcg_claim_boundary")
    if runtime.get("productionBoundary") != {"runtimeProviderCalls": 0, "r55DialogueActive": False, "endingActive": False, "mission02Active": False}:
        findings.append("production_activation")
    if sha(ROOT / "RUNTIME/s13-runtime.json") != "82918530c6be5cf69b8f5631f5040758db36add9c28ce0737be7f888c16c78d3":
        findings.append("runtime_fixed_hash")
    if runtime.get("sourceHashes") != EXPECTED["inputHashes"]:
        findings.append("accepted_input_hash")
    forbidden = ("providerrequestid", "rawbody", "remainingcredits", "credential", "/path/to/local-user/", "e02_brcg_token_screener")
    if any(token in json.dumps(runtime).lower() for token in forbidden):
        findings.append("public_projection")


def verify_r3_receipts(findings: list[str]) -> None:
    receipt = load("THREE_DISPATCH_QUERY_RECEIPT.json", findings)
    expected_groups = [
        {"id": "FLOOD_ORIENT", "startStage": 0, "endStage": 2, "counts": [98, 98], "resultCount": 98},
        {"id": "CANDIDATES_CASE_FILE_BOUNDS", "startStage": 2, "endStage": 4, "counts": [74, 3], "resultCount": 3},
        {"id": "RECEIPT_ROUTE_VERIFICATION", "startStage": 4, "endStage": 6, "counts": [2, 1], "resultCount": 1},
    ]
    if receipt.get("mandatoryDispatchCount") != 3 or receipt.get("commandHistory") != ["STAGE_CARD", "REVIEW_RECEIPT", "DISPATCH"] * 3:
        findings.append("dispatch_count_three")
    if receipt.get("groups") != expected_groups:
        findings.append("grouped_semantic_mapping")
    if receipt.get("productionOwner") != "CASE_QUESTION_CARD_QUERY_RECEIPT_DISPATCH" or receipt.get("preDispatchReviewRequired") is not True or receipt.get("exploreDispatchControls") != 0:
        findings.append("predispatch_receipt_required")

    counts = load("EXACT_COUNT_SUMMARY_RECEIPT.json", findings)
    expected_summaries = [
        {"id": "FLOOD_ORIENT", "inputCount": 98, "outputCount": 98, "summary": "98 corpus records → 98 matches", "detailedCounts": [98, 98]},
        {"id": "CANDIDATES_CASE_FILE_BOUNDS", "inputCount": 98, "outputCount": 3, "summary": "98 corpus records → 3 matches", "detailedCounts": [98, 74, 3]},
        {"id": "RECEIPT_ROUTE_VERIFICATION", "inputCount": 3, "outputCount": 1, "summary": "3 corpus records → 1 match", "detailedCounts": [3, 2, 1]},
    ]
    if counts.get("owner") != "s13QueryGroupSummary" or counts.get("consumers") != ["CASE_STAGED_PREVIEW", "PRE_DISPATCH_QUERY_RECEIPT"] or counts.get("groups") != expected_summaries:
        findings.append("exact_count_summary")

    legacy = load("LEGACY_SAVE_RECEIPT.json", findings)
    if legacy != {"retiredCommand": "S13_DISPATCH_QUESTION", "oneRetiredEntry": {"restoredStage": 0, "restoredCommands": 0, "atomicCleanInitial": True}, "sixRetiredEntries": {"restoredStage": 0, "restoredCommands": 0, "atomicCleanInitial": True}, "validVersion2": {"restoredStage": 6, "dispatches": 3, "exactHistoryRestored": True}}:
        findings.append("legacy_save_fail_closed")

    retired = load("RETIRED_COMMAND_ABSENCE.json", findings)
    if retired.get("marker") != "S13_DISPATCH_QUESTION" or retired.get("sourceOccurrences") != 0 or retired.get("builtJsOccurrences") != 0 or retired.get("sourceMapOccurrences") != 0:
        findings.append("retired_command_absent")
    marker = b"S13_DISPATCH_QUESTION"
    if any(marker in (ROOT / rel).read_bytes() for rel in ("PRODUCTION/app.js", "PRODUCTION/app.js.map") if (ROOT / rel).is_file()):
        findings.append("build_retired_marker_absent")

    suite = load("FULL_VITEST_FAILURE_SET_COMPARISON.json", findings)
    if suite.get("candidateFailureSetMatchesStanding") is not True or suite.get("unexpectedFailures") != [] or suite.get("removedFailures") != ["tests/unit/s12-p3-r55-registry.test.ts > S12-P3-R4 subject-aware exact R55 ledger, graph, and engine > stays development-only and authenticates the unchanged production bundle"]:
        findings.append("full_suite_failure_set")
    totals = suite.get("totals", {})
    remaining = suite.get("remainingFailures", [])
    if totals != EXPECTED["fullSuiteTotals"] or suite.get("actualRemainingFailureSet") != EXPECTED["fullFailureSet"] or [row.get("test") for row in remaining] != EXPECTED["fullFailureSet"] or any(row.get("class") not in {"HISTORICAL_EXTERNAL_ARCHIVE", "HISTORICAL_EXTERNAL_SOURCE_PACK", "NARRATIVE_CONTRACT", "S4_DIGEST"} for row in remaining):
        findings.append("full_suite_failure_set")
    if any("s13" in row.get("test", "").lower() or "s12-p3-r55" in row.get("test", "").lower() for row in suite.get("remainingFailures", [])):
        findings.append("new_shared_owner_failure")

    production = load("PRODUCTION_NONACTIVATION.json", findings)
    if production.get("assetPath") != EXPECTED["production"]["assetPath"] or production.get("assetSha256") != EXPECTED["production"]["assetSha256"] or production.get("obsoleteHardcodedAssetPresent") is not False or production.get("forbiddenMarkersFound") != []:
        findings.append("current_production_asset_owner")

    visual = load("SCREENSHOT_ASSERTIONS.json", findings)
    shots = {row.get("path"): row for row in visual.get("screenshots", [])}
    broad = shots.get("SCREENSHOTS/01-broad-neutral-corpus.png", {})
    brcg = shots.get("SCREENSHOTS/05-brcg-unlocked-by-back-read.png", {})
    if broad.get("visibleMarkers") != ["TRANSFER RECORD 026", "TRANSFER RECORD 109", "TRANSFER RECORD 110"] or broad.get("forbiddenMarkers") != ["HERO.EXACT_CONVERGENCE", "8877507.348306697"]:
        findings.append("broad_visual_state")
    if brcg.get("visibleMarkers") != ["BRCG SNAPSHOT / BOUNDED NO-MATCH", "NO_MATCH_IN_ACCEPTED_CORPUS", "Held E02 rows included: no."] or brcg.get("panelExpanded") is not True:
        findings.append("brcg_visual_state")
    receipt_shot = shots.get("SCREENSHOTS/06-exact-count-query-receipt.png", {})
    if receipt_shot.get("visibleMarkers") != ["98 corpus records → 3 matches", "98 → 74", "74 → 3", "ACCEPTED SEMANTIC SUB-STAGES: 3–4"]:
        findings.append("receipt_visual_state")


def verify_source_semantics(source_root: Path, findings: list[str]) -> None:
    state = (source_root / "src/investigation/state.ts").read_text(encoding="utf-8")
    workbench = (source_root / "src/app/CaseTerminalWorkbench.tsx").read_text(encoding="utf-8")
    explorer = (source_root / "src/app/S13IntegratedCorpus.tsx").read_text(encoding="utf-8")
    s13 = (source_root / "src/investigation/s13.ts").read_text(encoding="utf-8")
    production_test = (source_root / "tests/unit/s12-p3-r55-registry.test.ts").read_text(encoding="utf-8")
    fixture = (source_root / "src/investigation/fixture.ts").read_text(encoding="utf-8")
    app = (source_root / "src/app/App.tsx").read_text(encoding="utf-8")
    if "S13_DISPATCH_QUESTION" in state:
        findings.append("retired_command_absent")
    if "function s13QueryGroupSummary" not in s13 or "stages.find(stage => stage.previousCount !== null)?.previousCount" not in s13:
        findings.append("shared_count_summary_owner")
    if workbench.count("s13QueryGroupSummary(") != 1 or "s13Summary.inputCount" not in workbench or "s13Summary.outputCount" not in workbench:
        findings.append("shared_count_summary_owner")
    if 'MATCH-COUNT FUNNEL: {s13Summary ? `${s13Summary.inputCount} corpus records → ${s13Summary.outputCount} matches`' not in workbench:
        findings.append("case_preview_shared_count_owner")
    if "MATCH-COUNT FUNNEL: {s13Summary?.inputCount ?? fixture.records.length} corpus records → {previewCount} matches" not in workbench:
        findings.append("receipt_shared_count_owner")
    if "state.s13FilterStage || 98" in workbench:
        findings.append("receipt_shared_count_owner")
    if "if (fixture.s13 && state.access)" in state or "askCardIds: [], showQuerySurface: false, allowTheory: false, allowCompare: false" in state:
        findings.append("capability_model_restored")
    if explorer.count("S13_DISPATCH_QUESTION") or "DISPATCH QUESTION" in explorer:
        findings.append("explore_dispatch_unreachable")
    if "REVIEW QUERY RECEIPT" not in workbench or "disabled={fixture.s13 ? state.reviewedReceipt !== receiptKey" not in workbench or "state.reviewedReceipt !== before" not in state:
        findings.append("predispatch_receipt_required")
    for token in ("FLOOD_ORIENT", "CANDIDATES_CASE_FILE_BOUNDS", "RECEIPT_ROUTE_VERIFICATION", "startStage: 0, endStage: 2", "startStage: 2, endStage: 4", "startStage: 4, endStage: 6"):
        if token not in s13: findings.append("grouped_semantic_mapping")
    if "case 'DISPATCH'" not in state or "s13QueryGroupForQuestion" not in state:
        findings.append("dispatch_owner")
    if "S13_VERIFY_RECORD" not in state or "No proof slot is filled by reaching this result." not in explorer:
        findings.append("reducer_owned_proof_required")
    if "Contextual evidence cannot fill AMOUNT, RECEIVER, or LINK." not in state:
        findings.append("contextual_proof_rejected")
    if "sideLeadUnlocked && <S13Brcg" not in explorer or "<details open data-testid=\"s13-brcg\"" not in explorer:
        findings.append("brcg_optional_gate")
    if "index-DBC_kJlO.js" in production_test or "dist/index.html" not in production_test or "mathematically precise haystack" not in production_test:
        findings.append("current_production_asset_owner")
    if "caseCorpus.map(record => record.recordId)" not in state or "caseCorpus.map(record => record.id)" in state:
        findings.append("selected_record_record_id")
    if "fixture.startingClueIds = fixture.startingClueIds.filter" not in fixture:
        findings.append("synthetic_s13_clue_isolation")
    if "s13RecordLabel(record" not in explorer or "<h3>{record.recordId}</h3>" in explorer:
        findings.append("neutral_broad_pool_labels")
    if "presentedCase.complete && !fixture.s13" not in app:
        findings.append("s14_nonactivation")


def bundle_pack_identity(path: Path) -> tuple[int, str]:
    data = path.read_bytes()
    pack = data[data.index(b"PACK"):]
    return struct.unpack(">I", pack[8:12])[0], pack[-20:].hex()


def verify_git(findings: list[str]) -> None:
    state = load("GIT_STATE.json", findings)
    exact = EXPECTED["git"]
    for key in ("candidate", "tree", "parent", "parentTree", "parentCount", "canonical", "protectedPrimary", "posture"):
        if state.get(key) != exact[key]: findings.append("git_state_fixed_identity")
    for rel, pack_expected in (("GIT/candidate.bundle", EXPECTED["packs"]["candidate"]), ("GIT/prerequisite.bundle", EXPECTED["packs"]["prerequisite"])):
        try:
            objects, trailer = bundle_pack_identity(ROOT / rel)
            if objects != pack_expected["objects"] or trailer != pack_expected["trailerSha1"]: findings.append("bundle_pack_identity")
        except Exception:
            findings.append("bundle_pack_identity")
    with tempfile.TemporaryDirectory(prefix="s13-r3-verify-") as temporary:
        repo = Path(temporary) / "seed.git"
        if run(["git", "init", "--bare", str(repo)], Path(temporary)).returncode: findings.append("git_seed_init"); return
        if run(["git", "fetch", str(ROOT / "GIT/prerequisite.bundle"), "refs/heads/prerequisite:refs/heads/prerequisite"], repo).returncode: findings.append("git_prerequisite_seed"); return
        if run(["git", "bundle", "verify", str(ROOT / "GIT/candidate.bundle")], repo).returncode: findings.append("git_bundle_live_verify"); return
        if run(["git", "fetch", str(ROOT / "GIT/candidate.bundle"), "refs/heads/candidate:refs/heads/candidate"], repo).returncode: findings.append("git_candidate_import"); return
        def git(*args: str) -> str: return run(["git", *args], repo).stdout.strip()
        if run(["git", "fsck", "--full"], repo).returncode: findings.append("git_fsck_full")
        if git("rev-parse", "refs/heads/candidate") != exact["candidate"] or git("rev-parse", "refs/heads/candidate^{tree}") != exact["tree"]: findings.append("reconstructed_candidate_tree")
        if git("show", "-s", "--format=%P", exact["candidate"]) != exact["parent"]: findings.append("reconstructed_parent")
        changed = git("diff", "--name-only", f'{exact["parent"]}..{exact["candidate"]}').splitlines()
        if changed != EXPECTED["changedPaths"]: findings.append("reconstructed_changed_paths")
        patch = run(["git", "diff", "--binary", f'{exact["parent"]}..{exact["candidate"]}'], repo).stdout.encode()
        if patch != (ROOT / "GIT/CANDIDATE.patch").read_bytes(): findings.append("reconstructed_patch")
        for rel in EXPECTED["sourcePaths"]:
            candidate_bytes = subprocess.run(["git", f"--git-dir={repo}", "show", f'{exact["candidate"]}:{rel}'], capture_output=True).stdout
            if candidate_bytes != (ROOT / "SOURCE" / rel).read_bytes(): findings.append(f"source_snapshot_candidate_mismatch:{rel}")
        verify_source_semantics(ROOT / "SOURCE", findings)


def verify_logs(findings: list[str]) -> None:
    decisions = load("TEST_DECISIONS.json", findings)
    rows = {row.get("log"): row for row in decisions.get("testsRun", [])}
    for rel, expected in EXPECTED["logs"].items():
        path = ROOT / rel
        text = path.read_text(encoding="utf-8", errors="replace") if path.is_file() else ""
        parsed = dict(re.findall(r"^(COMMAND|START_UTC|END_UTC|RUNTIME_SECONDS|EXIT)=(.*)$", text, re.MULTILINE))
        row = rows.get(rel, {})
        if parsed.get("COMMAND") != expected["command"] or parsed.get("EXIT") != str(expected["exit"]): findings.append(f"raw_log_command_or_exit:{rel}")
        if row.get("command") != expected["command"] or row.get("exit") != expected["exit"] or row.get("sha256") != EXPECTED["files"].get(rel, {}).get("sha256"):
            findings.append(f"test_decision_receipt:{rel}")
        for token in expected["meaningfulTokens"]:
            if token not in text: findings.append(f"raw_log_meaningful_total:{rel}")
    probes = load("NEGATIVE_PROBE_RESULTS.json", findings)
    if probes.get("clean") != "PASS" or probes.get("allFailedClosed") is not True or probes.get("probeCount") < 51 or probes.get("probeCount") != len(probes.get("probes", [])):
        findings.append("negative_probe_results_schema")
    boundaries = load("BOUNDARIES.json", findings)
    if boundaries.get("runtimeProviderCalls") != 0 or boundaries.get("networkBlockedExternalRequests") != 0 or any(boundaries.get(key) is not False for key in ("productionR55DialogueActive", "productionEndingActive", "productionMission02Active")):
        findings.append("network_or_activation_boundary")
    excluded = load("EXCLUDED_EFFECTS.json", findings)
    if not excluded or any(value != 0 for value in excluded.values()):
        findings.append("excluded_effects")
    readiness = load("S14_READINESS.json", findings)
    if readiness.get("status") != "READ_ONLY_READY" or readiness.get("s14Started") is not False:
        findings.append("s14_scope")


def verify() -> list[str]:
    findings: list[str] = []
    verify_manifest(findings)
    verify_fixed(findings)
    verify_runtime(findings)
    verify_r3_receipts(findings)
    verify_git(findings)
    verify_logs(findings)
    return list(dict.fromkeys(findings))


if __name__ == "__main__":
    failures = verify()
    if failures:
        print("FAIL")
        print("\n".join(failures))
        raise SystemExit(1)
    print("PASS S13_R3_DELIVERY")
