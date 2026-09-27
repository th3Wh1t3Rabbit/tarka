#!/usr/bin/env python3
"""Run isolated fail-closed mutations required by S12-P4."""

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
    ("01_third_title_control", "title_control_set"),
    ("02_renamed_play", "title_exact_copy"),
    ("03_renamed_credits", "title_exact_copy"),
    ("04_exposed_continue", "forbidden_controls:CONTINUE"),
    ("05_exposed_save", "forbidden_controls:SAVE"),
    ("06_exposed_load", "forbidden_controls:LOAD"),
    ("07_exposed_settings", "forbidden_controls:SETTINGS"),
    ("08_exposed_accessibility", "forbidden_controls:ACCESSIBILITY"),
    ("09_exposed_plain_list", "forbidden_controls:PLAIN_LIST"),
    ("10_play_resumes_stale", "fresh_reset"),
    ("11_play_again_preserves_owner", "play_again_reset"),
    ("12_wrong_credits_focus", "credits_return_focus"),
    ("13_public_trace_title", "public_identity"),
    ("14_alternate_terminal_selector", "terminal_fullscreen"),
    ("15_room_visible_behind_crt", "terminal_exclusive"),
    ("16_production_opens_r55", "production_nonactivation"),
    ("17_r55_registry_import", "r55_production_import"),
    ("18_final_data_activation", "final_data_activation"),
    ("19_mission02_activation", "mission02_activation"),
    ("20_substitute_patch", "sealed_payload:GIT/CANDIDATE.patch"),
    ("21_corrupt_bundle", "sealed_payload:GIT/candidate.bundle"),
    ("22_restore_unsupported_contributor_copy", "unsupported_contributor_copy"),
    ("23_insert_unsupported_contributor_name", "credits_contributor_state"),
    ("24_alter_data_line_without_provenance", "credits_data_copy"),
    ("25_delete_credits_provenance", "evidence_missing:CREDITS_PROVENANCE.json"),
    ("26_replace_journey_with_debug_query", "journey_debug_shortcut"),
    ("27_delete_journey_attachments", "journey_attachments"),
    ("28_remove_authorization_interaction", "journey_authorization_interaction"),
    ("29_alter_e03_identity_and_totals", "s13_totals"),
    ("30_substitute_candidate_patch", "sealed_payload:GIT/CANDIDATE.patch"),
    ("31_corrupt_git_bundle", "sealed_payload:GIT/candidate.bundle"),
]


def write_bytes(path: Path, data: bytes) -> None:
    temporary = path.with_name(path.name + ".probe-tmp")
    temporary.write_bytes(data)
    temporary.replace(path)


def load(root: Path, rel: str) -> dict:
    return json.loads((root / rel).read_text(encoding="utf-8"))


