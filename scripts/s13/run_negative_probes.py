#!/usr/bin/env python3
"""Run the 51 required S13-R3 fail-closed mutations in isolated copies."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

PROBES = [
    ("01_total_101_changes", "receipt_or_metric_totals"),
    ("02_duplicate_receipt_id", "receipt_identity"),
    ("03_overlay_lost", "acceptance_overlay"),
    ("04_classification_changes", "classification_45_31"),
    ("05_receipt_only_enters_corpus", "receipt_only_in_corpus"),
    ("06_corpus_total_or_id_changes", "corpus_identity"),
    ("07_prebrief_leaks_record", "prebrief_leak"),
    ("08_case_gate_bypassed", "case_file_gate"),
    ("09_delta_count_changes", "evidence_delta"),
    ("10_survivor_changes", "exact_survivor"),
    ("11_contextual_fills_slot", "contextual_not_proof"),
    ("12_exact_grade_downgraded", "exact_hero_proof"),
    ("13_e02_enters_base", "brcg_or_e02_boundary"),
    ("14_brcg_global_absence", "brcg_claim_boundary"),
    ("15_private_or_stripped_field", "public_projection"),
    ("16_runtime_provider_request", "production_activation"),
    ("17_r55_or_ending_active", "production_activation"),
    ("18_candidate_patch_substituted", "candidate_patch_fixed_identity"),
    ("19_git_bundle_corrupted", "candidate_bundle_fixed_identity"),
    ("20_accepted_input_hash_changes", "accepted_input_hash"),
    ("21_raw_log_deleted", "raw_log_fixed_identity:LOGS/unit-focused.txt"),
    ("22_capability_override_disables_investigation", "capability_model_restored"),
    ("23_exact_proof_auto_rendered", "reducer_owned_proof_required"),
    ("24_contextual_tgm_fills_slot", "contextual_proof_rejected"),
    ("25_brcg_direct_solver_visible", "brcg_optional_gate"),
    ("26_selected_persistence_uses_record_id", "selected_record_record_id"),
    ("27_synthetic_retains_s13_clues", "synthetic_s13_clue_isolation"),
    ("28_broad_pool_exposes_hero", "neutral_broad_pool_labels"),
    ("29_patch_replaced_receipt_updated", "candidate_patch_fixed_identity"),
    ("30_bundle_corrupted_receipt_updated", "candidate_bundle_fixed_identity"),
    ("31_production_app_deleted", "production_app_fixed_identity"),
    ("32_marker_logs_receipts_updated", "raw_log_fixed_identity:LOGS/unit-focused.txt"),
    ("33_probe_results_fabricated", "negative_probe_results_fixed_identity"),
    ("34_candidate_tree_replaced", "git_state_fixed_identity"),
    ("35_proof_screenshot_replaced_by_ledger", "screenshot_exact_proof_fixed_identity"),
    ("36_six_mandatory_dispatches_restored", "dispatch_count_three"),
    ("37_explore_dispatch_buttons_restored", "explore_dispatch_unreachable"),
    ("38_dispatch_without_receipt_review", "predispatch_receipt_required"),
    ("39_dispatch_grouping_altered", "grouped_semantic_mapping"),
    ("40_obsolete_asset_hardcode_restored", "current_production_asset_owner"),
    ("41_new_failure_claimed_historical", "full_suite_failure_set"),
    ("42_broad_screenshot_receipt_only", "broad_visual_state"),
    ("43_brcg_panel_offscreen", "brcg_visual_state"),
    ("44_case_preview_fixture_record_count", "case_preview_shared_count_owner"),
    ("45_receipt_stage_index_count", "receipt_shared_count_owner"),
    ("46_second_receipt_2_to_3", "exact_count_summary"),
    ("47_third_receipt_4_to_1", "exact_count_summary"),
    ("48_retired_dispatch_returns_to_source", "retired_command_absent"),
    ("49_six_retired_restore_stage6", "legacy_save_fail_closed"),
    ("50_build_or_map_contains_retired_dispatch", "build_retired_marker_absent"),
    ("51_receipt_screenshot_stage_index_counts", "receipt_visual_state"),
]


def expected_results() -> dict:
    return {
        "clean": "PASS", "probeCount": len(PROBES), "allFailedClosed": True,
        "probes": [{"id": probe, "result": "VERIFIER_REJECTED", "intendedReason": intended, "verifierExit": 1} for probe, intended in PROBES],
    }


def load(root: Path, rel: str):
    return json.loads((root / rel).read_text(encoding="utf-8"))


def save(root: Path, rel: str, value: object) -> None:
    path = root / rel
    temporary = path.with_name(path.name + ".probe")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def append(path: Path, value: bytes) -> None:
    path.write_bytes(path.read_bytes() + value)


def mutate_runtime(root: Path, probe: str) -> None:
    runtime = load(root, "RUNTIME/s13-runtime.json")
    if probe == "01_total_101_changes": runtime["metrics"]["callAtlasReceipts"] = 100
    elif probe == "02_duplicate_receipt_id": runtime["callAtlas"][1]["publicCallId"] = runtime["callAtlas"][0]["publicCallId"]
    elif probe == "03_overlay_lost": next(row for row in runtime["callAtlas"] if row["sourceCampaign"] == "E03")["acceptanceStatus"] = "PENDING"
    elif probe == "04_classification_changes": next(row for row in runtime["callAtlas"] if row["sourceCampaign"] == "E03" and row["curatedEvidenceAcceptanceStatus"] == "ACCEPTED_BY_CHATGPT_MAIN_LEAD")["curatedEvidenceAcceptanceStatus"] = "NOT_APPLICABLE_CALL_ATLAS_RECEIPT_ONLY"
    elif probe == "05_receipt_only_enters_corpus": runtime["caseCorpus"][0]["sourcePublicCallId"] = next(row for row in runtime["callAtlas"] if row["curatedEvidenceAcceptanceStatus"] == "NOT_APPLICABLE_CALL_ATLAS_RECEIPT_ONLY")["publicCallId"]
    elif probe == "06_corpus_total_or_id_changes": runtime["caseCorpus"].append(dict(runtime["caseCorpus"][0]))
    elif probe == "07_prebrief_leaks_record": runtime["prebrief"].update({"individualRecordsIncluded": True, "record": "HERO.EXACT_CONVERGENCE"})
    elif probe == "08_case_gate_bypassed": runtime["caseFileGate"]["clueIds"] = []
    elif probe == "09_delta_count_changes": runtime["evidenceDelta"]["stages"][2]["newCount"] = 75
    elif probe == "10_survivor_changes": runtime["evidenceDelta"]["stages"][-1]["survivingRecordIds"] = ["TGM.0bfe8fe9f886fa29"]
    elif probe == "11_contextual_fills_slot": runtime["proof"]["contextualCorroboration"]["fillsProofSlots"] = ["LINK"]
    elif probe == "12_exact_grade_downgraded": runtime["proof"]["exactRecord"]["evidenceGradeCeiling"] = "CONTEXTUAL"
    elif probe == "13_e02_enters_base": runtime["brcg"]["e02RowsIncluded"] = True
    elif probe == "14_brcg_global_absence": runtime["brcg"]["boundedNoMatch"]["establishesGlobalAbsence"] = True
    elif probe == "15_private_or_stripped_field": runtime["privatePath"] = "/path/to/local-user/private/provider-body.json"
    elif probe == "16_runtime_provider_request": runtime["productionBoundary"]["runtimeProviderCalls"] = 1
    elif probe == "17_r55_or_ending_active": runtime["productionBoundary"].update({"r55DialogueActive": True, "endingActive": True, "mission02Active": True})
    elif probe == "20_accepted_input_hash_changes": runtime["sourceHashes"]["PUBLIC/call_atlas_final_accepted.json"] = "0" * 64
    else: raise ValueError(probe)
    save(root, "RUNTIME/s13-runtime.json", runtime)


def replace_source(root: Path, rel: str, old: str, new: str, *, all_occurrences: bool = False) -> None:
    path = root / "SOURCE" / rel
    text = path.read_text(encoding="utf-8")
    if old not in text: raise RuntimeError(f"probe token missing: {rel}: {old}")
    path.write_text(text.replace(old, new, -1 if all_occurrences else 1), encoding="utf-8")


def mutate(root: Path, probe: str) -> None:
    if (probe[:2].isdigit() and int(probe[:2]) <= 17) or probe == "20_accepted_input_hash_changes": mutate_runtime(root, probe); return
    if probe == "18_candidate_patch_substituted": append(root / "GIT/CANDIDATE.patch", b"\nsubstituted\n"); return
    if probe == "19_git_bundle_corrupted":
        path = root / "GIT/candidate.bundle"; data = bytearray(path.read_bytes()); data[len(data) // 2] ^= 1; path.write_bytes(data); return
    if probe == "21_raw_log_deleted": (root / "LOGS/unit-focused.txt").unlink(); return
    if probe == "22_capability_override_disables_investigation": replace_source(root, "src/investigation/state.ts", "export function terminalCapabilities", "if (fixture.s13 && state.access) { /* blanket override */ }\nexport function terminalCapabilities"); return
    if probe == "23_exact_proof_auto_rendered": replace_source(root, "src/investigation/state.ts", "S13_VERIFY_RECORD", "S13_AUTO_PROOF", all_occurrences=True); return
    if probe == "24_contextual_tgm_fills_slot": replace_source(root, "src/investigation/state.ts", "Contextual evidence cannot fill AMOUNT, RECEIVER, or LINK.", "Contextual evidence may fill LINK."); return
    if probe == "25_brcg_direct_solver_visible": replace_source(root, "src/app/S13IntegratedCorpus.tsx", "sideLeadUnlocked && <S13Brcg", "true && <S13Brcg"); return
    if probe == "26_selected_persistence_uses_record_id": replace_source(root, "src/investigation/state.ts", "caseCorpus.map(record => record.recordId)", "caseCorpus.map(record => record.id)"); return
    if probe == "27_synthetic_retains_s13_clues": replace_source(root, "src/investigation/fixture.ts", "fixture.startingClueIds = fixture.startingClueIds.filter", "fixture.startingClueIds = fixture.startingClueIds.map"); return
    if probe == "28_broad_pool_exposes_hero":
        path = root / "SOURCE/src/app/S13IntegratedCorpus.tsx"; path.write_text(path.read_text(encoding="utf-8") + "\n// <h3>{record.recordId}</h3>\n", encoding="utf-8"); return
    if probe == "29_patch_replaced_receipt_updated":
        path = root / "GIT/CANDIDATE.patch"; append(path, b"\nreplacement with refreshed receipt\n"); state = load(root, "GIT_STATE.json"); state["patchSha256"] = hashlib.sha256(path.read_bytes()).hexdigest(); save(root, "GIT_STATE.json", state); return
    if probe == "30_bundle_corrupted_receipt_updated":
        path = root / "GIT/candidate.bundle"; data = bytearray(path.read_bytes()); data[-32] ^= 1; path.write_bytes(data); state = load(root, "GIT_STATE.json"); state["candidateBundleSha256"] = hashlib.sha256(path.read_bytes()).hexdigest(); save(root, "GIT_STATE.json", state); return
    if probe == "31_production_app_deleted": (root / "PRODUCTION/app.js").unlink(); return
    if probe == "32_marker_logs_receipts_updated":
        decisions = load(root, "TEST_DECISIONS.json")
        for row in decisions["testsRun"]:
            path = root / row["log"]; path.write_text("COMMAND=fake\nSTART_UTC=fake\nEND_UTC=fake\nRUNTIME_SECONDS=0\nEXIT=0\nPASS\n", encoding="utf-8"); row["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        save(root, "TEST_DECISIONS.json", decisions); return
    if probe == "33_probe_results_fabricated": results = load(root, "NEGATIVE_PROBE_RESULTS.json"); results["probes"][0]["result"] = "FABRICATED_PASS"; save(root, "NEGATIVE_PROBE_RESULTS.json", results); return
    if probe == "34_candidate_tree_replaced": state = load(root, "GIT_STATE.json"); state.update({"candidate": "1" * 40, "tree": "2" * 40}); save(root, "GIT_STATE.json", state); return
    if probe == "35_proof_screenshot_replaced_by_ledger": shutil.copy2(root / "PROBE_CONTROLS/ledger.png", root / "SCREENSHOTS/03-caseboard-completion-ready.png"); return
    if probe == "36_six_mandatory_dispatches_restored": receipt = load(root, "THREE_DISPATCH_QUERY_RECEIPT.json"); receipt["mandatoryDispatchCount"] = 6; save(root, "THREE_DISPATCH_QUERY_RECEIPT.json", receipt); return
    if probe == "37_explore_dispatch_buttons_restored":
        path = root / "SOURCE/src/app/S13IntegratedCorpus.tsx"; path.write_text(path.read_text(encoding="utf-8") + "\n// DISPATCH QUESTION\n", encoding="utf-8"); return
    if probe == "38_dispatch_without_receipt_review": replace_source(root, "src/investigation/state.ts", "if (state.reviewedReceipt !== before)", "if (state.reviewedReceipt === before)"); return
    if probe == "39_dispatch_grouping_altered": receipt = load(root, "THREE_DISPATCH_QUERY_RECEIPT.json"); receipt["groups"][1]["endStage"] = 5; save(root, "THREE_DISPATCH_QUERY_RECEIPT.json", receipt); return
    if probe == "40_obsolete_asset_hardcode_restored":
        path = root / "SOURCE/tests/unit/s12-p3-r55-registry.test.ts"; path.write_text(path.read_text(encoding="utf-8") + "\n// dist/assets/index-DBC_kJlO.js\n", encoding="utf-8"); return
    if probe == "41_new_failure_claimed_historical": report = load(root, "FULL_VITEST_FAILURE_SET_COMPARISON.json"); report["remainingFailures"].append({"test": "tests/unit/new-regression.test.ts > fails", "class": "HISTORICAL_EXTERNAL_ARCHIVE"}); save(root, "FULL_VITEST_FAILURE_SET_COMPARISON.json", report); return
    if probe == "42_broad_screenshot_receipt_only":
        shutil.copy2(root / "PROBE_CONTROLS/receipt-only.png", root / "SCREENSHOTS/01-broad-neutral-corpus.png"); visual = load(root, "SCREENSHOT_ASSERTIONS.json"); next(row for row in visual["screenshots"] if row["path"].endswith("01-broad-neutral-corpus.png"))["visibleMarkers"] = ["QUERY RECEIPT"]; save(root, "SCREENSHOT_ASSERTIONS.json", visual); return
    if probe == "43_brcg_panel_offscreen":
        shutil.copy2(root / "PROBE_CONTROLS/brcg-offscreen.png", root / "SCREENSHOTS/05-brcg-unlocked-by-back-read.png"); visual = load(root, "SCREENSHOT_ASSERTIONS.json"); row = next(row for row in visual["screenshots"] if row["path"].endswith("05-brcg-unlocked-by-back-read.png")); row["visibleMarkers"] = []; row["panelExpanded"] = False; save(root, "SCREENSHOT_ASSERTIONS.json", visual); return
    if probe == "44_case_preview_fixture_record_count":
        replace_source(root, "src/app/CaseTerminalWorkbench.tsx", "s13Summary.inputCount} corpus records → ${s13Summary.outputCount", "fixture.records.length} corpus records → ${s13Summary.outputCount"); return
    if probe == "45_receipt_stage_index_count":
        replace_source(root, "src/app/CaseTerminalWorkbench.tsx", "s13Summary?.inputCount ?? fixture.records.length", "state.s13FilterStage"); return
    if probe == "46_second_receipt_2_to_3":
        counts = load(root, "EXACT_COUNT_SUMMARY_RECEIPT.json"); counts["groups"][1].update({"inputCount": 2, "summary": "2 corpus records → 3 matches"}); save(root, "EXACT_COUNT_SUMMARY_RECEIPT.json", counts); return
    if probe == "47_third_receipt_4_to_1":
        counts = load(root, "EXACT_COUNT_SUMMARY_RECEIPT.json"); counts["groups"][2].update({"inputCount": 4, "summary": "4 corpus records → 1 match"}); save(root, "EXACT_COUNT_SUMMARY_RECEIPT.json", counts); return
    if probe == "48_retired_dispatch_returns_to_source":
        path = root / "SOURCE/src/investigation/state.ts"; path.write_text(path.read_text(encoding="utf-8") + "\n// S13_DISPATCH_QUESTION\n", encoding="utf-8"); return
    if probe == "49_six_retired_restore_stage6":
        legacy = load(root, "LEGACY_SAVE_RECEIPT.json"); legacy["sixRetiredEntries"].update({"restoredStage": 6, "atomicCleanInitial": False}); save(root, "LEGACY_SAVE_RECEIPT.json", legacy); return
    if probe == "50_build_or_map_contains_retired_dispatch":
        append(root / "PRODUCTION/app.js", b"\n// S13_DISPATCH_QUESTION\n"); return
    if probe == "51_receipt_screenshot_stage_index_counts":
        shutil.copy2(root / "PROBE_CONTROLS/stage-index-receipt.png", root / "SCREENSHOTS/06-exact-count-query-receipt.png"); visual = load(root, "SCREENSHOT_ASSERTIONS.json"); row = next(row for row in visual["screenshots"] if row["path"].endswith("06-exact-count-query-receipt.png")); row["visibleMarkers"] = ["2 corpus records → 3 matches"]; save(root, "SCREENSHOT_ASSERTIONS.json", visual); return
    raise ValueError(probe)


def manifest(root: Path) -> None:
    rows = [f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(root).as_posix()}" for path in sorted(item for item in root.rglob("*") if item.is_file() and item.name != "MANIFEST.sha256")]
    (root / "MANIFEST.sha256").write_text("\n".join(rows) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent); parser.add_argument("--initialize", action="store_true")
    args = parser.parse_args(); root = args.root.resolve(); expected = expected_results()
    if args.initialize:
        save(root, "NEGATIVE_PROBE_RESULTS.json", expected); print(f"INITIALIZED S13_R3_NEGATIVE_PROBES {len(PROBES)}"); return
    if load(root, "NEGATIVE_PROBE_RESULTS.json") != expected: raise SystemExit("negative probe receipt is not the fixed executable expectation")
    with tempfile.TemporaryDirectory(prefix="s13-r3-negative-probes-") as temporary:
        for probe, intended in PROBES:
            target = Path(temporary) / probe; shutil.copytree(root, target); mutate(target, probe); manifest(target)
            result = subprocess.run([sys.executable, str(target / "VERIFY_DELIVERY.py")], text=True, capture_output=True); output = result.stdout + result.stderr
            if result.returncode == 0 or intended not in output: raise SystemExit(f"probe false success {probe} intended={intended}\n{output}")
    clean = subprocess.run([sys.executable, str(root / "VERIFY_DELIVERY.py")], text=True, capture_output=True)
    if clean.returncode: raise SystemExit(clean.stdout + clean.stderr)
    print(f"PASS S13_R3_NEGATIVE_PROBES {len(PROBES)}")


if __name__ == "__main__":
    main()
