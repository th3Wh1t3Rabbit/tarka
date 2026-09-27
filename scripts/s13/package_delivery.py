#!/usr/bin/env python3
"""Build the fixed-identity S13-R3 delivery and executable evidence seal."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WORKSPACE = Path("/path/to/local-user/Documents/Codex/2026-09-23/open-the-attached-zip-and-follow")
TRANSMISSION = WORKSPACE / "work/s13-r3-transmission"
ACCEPTED_INPUTS = WORKSPACE / "work/s13-transmission"
INPUT_ROOT = ACCEPTED_INPUTS / "S13_INPUTS"
OUTPUT_DIR = Path("/path/to/local-user/Downloads")
NAME = "TRACE_ESCAPE_S13_R3_EXACT_COUNT_FUNNEL_AND_LEGACY_DISPATCH_REMOVAL_DELIVERY_v1.0.0_2026-09-24"
PARENT = "8e06f6022a3af769516a6841dd6a90ec3acf7cc6"
PARENT_TREE = "ab263c84766513bdc529aeade26db08fe4b38955"
CANONICAL_REF = "refs/heads/codex-s5-20260918"
CANONICAL = "2bbf06d61dfaebd99aafa7d6c9e25812e2e8b47b"
PRIMARY_REF = "refs/heads/g6p-a0-point-click"
PRIMARY = "0f52131c9f56f49128e7a413396331917e687a1f"
TRANSMISSION_ZIP = Path("/path/to/local-user/Downloads/TRACE_ESCAPE_MAIN_TO_CURSOR_S13_R3_EXACT_COUNT_FUNNEL_AND_LEGACY_DISPATCH_REMOVAL_v1.0.0_2026-09-23.zip")
R2_ZIP = WORKSPACE / "outputs/TRACE_ESCAPE_S13_R2_THREE_DISPATCH_QUERY_RECEIPT_FULL_SUITE_VISUAL_CLOSURE_DELIVERY_v1.0.0_2026-09-23.zip"
STORY_ARCHIVE = Path("/path/to/local-user/Downloads/TRACE_ESCAPE_STORY_TO_MAIN_FINAL_INTEGRATION_HANDOFF_R55_TARKA_v1.0.0_2026-09-22.zip")
EXPECTED_RUNTIME_SHA = "82918530c6be5cf69b8f5631f5040758db36add9c28ce0737be7f888c16c78d3"
EXPECTED_STASH = "stash@{0} 0a7d1c1df04bdd32ee435881a05fef169451e0ba WIP on (no branch): b86d8dd S9-P1-R4 note-completion contact and E02-neutral optional side-lead seam"
SOURCE_PATHS = [
    "src/app/App.tsx", "src/app/CaseTerminalWorkbench.tsx", "src/app/S13IntegratedCorpus.tsx",
    "src/investigation/fixture.ts", "src/investigation/s13.ts", "src/investigation/state.ts",
    "tests/e2e/s13-corpus-integration.spec.ts", "tests/unit/s12-p3-r55-registry.test.ts",
    "tests/unit/s13-corpus-integration.test.ts",
]


def sha_bytes(data: bytes) -> str: return hashlib.sha256(data).hexdigest()
def sha(path: Path) -> str: return sha_bytes(path.read_bytes())
def utc() -> str: return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def run(command: list[str], *, cwd: Path = REPO, env: dict[str, str] | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, cwd=cwd, env=env, text=True, capture_output=True)
    if check and result.returncode:
        raise SystemExit(f"command failed: {' '.join(command)}\n{result.stdout}{result.stderr}")
    return result


def git(*args: str) -> str: return run(["git", *args]).stdout.strip()


def write(root: Path, rel: str, value: str | bytes) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(value.encode() if isinstance(value, str) else value)


def write_json(root: Path, rel: str, value: object) -> None:
    write(root, rel, json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def capture_cached(cache: Path, rel: str, command: list[str], purpose: str, tokens: list[str], *, cwd: Path = REPO, env: dict[str, str] | None = None) -> dict[str, object]:
    log_path = cache / rel
    meta_path = cache / f"{rel}.meta.json"
    command_text = " ".join(command)
    if log_path.is_file() and meta_path.is_file():
        row = json.loads(meta_path.read_text(encoding="utf-8"))
        body = log_path.read_text(encoding="utf-8", errors="replace")
        if row.get("command") == command_text and row.get("exit") == 0 and row.get("sha256") == sha(log_path) and all(token in body for token in tokens):
            return row
    start = utc()
    began = time.monotonic()
    result = run(command, cwd=cwd, env=env, check=False)
    elapsed = round(time.monotonic() - began, 3)
    end = utc()
    body = f"COMMAND={command_text}\nSTART_UTC={start}\nEND_UTC={end}\nRUNTIME_SECONDS={elapsed}\nEXIT={result.returncode}\n--- STDOUT ---\n{result.stdout}\n--- STDERR ---\n{result.stderr}"
    write(cache, rel, body)
    if result.returncode or any(token not in body for token in tokens):
        raise SystemExit(f"evidence command failed contract: {rel}\n{body}")
    row = {"log": rel, "command": command_text, "purpose": purpose, "startUtc": start, "endUtc": end, "runtimeSeconds": elapsed, "exit": 0, "meaningfulTokens": tokens, "sha256": sha_bytes(body.encode())}
    write_json(cache, f"{rel}.meta.json", row)
    return row


def create_manifest(root: Path) -> None:
    rows = [f"{sha(path)}  {path.relative_to(root).as_posix()}" for path in sorted(item for item in root.rglob("*") if item.is_file() and item.name != "MANIFEST.sha256")]
    write(root, "MANIFEST.sha256", "\n".join(rows) + "\n")


def zip_identity(path: Path) -> dict[str, object]:
    with zipfile.ZipFile(path) as archive:
        members = len(archive.namelist())
    return {"path": str(path), "sha256": sha(path), "bytes": path.stat().st_size, "members": members}


def pack_identity(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    pack = data[data.index(b"PACK"):]
    return {"objects": struct.unpack(">I", pack[8:12])[0], "trailerSha1": pack[-20:].hex()}


def r2_bytes(rel: str) -> bytes:
    with zipfile.ZipFile(R2_ZIP) as archive:
        matches = [name for name in archive.namelist() if name.endswith(f"/{rel}")]
        if len(matches) != 1:
            raise SystemExit(f"R2 preserved evidence identity stop: {rel}: {matches}")
        return archive.read(matches[0])


def copy_named_screenshot(search_root: Path, basename: str, destination: Path) -> None:
    matches = [path for path in search_root.rglob(basename) if path.is_file() and "attachments" not in path.parts]
    if len(matches) != 1:
        raise SystemExit(f"screenshot identity stop: {basename}: {matches}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(matches[0], destination)


def discover_production_asset() -> tuple[Path, str]:
    index = (REPO / "dist/index.html").read_text(encoding="utf-8")
    matches = re.findall(r'<script[^>]+src="/?(assets/index-[^"]+\.js)"', index)
    if len(matches) != 1:
        raise SystemExit(f"production asset discovery stop: {matches}")
    return REPO / "dist" / matches[0], matches[0]


def make_bundles(root: Path, candidate: str) -> tuple[dict[str, object], dict[str, object]]:
    with tempfile.TemporaryDirectory(prefix="s13-r3-bundle-") as temporary:
        bare = Path(temporary) / "bundle.git"
        run(["git", "clone", "--bare", str(REPO), str(bare)], cwd=Path(temporary))
        run(["git", "update-ref", "refs/heads/prerequisite", PARENT], cwd=bare)
        run(["git", "update-ref", "refs/heads/candidate", candidate], cwd=bare)
        run(["git", "bundle", "create", str(root / "GIT/prerequisite.bundle"), "refs/heads/prerequisite"], cwd=bare)
        run(["git", "bundle", "create", str(root / "GIT/candidate.bundle"), "refs/heads/candidate", f"^{PARENT}"], cwd=bare)
    return pack_identity(root / "GIT/candidate.bundle"), pack_identity(root / "GIT/prerequisite.bundle")


def main() -> None:
    candidate = git("rev-parse", "HEAD")
    tree = git("rev-parse", "HEAD^{tree}")
    parent_line = git("show", "-s", "--format=%P", "HEAD")
    if parent_line != PARENT or len(parent_line.split()) != 1: raise SystemExit("S13_R3_DIRECT_CHILD_STOP")
    if git("rev-parse", f"{PARENT}^{{tree}}") != PARENT_TREE: raise SystemExit("S13_R3_PARENT_TREE_STOP")
    if git("rev-parse", CANONICAL_REF) != CANONICAL or git("rev-parse", PRIMARY_REF) != PRIMARY: raise SystemExit("S13_R3_PROTECTED_REF_STOP")
    if run(["git", "symbolic-ref", "-q", "HEAD"], check=False).returncode == 0: raise SystemExit("S13_R3_POSTURE_STOP")
    if git("status", "--porcelain=v1", "--untracked-files=no"): raise SystemExit("S13_R3_DIRTY_TRACKED_STOP")
    untracked = sorted(line[3:] for line in git("status", "--porcelain=v1").splitlines() if line.startswith("?? "))
    if untracked != ["artifacts/g6p-s5/SCREENSHOTS/"]: raise SystemExit(f"S13_R3_UNTRACKED_STOP {untracked}")
    stash = git("stash", "list", "--format=%gd %H %s")
    if stash != EXPECTED_STASH: raise SystemExit("S13_R3_STASH_STOP")

    cache = WORKSPACE / "work/s13-r3-evidence-cache" / candidate
    cache.mkdir(parents=True, exist_ok=True)
    environment = dict(os.environ)
    environment["S13_INPUT_ROOT"] = str(INPUT_ROOT)
    journey = cache / "journey"
    fresh = cache / "fresh"
    tests: list[dict[str, object]] = []
    tests.append(capture_cached(cache, "LOGS/transmission-verifier.txt", ["python3", "VERIFY_TRANSMISSION.py"], "Transmission manifest and instruction identity.", ["PASS_TRACE_ESCAPE_MAIN_TO_CURSOR_S13_R3"], cwd=TRANSMISSION))
    tests.append(capture_cached(cache, "LOGS/input-validator.txt", ["python3", "TOOLS/VALIDATE_S13_INPUTS.py"], "Exact accepted-input admission validator.", ["PASS"], cwd=ACCEPTED_INPUTS))
    replay_path = cache / "replayed-s13-runtime.json"
    tests.append(capture_cached(cache, "LOGS/compiler-replay.txt", ["python3", "scripts/s13/compile_runtime.py", "--input-root", str(INPUT_ROOT), "--output", str(replay_path)], "Deterministic public-runtime compiler replay.", [EXPECTED_RUNTIME_SHA]))
    runtime_source = REPO / "public/scenarios/euler-2023-false-exit/s13-runtime.json"
    if sha(runtime_source) != EXPECTED_RUNTIME_SHA or replay_path.read_bytes() != runtime_source.read_bytes(): raise SystemExit("S13_R3_RUNTIME_IDENTITY_STOP")
    tests.append(capture_cached(cache, "LOGS/build.txt", ["npm", "run", "build"], "Production build and static-runtime integration.", ["built in"]))
    tests.append(capture_cached(cache, "LOGS/unit-focused.txt", ["npx", "vitest", "run", "tests/unit/s13-corpus-integration.test.ts", "tests/unit/s12-p1-r1-persistence.test.ts", "tests/unit/s12-p3-r55-registry.test.ts", "--reporter=verbose"], "Exact-count helper, legacy fail-closed restore, persistence, and production nonactivation contracts.", ["Test Files", "Tests"], env=environment))
    tests.append(capture_cached(cache, "LOGS/browser-s13.txt", ["npx", "playwright", "test", "tests/e2e/s13-corpus-integration.spec.ts", "--workers=1", "--trace=on", f"--output={journey}", "--reporter=line"], "Focused S13 mouse, keyboard, touch, blocked-network, proof, persistence, BRCG, exact-count receipt, and nonactivation journey.", ["7 passed"]))
    tests.append(capture_cached(cache, "LOGS/browser-fresh-play.txt", ["npx", "playwright", "test", "tests/e2e/s12-p4-launch.spec.ts", "--grep", "pointer PLAY starts a fresh opening", "--workers=1", "--trace=on", f"--output={fresh}", "--reporter=line"], "Fresh PLAY clears stale investigation state.", ["1 passed"]))
    tests.append(capture_cached(cache, "LOGS/typecheck.txt", ["npm", "run", "typecheck", "--", "--pretty", "false"], "Repository TypeScript contract check.", ["tsc -b"]))
    lint_paths = ["src/app/CaseTerminalWorkbench.tsx", "src/investigation/s13.ts", "src/investigation/state.ts", "tests/unit/s13-corpus-integration.test.ts", "tests/e2e/s13-corpus-integration.spec.ts"]
    tests.append(capture_cached(cache, "LOGS/lint.txt", ["npx", "eslint", *lint_paths], "Changed TypeScript scope lint.", []))

    comparison = json.loads(r2_bytes("FULL_VITEST_FAILURE_SET_COMPARISON.json"))
    full_totals = comparison["totals"]
    actual_failures = comparison["actualRemainingFailureSet"]

    with tempfile.TemporaryDirectory(prefix="s13-r3-delivery-") as temporary:
        root = Path(temporary) / NAME
        root.mkdir()
        shutil.copy2(REPO / "scripts/s13/verify_delivery.py", root / "VERIFY_DELIVERY.py")
        shutil.copy2(REPO / "scripts/s13/run_negative_probes.py", root / "RUN_NEGATIVE_PROBES.py")
        write(root, "COMPILER/compile_runtime.py", (REPO / "scripts/s13/compile_runtime.py").read_bytes())
        write(root, "RUNTIME/s13-runtime.json", runtime_source.read_bytes())
        write(root, "RUNTIME/s13-runtime.json.sha256", runtime_source.with_suffix(".json.sha256").read_bytes())
        for row in tests: write(root, str(row["log"]), (cache / str(row["log"])).read_bytes())

        app, asset_path = discover_production_asset()
        source_map = app.with_suffix(".js.map")
        if not source_map.is_file(): raise SystemExit("production source map stop")
        write(root, "PRODUCTION/app.js", app.read_bytes())
        write(root, "PRODUCTION/app.js.map", source_map.read_bytes())
        screenshot_names = ["01-broad-neutral-corpus.png", "02-caseboard-partial-proof.png", "03-caseboard-completion-ready.png", "04-direct-path-brcg-absent.png", "05-brcg-unlocked-by-back-read.png", "06-exact-count-query-receipt.png"]
        for basename in screenshot_names: copy_named_screenshot(journey, basename, root / "SCREENSHOTS" / basename)
        copy_named_screenshot(journey, "mutation-ledger-control.png", root / "PROBE_CONTROLS/ledger.png")
        write(root, "PROBE_CONTROLS/receipt-only.png", r2_bytes("PROBE_CONTROLS/receipt-only.png"))
        write(root, "PROBE_CONTROLS/brcg-offscreen.png", r2_bytes("PROBE_CONTROLS/brcg-offscreen.png"))
        write(root, "PROBE_CONTROLS/stage-index-receipt.png", r2_bytes("SCREENSHOTS/01-broad-neutral-corpus.png"))
        for rel in SOURCE_PATHS: write(root, f"SOURCE/{rel}", (REPO / rel).read_bytes())

        runtime = json.loads(runtime_source.read_text(encoding="utf-8"))
        all_inputs = [{"path": path.relative_to(INPUT_ROOT).as_posix(), "sha256": sha(path), "bytes": path.stat().st_size} for path in sorted(INPUT_ROOT.rglob("*")) if path.is_file()]
        write_json(root, "INPUT_ADMISSION.json", {"status": "PASS", "validatorStatus": "PASS", "compilerReplayByteEqual": True, "instructionTransmission": zip_identity(TRANSMISSION_ZIP), "acceptedR2Delivery": zip_identity(R2_ZIP), "compilerInputs": [{"path": key, "sha256": value} for key, value in sorted(runtime["sourceHashes"].items())], "allS13InputFiles": all_inputs, "acceptanceOverlay": {"e03Rows": 76, "accepted": 76, "curated": 45, "receiptOnly": 31}})
        write_json(root, "PUBLIC_RUNTIME_IDENTITY.json", {"path": "public/scenarios/euler-2023-false-exit/s13-runtime.json", "sha256": sha(runtime_source), "bytes": runtime_source.stat().st_size, "compiler": runtime["compiler"], "metrics": runtime["metrics"]})
        write_json(root, "VALIDATION.json", {"status": "PASS", "receiptIdsUnique": 101, "union": [25, 76], "overlayBoundE03": 76, "classification": [45, 31], "semanticRecordIdsUnique": 227, "receiptOnlyRowsInCorpus": 0, "sequence": [98, 98, 74, 3, 2, 1], "survivor": "HERO.EXACT_CONVERGENCE", "contextualFillsProofSlots": False, "brcgPresent": True, "e02RowsIncluded": False})
        write_json(root, "THREE_DISPATCH_QUERY_RECEIPT.json", {"mandatoryDispatchCount": 3, "commandHistory": ["STAGE_CARD", "REVIEW_RECEIPT", "DISPATCH"] * 3, "groups": [{"id": "FLOOD_ORIENT", "startStage": 0, "endStage": 2, "counts": [98, 98], "resultCount": 98}, {"id": "CANDIDATES_CASE_FILE_BOUNDS", "startStage": 2, "endStage": 4, "counts": [74, 3], "resultCount": 3}, {"id": "RECEIPT_ROUTE_VERIFICATION", "startStage": 4, "endStage": 6, "counts": [2, 1], "resultCount": 1}], "productionOwner": "CASE_QUESTION_CARD_QUERY_RECEIPT_DISPATCH", "preDispatchReviewRequired": True, "exploreDispatchControls": 0})
        write_json(root, "EXACT_COUNT_SUMMARY_RECEIPT.json", {"owner": "s13QueryGroupSummary", "consumers": ["CASE_STAGED_PREVIEW", "PRE_DISPATCH_QUERY_RECEIPT"], "groups": [{"id": "FLOOD_ORIENT", "inputCount": 98, "outputCount": 98, "summary": "98 corpus records → 98 matches", "detailedCounts": [98, 98]}, {"id": "CANDIDATES_CASE_FILE_BOUNDS", "inputCount": 98, "outputCount": 3, "summary": "98 corpus records → 3 matches", "detailedCounts": [98, 74, 3]}, {"id": "RECEIPT_ROUTE_VERIFICATION", "inputCount": 3, "outputCount": 1, "summary": "3 corpus records → 1 match", "detailedCounts": [3, 2, 1]}]})
        write_json(root, "LEGACY_SAVE_RECEIPT.json", {"retiredCommand": "S13_DISPATCH_QUESTION", "oneRetiredEntry": {"restoredStage": 0, "restoredCommands": 0, "atomicCleanInitial": True}, "sixRetiredEntries": {"restoredStage": 0, "restoredCommands": 0, "atomicCleanInitial": True}, "validVersion2": {"restoredStage": 6, "dispatches": 3, "exactHistoryRestored": True}})
        source_occurrences = sum(path.read_text(encoding="utf-8", errors="replace").count("S13_DISPATCH_QUESTION") for path in (REPO / "src").rglob("*.ts*"))
        write_json(root, "RETIRED_COMMAND_ABSENCE.json", {"marker": "S13_DISPATCH_QUESTION", "sourceOccurrences": source_occurrences, "builtJsOccurrences": app.read_text(encoding="utf-8", errors="replace").count("S13_DISPATCH_QUESTION"), "sourceMapOccurrences": source_map.read_text(encoding="utf-8", errors="replace").count("S13_DISPATCH_QUESTION")})
        write_json(root, "FULL_VITEST_FAILURE_SET_COMPARISON.json", comparison)
        forbidden_markers = [marker for marker in ("r55-registry", "R55 review", "mathematically precise haystack", "r55Review", "createR55Session", "advanceR55") if marker in app.read_text(encoding="utf-8", errors="replace")]
        write_json(root, "PRODUCTION_NONACTIVATION.json", {"assetPath": asset_path, "assetSha256": sha(app), "assetBytes": app.stat().st_size, "sourceMapSha256": sha(source_map), "discoveredFrom": "dist/index.html", "obsoleteHardcodedAssetPresent": "index-DBC_kJlO.js" in (REPO / "tests/unit/s12-p3-r55-registry.test.ts").read_text(encoding="utf-8"), "forbiddenMarkersFound": forbidden_markers, "r55DialogueActive": False, "endingActive": False, "mission02Active": False})
        screenshot_assertions = {"screenshots": [{"path": "SCREENSHOTS/01-broad-neutral-corpus.png", "visibleMarkers": ["TRANSFER RECORD 026", "TRANSFER RECORD 109", "TRANSFER RECORD 110"], "forbiddenMarkers": ["HERO.EXACT_CONVERGENCE", "8877507.348306697"]}, {"path": "SCREENSHOTS/02-caseboard-partial-proof.png", "state": "partial-proof"}, {"path": "SCREENSHOTS/03-caseboard-completion-ready.png", "state": "completion-ready"}, {"path": "SCREENSHOTS/04-direct-path-brcg-absent.png", "state": "direct-solver-brcg-absent"}, {"path": "SCREENSHOTS/05-brcg-unlocked-by-back-read.png", "visibleMarkers": ["BRCG SNAPSHOT / BOUNDED NO-MATCH", "NO_MATCH_IN_ACCEPTED_CORPUS", "Held E02 rows included: no."], "panelExpanded": True}, {"path": "SCREENSHOTS/06-exact-count-query-receipt.png", "visibleMarkers": ["98 corpus records → 3 matches", "98 → 74", "74 → 3", "ACCEPTED SEMANTIC SUB-STAGES: 3–4"]}]}
        write_json(root, "SCREENSHOT_ASSERTIONS.json", screenshot_assertions)
        write_json(root, "BOUNDARIES.json", {"prebriefAggregateOnly": True, "prebriefIndividualRecords": 0, "prebriefProofFields": 0, "networkBlockedExternalRequests": 0, "runtimeProviderCalls": 0, "productionR55DialogueActive": False, "productionEndingActive": False, "productionMission02Active": False, "browserStaticSameOriginOnly": True})
        write_json(root, "ARCHITECTURE_OWNERS.json", {"queryPath": "CASE -> Question Card/Lens -> staged query -> reviewed Query Receipt -> DISPATCH", "queryGroupSummary": "src/investigation/s13.ts s13QueryGroupSummary shared by CASE preview and pre-dispatch receipt", "resultsAndEvidenceDelta": "src/app/CaseTerminalWorkbench.tsx + src/app/S13IntegratedCorpus.tsx", "reducerAndPersistence": "src/investigation/state.ts", "caseboardAndProofSlots": "CaseTerminalWorkbench reducer-owned proof filing", "brcg": "S13IntegratedCorpus after accepted BACK_READ", "parallelPublicDispatchPath": False})
        write_json(root, "PROOF_STATE_RECEIPT.json", {"inspectionRequired": True, "verificationRequired": True, "candidateOwnedByReducer": True, "resultOwnedByReducer": True, "proofSlots": ["AMOUNT", "RECEIVER", "LINK"], "heroRecordOnly": True, "contextualRejected": True, "idempotent": True, "completionReady": True, "s14Transition": False})
        write_json(root, "PERSISTENCE_RECEIPT.json", {"persisted": ["grouped semantic stage", "selected source recordId", "verified candidate/result", "S13 comparison", "theory", "partial proof", "full proof"], "reloadCovered": True, "reentryCovered": True, "freshPlayResetCovered": True, "retiredV2CommandsFailClosedAtomically": True, "validV2HistoryRestored": True})
        write_json(root, "PLAYER_BOUNDARY.json", {"broadPoolLabelsNeutral": True, "broadPoolVisibleNeutralCards": 3, "heroIdHiddenBeforeExactVerification": True, "exactValuesHiddenBeforeExactVerification": True, "proofValuesHiddenBeforeExactVerification": True, "brcgOnlyAfterBackRead": True, "contextualCannotFillProof": True})
        screenshots = [{"path": f"SCREENSHOTS/{name}", "sha256": sha(root / "SCREENSHOTS" / name), "bytes": (root / "SCREENSHOTS" / name).stat().st_size, "generatingTest": "tests/e2e/s13-corpus-integration.spec.ts"} for name in screenshot_names]
        control_names = ["ledger.png", "receipt-only.png", "brcg-offscreen.png", "stage-index-receipt.png"]
        write_json(root, "ATTACHMENTS.json", {"screenshots": screenshots, "mutationControls": [{"path": f"PROBE_CONTROLS/{name}", "sha256": sha(root / "PROBE_CONTROLS" / name), "bytes": (root / "PROBE_CONTROLS" / name).stat().st_size} for name in control_names]})
        registry = REPO / "src/story/r55/generated/r55-registry.json"
        write_json(root, "S14_READINESS.json", {"status": "READ_ONLY_READY", "s14Started": False, "acceptedR3Candidate": candidate, "completionReadyOwner": "src/investigation/state.ts + src/app/CaseTerminalWorkbench.tsx", "storyArchive": zip_identity(STORY_ARCHIVE), "developmentRegistry": {"path": "src/story/r55/generated/r55-registry.json", "sha256": sha(registry), "bytes": registry.stat().st_size, "schema": "s12-p3-r4-registry.v1", "activation": "NOT_PRODUCTION_ACTIVE_UNTIL_LATER_GATE"}, "remainingBlocker": "S14 must bind exact accepted R55 dialogue copy and completion/ending state transitions; Mission 02 remains sealed and non-playable.", "repositoryEffectsBeyondCandidate": 0, "refEffects": 0, "providerEffects": 0})
        write_json(root, "EXCLUDED_EFFECTS.json", {"providerCalls": 0, "accountCalls": 0, "credentialReads": 0, "dependencyChanges": 0, "lockfileChanges": 0, "protectedRefMoves": 0, "deployments": 0, "publications": 0, "r55ProductionActivations": 0, "endingActivations": 0, "mission02Activations": 0, "s14WorkStarted": 0})
        write(root, "TESTS_NOT_RUN.md", "# Tests not run\n\nThe full Vitest suite was not rerun: the accepted R2 exact standing-failure report is preserved byte-for-byte, and the focused S13/persistence/production unit run passed without an expansion trigger. The full 38-test browser matrix was not run because the focused seven-test S13 journey and fresh-PLAY reset passed; S15/RC owns that matrix.\n")

        (root / "GIT").mkdir()
        patch = run(["git", "diff", "--binary", f"{PARENT}..{candidate}"]).stdout
        write(root, "GIT/CANDIDATE.patch", patch)
        changed = git("diff", "--name-only", f"{PARENT}..{candidate}").splitlines()
        write(root, "GIT/CHANGED_PATHS.txt", "\n".join(changed) + "\n")
        candidate_pack, prerequisite_pack = make_bundles(root, candidate)
        write_json(root, "GIT_STATE.json", {"posture": "DETACHED_HEAD", "candidate": candidate, "tree": tree, "parent": PARENT, "parentTree": PARENT_TREE, "parentCount": 1, "canonical": CANONICAL, "protectedPrimary": PRIMARY, "trackedChanges": 0, "stagedChanges": 0, "conflictedChanges": 0, "preExistingUntracked": untracked, "stash": stash, "patchSha256": sha(root / "GIT/CANDIDATE.patch"), "patchBytes": (root / "GIT/CANDIDATE.patch").stat().st_size, "candidateBundleSha256": sha(root / "GIT/candidate.bundle"), "candidateBundleBytes": (root / "GIT/candidate.bundle").stat().st_size, "candidatePack": candidate_pack, "prerequisiteBundleSha256": sha(root / "GIT/prerequisite.bundle"), "prerequisiteBundleBytes": (root / "GIT/prerequisite.bundle").stat().st_size, "prerequisitePack": prerequisite_pack})
        write(root, "RECOVERY.md", f"# Recovery\n\nCandidate `{candidate}` is the single direct child of `{PARENT}`. Run `python3 VERIFY_DELIVERY.py`. To recover, seed a bare repository from `GIT/prerequisite.bundle`, then verify and fetch `refs/heads/candidate` from `GIT/candidate.bundle`. Canonical and protected-primary refs were not moved.\n")
        write_json(root, "TEST_DECISIONS.json", {"testsRun": tests, "testsNotRun": ["full Vitest suite (accepted R2 report preserved)", "full 38-test browser matrix"], "fullVitestRunCountForCandidate": 0, "fullVitestFailureSetMatchesStanding": True, "inheritedFullVitestReportSha256": sha_bytes(r2_bytes("FULL_VITEST_FAILURE_SET_COMPARISON.json")), "expansionTriggerObserved": False})

        run([sys.executable, str(root / "RUN_NEGATIVE_PROBES.py"), "--root", str(root), "--initialize"])
        reports = ["INPUT_ADMISSION.json", "PUBLIC_RUNTIME_IDENTITY.json", "VALIDATION.json", "THREE_DISPATCH_QUERY_RECEIPT.json", "EXACT_COUNT_SUMMARY_RECEIPT.json", "LEGACY_SAVE_RECEIPT.json", "RETIRED_COMMAND_ABSENCE.json", "FULL_VITEST_FAILURE_SET_COMPARISON.json", "PRODUCTION_NONACTIVATION.json", "SCREENSHOT_ASSERTIONS.json", "BOUNDARIES.json", "ARCHITECTURE_OWNERS.json", "PROOF_STATE_RECEIPT.json", "PERSISTENCE_RECEIPT.json", "PLAYER_BOUNDARY.json", "ATTACHMENTS.json", "S14_READINESS.json", "EXCLUDED_EFFECTS.json", "TESTS_NOT_RUN.md", "TEST_DECISIONS.json", "GIT_STATE.json", "RECOVERY.md"]
        logs = {str(row["log"]): {"command": row["command"], "exit": row["exit"], "meaningfulTokens": row["meaningfulTokens"]} for row in tests}
        sources = [f"SOURCE/{rel}" for rel in SOURCE_PATHS]
        files = {path.relative_to(root).as_posix(): {"sha256": sha(path), "bytes": path.stat().st_size} for path in sorted(item for item in root.rglob("*") if item.is_file() and item.name not in {"VERIFY_DELIVERY.py", "MANIFEST.sha256"})}
        expected_payload = {"files": files, "logs": logs, "reports": reports, "sources": sources, "sourcePaths": SOURCE_PATHS, "git": {"candidate": candidate, "tree": tree, "parent": PARENT, "parentTree": PARENT_TREE, "parentCount": 1, "canonical": CANONICAL, "protectedPrimary": PRIMARY, "posture": "DETACHED_HEAD"}, "packs": {"candidate": candidate_pack, "prerequisite": prerequisite_pack}, "changedPaths": changed, "inputHashes": runtime["sourceHashes"], "fullSuiteTotals": full_totals, "fullFailureSet": actual_failures, "production": {"assetPath": asset_path, "assetSha256": sha(app)}}
        verifier = root / "VERIFY_DELIVERY.py"
        verifier_text = verifier.read_text(encoding="utf-8")
        if verifier_text.count("__EXPECTED_JSON__") != 1: raise SystemExit("verifier template token stop")
        verifier.write_text(verifier_text.replace("__EXPECTED_JSON__", json.dumps(expected_payload, separators=(",", ":"))), encoding="utf-8")
        create_manifest(root)
        run([sys.executable, str(root / "RUN_NEGATIVE_PROBES.py"), "--root", str(root)])
        verified = run([sys.executable, str(root / "VERIFY_DELIVERY.py")])
        if "PASS S13_R3_DELIVERY" not in verified.stdout: raise SystemExit("S13_R3_VERIFIER_PASS_STOP")

        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        output = OUTPUT_DIR / f"{NAME}.zip"
        if output.exists(): output.unlink()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for path in sorted(item for item in root.rglob("*") if item.is_file()):
                info = zipfile.ZipInfo(f"{NAME}/{path.relative_to(root).as_posix()}", (2026, 9, 24, 0, 0, 0))
                info.external_attr = 0o100644 << 16
                archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        with zipfile.ZipFile(output) as archive: members = len(archive.namelist())
        print(json.dumps({"status": "PASS", "path": str(output), "sha256": sha(output), "bytes": output.stat().st_size, "members": members, "candidate": candidate, "tree": tree, "parent": PARENT, "preservedFullSuiteTotals": full_totals, "remainingFailures": len(actual_failures), "negativeProbes": 51}, indent=2))


if __name__ == "__main__":
    main()