def save(root: Path, rel: str, value: dict) -> None:
    write_bytes(root / rel, (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode())


def mutate(root: Path, probe: str) -> None:
    receipt = load(root, "TITLE_CREDITS_NAVIGATION.json")
    if probe == "01_third_title_control": receipt["controls"].append("OPTIONS")
    elif probe == "02_renamed_play": receipt["exactTitleLines"][6] = "[ BEGIN ]"
    elif probe == "03_renamed_credits": receipt["exactTitleLines"][7] = "ABOUT"
    elif probe.startswith(("04_", "05_", "06_", "07_", "08_", "09_")):
        key = {"04": "CONTINUE", "05": "SAVE", "06": "LOAD", "07": "SETTINGS", "08": "ACCESSIBILITY", "09": "PLAIN_LIST"}[probe[:2]]
        receipt["forbiddenControls"][key] = True
    elif probe == "10_play_resumes_stale": receipt["freshReset"]["staleResume"] = True
    elif probe == "11_play_again_preserves_owner": receipt["freshReset"]["playAgainPreservesOwner"] = True
    elif probe == "12_wrong_credits_focus": receipt["credits"]["titleFocusRestoresTo"] = "PLAY"
    elif probe == "13_public_trace_title": receipt["publicTraceEscapeTitle"] = True
    elif probe == "14_alternate_terminal_selector": receipt["terminal"]["alternateSelector"] = True
    elif probe == "15_room_visible_behind_crt": receipt["terminal"]["roomVisibleBehindCrt"] = True
    elif probe == "16_production_opens_r55":
        value = load(root, "PRODUCTION_NON_ACTIVATION.json"); value["ordinaryProductionOpensR55Harness"] = True; save(root, "PRODUCTION_NON_ACTIVATION.json", value); return
    elif probe in {"17_r55_registry_import", "18_final_data_activation", "19_mission02_activation"}:
        marker = {"17_r55_registry_import": b"\nr55-registry r55Review\n", "18_final_data_activation": b"\nHERO.EXACT_CONVERGENCE\n", "19_mission02_activation": b"\nCASE FILE 02 FUTURE ACCESS\n"}[probe]
        path = root / "PRODUCTION/app.js"; blob = path.read_bytes() + marker; write_bytes(path, blob)
        value = load(root, "PRODUCTION_NON_ACTIVATION.json"); value["sha256"] = hashlib.sha256(blob).hexdigest(); value["bytes"] = len(blob); save(root, "PRODUCTION_NON_ACTIVATION.json", value); return
    elif probe in {"20_substitute_patch", "30_substitute_candidate_patch"}:
        path = root / "GIT/CANDIDATE.patch"; write_bytes(path, path.read_bytes() + b"\nsubstitute patch\n"); return
    elif probe in {"21_corrupt_bundle", "31_corrupt_git_bundle"}:
        path = root / "GIT/candidate.bundle"; blob = bytearray(path.read_bytes()); blob[len(blob) // 2] ^= 1; write_bytes(path, bytes(blob)); return
    elif probe == "22_restore_unsupported_contributor_copy":
        path = root / "PRODUCTION/app.js"; blob = path.read_bytes() + b"\nTRACE ESCAPE CODEX \xc2\xb7 TRACE ESCAPE CURSOR\n"; write_bytes(path, blob)
        value = load(root, "PRODUCTION_NON_ACTIVATION.json"); value["sha256"] = hashlib.sha256(blob).hexdigest(); value["bytes"] = len(blob); save(root, "PRODUCTION_NON_ACTIVATION.json", value); return
    elif probe == "23_insert_unsupported_contributor_name":
        receipt["credits"]["contributors"] = ["UNSUPPORTED NAME"]
    elif probe == "24_alter_data_line_without_provenance":
        receipt["credits"]["dataSources"][1] = "ETHEREUM MAINNET"
    elif probe == "25_delete_credits_provenance":
        (root / "CREDITS_PROVENANCE.json").unlink(); return
    elif probe == "26_replace_journey_with_debug_query":
        value = load(root, "JOURNEY/command.json"); value["argv"].append("/?skipIntro=1"); save(root, "JOURNEY/command.json", value); return
    elif probe == "27_delete_journey_attachments":
        for path in (root / "JOURNEY/results").rglob("*"):
            if path.is_file() and (path.suffix == ".png" or path.name == "trace.zip"): path.unlink()
        return
    elif probe == "28_remove_authorization_interaction":
        path = root / "GIT/CANDIDATE.patch"; write_bytes(path, path.read_bytes().replace(b"signed-terminal-authorization-form-with-doodles", b"removed-authorization-interaction")); return
    elif probe == "29_alter_e03_identity_and_totals":
        value = load(root, "S13_INPUT_MAP.json"); value["sourceArchive"]["sha256"] = "0" * 64; value["totals"]["semanticRecords"] = 226; save(root, "S13_INPUT_MAP.json", value); return
    else: raise ValueError(probe)
    save(root, "TITLE_CREDITS_NAVIGATION.json", receipt)


def regenerate_manifest(root: Path) -> None:
    rows = [f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(root).as_posix()}" for path in sorted(item for item in root.rglob("*") if item.is_file() and item.name != "MANIFEST.sha256")]
    write_bytes(root / "MANIFEST.sha256", ("\n".join(rows) + "\n").encode())


def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent); args = parser.parse_args()
    root = args.root.resolve(); results = []
    with tempfile.TemporaryDirectory(prefix="s12-p4-probes-") as temporary:
        for probe, intended in PROBES:
            target = Path(temporary) / probe; shutil.copytree(root, target)
            mutate(target, probe); regenerate_manifest(target)
            run = subprocess.run([sys.executable, str(target / "VERIFY_DELIVERY.py")], text=True, capture_output=True)
            output = run.stdout + run.stderr
            if run.returncode == 0 or intended not in output:
                raise SystemExit(f"probe false success {probe} exit={run.returncode} intended={intended}\n{output}")
            results.append({"id": probe, "result": "VERIFIER_REJECTED", "intendedReason": intended, "exit": 1})
    save(root, "NEGATIVE_PROBE_RESULTS.json", {"clean": "PASS", "probeCount": len(results), "allFailedClosed": True, "probes": results})
    regenerate_manifest(root)
    clean = subprocess.run([sys.executable, str(root / "VERIFY_DELIVERY.py")], text=True, capture_output=True)
    if clean.returncode:
        raise SystemExit(f"clean verification failed\n{clean.stdout}{clean.stderr}")
    print(f"PASS S12_P4_NEGATIVE_PROBES {len(results)}")


if __name__ == "__main__":
    main()
