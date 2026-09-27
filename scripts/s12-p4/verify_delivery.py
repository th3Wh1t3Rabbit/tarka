#!/usr/bin/env python3
"""Fixed-hash and semantic verifier for the S12-P4-R1 delivery."""

from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LIVE_REPO = Path("/tmp/trace-escape-s10-p1")
EXPECTED_PARENT = "50556f6a0387a75da2db194a9486294bf95228e5"
EXPECTED_PARENT_TREE = "5c7f01e403a06e82fa5a98db4c4dfdfcdacdf486"
EXPECTED_CANONICAL = "2bbf06d61dfaebd99aafa7d6c9e25812e2e8b47b"
EXPECTED_PRIMARY = "0f52131c9f56f49128e7a413396331917e687a1f"

# package_delivery.py replaces this exact literal after every claim-bearing byte exists.
EXPECTED_SHA256: dict[str, str] = {}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load(rel: str, findings: list[str]) -> dict:
    try:
        value = json.loads((ROOT / rel).read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise ValueError("object required")
        return value
    except Exception:
        findings.append(f"evidence_missing:{rel}")
        return {}


def manifest_and_seals(findings: list[str]) -> None:
    manifest_path = ROOT / "MANIFEST.sha256"
    if not manifest_path.is_file():
        findings.append("manifest_missing")
        return
    expected_rows = []
    for path in sorted(item for item in ROOT.rglob("*") if item.is_file() and item.name != "MANIFEST.sha256"):
        expected_rows.append(f"{sha(path.read_bytes())}  {path.relative_to(ROOT).as_posix()}")
    if manifest_path.read_text(encoding="utf-8").splitlines() != expected_rows:
        findings.append("manifest_mismatch")
    for rel, expected in EXPECTED_SHA256.items():
        path = ROOT / rel
        if not path.is_file() or sha(path.read_bytes()) != expected:
            findings.append(f"sealed_payload:{rel}")


def verify_product(findings: list[str]) -> None:
    receipt = load("TITLE_CREDITS_NAVIGATION.json", findings)
    exact = [
        "TARKA", "A PIXEL RETRO", "NANSEN INVESTIGATION", "CREATED FOR THE",
        "NANSEN MERIDIAN BUILDATHON", "SEPTEMBER 14–27, 2026", "[ PLAY ]",
        "CREDITS", "POWERED BY NANSEN API",
    ]
    if receipt.get("exactTitleLines") != exact:
        findings.append("title_exact_copy")
    if receipt.get("controls") != ["PLAY", "CREDITS"]:
        findings.append("title_control_set")
    forbidden = receipt.get("forbiddenControls", {})
    for key in ("CONTINUE", "SAVE", "LOAD", "SETTINGS", "OPTIONS", "ACCESSIBILITY", "PLAIN_LIST"):
        if forbidden.get(key) is not False:
            findings.append(f"forbidden_controls:{key}")
    if receipt.get("browserTitle") != "Tarka — A Pixel Retro Nansen Investigation" or receipt.get("publicWordmark") != "TARKA" or receipt.get("publicTraceEscapeTitle") is not False:
        findings.append("public_identity")
    reset = receipt.get("freshReset", {})
    if reset.get("playOwner") != "FULL_FRESH_RESET" or reset.get("playAgainOwner") != "FULL_FRESH_RESET" or reset.get("staleResume") is not False or reset.get("keyedRemount") is not True:
        findings.append("fresh_reset")
    if reset.get("playAgainPreservesOwner") is not False:
        findings.append("play_again_reset")
    credits = receipt.get("credits", {})
    if credits.get("returnToOpener") is not True or credits.get("titleFocusRestoresTo") != "CREDITS" or credits.get("escapeBack") is not True:
        findings.append("credits_return_focus")
    expected_sources = ["NANSEN API", "ETHEREUM", "EULER FINANCE · MARCH 13, 2023", "FROZEN HISTORICAL CASE SNAPSHOT"]
    if credits.get("contributors") != [] or credits.get("contributorDisposition") != "CONTRIBUTOR_METADATA_NOT_YET_BOUND":
        findings.append("credits_contributor_state")
    if credits.get("dataSources") != expected_sources:
        findings.append("credits_data_copy")
    provenance = load("CREDITS_PROVENANCE.json", findings)
    if provenance.get("contributors") != [] or provenance.get("contributorDisposition") != "CONTRIBUTOR_METADATA_NOT_YET_BOUND":
        findings.append("credits_contributor_provenance")
    sections = provenance.get("sections", {})
    visible = [*sections.get("createdFor", []), *sections.get("poweredBy", []), *[line for line in sections.get("dataSources", []) if line != "NANSEN API"], sections.get("aboutTitle")]
    bindings = provenance.get("bindings", [])
    if [row.get("visibleLine") for row in bindings] != visible or sections.get("dataSources") != expected_sources:
        findings.append("credits_provenance_binding")
    for row in bindings:
        if len(row.get("sourceSha256", "")) != 64 or not row.get("sourcePath") or not row.get("sourceFieldOrLine") or not row.get("claimBoundary"):
            findings.append("credits_provenance_binding")
    source = (ROOT / "PRODUCTION/app.js").read_text(encoding="utf-8", errors="replace") if (ROOT / "PRODUCTION/app.js").is_file() else ""
    if "TRACE ESCAPE CODEX · TRACE ESCAPE CURSOR" in source:
        findings.append("unsupported_contributor_copy")
    terminal = receipt.get("terminal", {})
    if terminal.get("presentation") != "FULLSCREEN_CRT_ONLY" or terminal.get("logicalViewport") != "480x270" or terminal.get("alternateSelector") is not False:
        findings.append("terminal_fullscreen")
    if terminal.get("roomVisibleBehindCrt") is not False or terminal.get("interfaceVisibleBehindCrt") is not False or terminal.get("characterDialogueOverTerminal") is not False:
        findings.append("terminal_exclusive")
    if receipt.get("productionModel") != "ONE_ROOT_APPLICATION_STATE_MODEL" or receipt.get("mainMenuTarget") != "TARKA_TITLE_SCREEN":
        findings.append("one_game_structure")

    nonactivation = load("PRODUCTION_NON_ACTIVATION.json", findings)
    app = ROOT / "PRODUCTION/app.js"
    blob = app.read_bytes() if app.is_file() else b""
    text = blob.decode("utf-8", errors="replace")
    if sha(blob) != nonactivation.get("sha256") or nonactivation.get("bytes") != len(blob):
        findings.append("production_artifact")
    if "TARKA" not in text or "A PIXEL RETRO" not in text:
        findings.append("production_title_missing")
    if "r55-registry" in text or "r55Review" in text:
        findings.append("r55_production_import")
    if "mathematically precise haystack" in text or "HERO.EXACT_CONVERGENCE" in text:
        findings.append("final_data_activation")
    if "CASE FILE 02" in text or "FUTURE ACCESS" in text:
        findings.append("mission02_activation")
    if nonactivation.get("ordinaryProductionOpensR55Harness") is not False:
        findings.append("production_nonactivation")


def verify_s13(findings: list[str]) -> None:
    readiness = load("S13_READINESS.json", findings)
    expected = {
        "acceptedCallAtlasReceipts": 101,
        "semanticRecords": 227,
        "postCaseFilterSequence": "98 → 98 → 74 → 3 → 2 → 1",
        "heroRecord": "HERO.EXACT_CONVERGENCE",
        "r55CountSlots": [98, 3, 2],
        "providerActivity": 0,
        "accountActivity": 0,
        "credentialActivity": 0,
    }
    if any(readiness.get(key) != value for key, value in expected.items()):
        findings.append("s13_readiness_values")
    if readiness.get("status") != "EXACT_INPUT_RECOVERED_READ_ONLY" or readiness.get("s13Started") is not False:
        findings.append("s13_scope_boundary")
    input_map = load("S13_INPUT_MAP.json", findings)
    archive = input_map.get("sourceArchive", {})
    if archive != {"path": "/path/to/local-user/.codex/.chatgpt-projects/g-p-6aa88bc298e481919617a14c6b893825/TRACE_ESCAPE_E03_R4_E02_TEMPORAL_SEAL_AND_INTEGRATION_PATH_FINALIZATION_DELIVERY_v1.0.0_2026-09-21.zip", "sha256": "675f4c437cd4830e6f627189fb19c9f95f97fb7bc1e3ae153ecd8e42b96c1c8d", "bytes": 171247, "members": 42}:
        findings.append("s13_archive_identity")
    totals = input_map.get("totals", {})
    if totals != {"callAtlasReceipts": 101, "semanticRecords": 227, "filterSequence": [98, 98, 74, 3, 2, 1], "exactSurvivor": "HERO.EXACT_CONVERGENCE", "r55CountSlots": [98, 3, 2]}:
        findings.append("s13_totals")
    for row in input_map.get("inputs", []):
        path = ROOT / row.get("deliveryPath", "")
        if not path.is_file() or sha(path.read_bytes()) != row.get("sha256") or path.stat().st_size != row.get("bytes") or not row.get("semanticRole"):
            findings.append("s13_input_identity")
    atlas = load("S13_INPUTS/PUBLIC/call_atlas_final_accepted.json", findings)
    corpus = load("S13_INPUTS/PUBLIC/case_corpus_final_accepted.json", findings)
    delta = load("S13_INPUTS/PUBLIC/evidence_delta_sequence_final_accepted.json", findings)
    if atlas.get("totals", {}).get("publicCallAtlasReceipts") != 101 or corpus.get("semanticRecordCount") != 227:
        findings.append("s13_totals")
    if [row.get("newCount") for row in delta.get("stages", [])] != [98, 98, 74, 3, 2, 1] or delta.get("stages", [{}])[-1].get("survivingRecordIds") != ["HERO.EXACT_CONVERGENCE"]:
        findings.append("s13_totals")


def verify_git(findings: list[str]) -> None:
    state = load("GIT_STATE.json", findings)
    if state.get("parent") != EXPECTED_PARENT or state.get("parentTree") != EXPECTED_PARENT_TREE or state.get("parentCount") != 1 or state.get("posture") != "DETACHED_HEAD":
        findings.append("git_lineage")
    if state.get("canonical") != EXPECTED_CANONICAL or state.get("protectedPrimary") != EXPECTED_PRIMARY:
        findings.append("protected_refs")
    if state.get("patchSha256") != sha((ROOT / "GIT/CANDIDATE.patch").read_bytes()):
        findings.append("git_patch_receipt")
    if state.get("bundleSha256") != sha((ROOT / "GIT/candidate.bundle").read_bytes()):
        findings.append("git_bundle_receipt")
    excluded = load("EXCLUDED_EFFECTS.json", findings)
    if not excluded or any(value != 0 for value in excluded.values()):
        findings.append("excluded_effects")
    bundle = ROOT / "GIT/candidate.bundle"
    if LIVE_REPO.is_dir() and bundle.is_file():
        result = subprocess.run(["git", "-C", str(LIVE_REPO), "bundle", "verify", str(bundle)], text=True, capture_output=True)
        if result.returncode:
            findings.append("git_bundle_recovery")
        with tempfile.TemporaryDirectory(prefix="s12-p4-verify-") as temporary:
            bare = Path(temporary) / "recovered.git"
            commands = [
                ["git", "init", "--bare", str(bare)],
                ["git", "-C", str(bare), "fetch", str(LIVE_REPO), f"{EXPECTED_PARENT}:refs/heads/base"],
                ["git", "-C", str(bare), "fetch", str(bundle), "HEAD:refs/heads/candidate"],
            ]
            for command in commands:
                done = subprocess.run(command, text=True, capture_output=True)
                if done.returncode:
                    findings.append("git_bundle_recovery")
                    break
            else:
                parent = subprocess.run(["git", "-C", str(bare), "show", "-s", "--format=%P", "refs/heads/candidate"], text=True, capture_output=True).stdout.strip()
                tree = subprocess.run(["git", "-C", str(bare), "rev-parse", "refs/heads/candidate^{tree}"], text=True, capture_output=True).stdout.strip()
                if parent != EXPECTED_PARENT or tree != state.get("tree"):
                    findings.append("git_bundle_recovery")


def verify_tests(findings: list[str]) -> None:
    decisions = load("TEST_DECISIONS.json", findings)
    rows = {row.get("log"): row for row in decisions.get("testsRun", [])}
    for rel in ("LOGS/unit.txt", "LOGS/credits-playwright.txt", "LOGS/terminal-playwright.txt", "LOGS/typecheck.txt", "LOGS/lint.txt", "LOGS/build.txt"):
        path = ROOT / rel
        text = path.read_text(encoding="utf-8") if path.is_file() else ""
        row = rows.get(rel, {})
        if not all(token in text for token in ("COMMAND=", "START_UTC=", "END_UTC=", "RUNTIME_SECONDS=", "EXIT=0", "TOTALS=")) or row.get("exit") != 0 or row.get("sha256") != sha(text.encode()) or not row.get("purpose"):
            findings.append(f"test_evidence:{rel}")
    if not decisions.get("testsNotRun") or not (ROOT / "TESTS_NOT_RUN.md").read_text(encoding="utf-8").strip():
        findings.append("tests_not_run")
    probes = load("NEGATIVE_PROBE_RESULTS.json", findings)
    if probes.get("clean") != "PASS" or probes.get("allFailedClosed") is not True or probes.get("probeCount") != len(probes.get("probes", [])) or probes.get("probeCount", 0) < 31:
        findings.append("negative_probe_results")
    report_path = ROOT / "JOURNEY/playwright-report.json"
    command = load("JOURNEY/command.json", findings)
    try: report = json.loads(report_path.read_text(encoding="utf-8"))
    except Exception: report = {}; findings.append("journey_report")
    argv = command.get("argv", [])
    if command.get("exit") != 0 or command.get("runtimeSeconds", 0) <= 0 or command.get("cwd") != str(LIVE_REPO) or "--reporter=json" not in argv or "--trace=on" not in argv:
        findings.append("journey_command")
    joined = " ".join(argv)
    if any(token in joined for token in ("review=1", "skipIntro=1", "r55Review=1")):
        findings.append("journey_debug_shortcut")
    report_text = json.dumps(report)
    if "production title reaches authorized fullscreen CRT through ordinary controls" not in report_text or '"status": "passed"' not in report_text:
        findings.append("journey_report")
    attachments = list((ROOT / "JOURNEY/results").rglob("*")) if (ROOT / "JOURNEY/results").is_dir() else []
    names = [path.name for path in attachments if path.is_file()]
    if not any("title" in name for name in names) or not any("authorization" in name for name in names) or not any("fullscreen-crt" in name for name in names) or "trace.zip" not in names:
        findings.append("journey_attachments")
    patch = (ROOT / "GIT/CANDIDATE.patch").read_text(encoding="utf-8", errors="replace")
    for interaction in ("blank-authorization-form", "pen-stand", "loose-feather-pen", "signed-terminal-authorization-form-with-doodles", "hotspot-nansen-terminal"):
        if interaction not in patch: findings.append("journey_authorization_interaction")


def verify() -> list[str]:
    findings: list[str] = []
    manifest_and_seals(findings)
    verify_product(findings)
    verify_s13(findings)
    verify_git(findings)
    verify_tests(findings)
    return list(dict.fromkeys(findings))


if __name__ == "__main__":
    failures = verify()
    if failures:
        print("FAIL")
        print("\n".join(failures))
        raise SystemExit(1)
    print("PASS S12_P4_DELIVERY")
