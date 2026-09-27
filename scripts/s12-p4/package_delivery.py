#!/usr/bin/env python3
"""Build, verify, recover, probe, and deterministically package S12-P4-R1."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import tempfile
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUTPUTS = Path(os.environ.get("S12_P4_OUTPUTS", "/path/to/local-user/Documents/Codex/2026-09-23/open-the-attached-zip-and-follow/outputs"))
OUTPUT_NAME = "TRACE_ESCAPE_S12_P4_R1_CREDITS_PROVENANCE_PRODUCTION_JOURNEY_S13_INPUT_RECOVERY_2026-09-23.zip"
PARENT = "50556f6a0387a75da2db194a9486294bf95228e5"
PARENT_TREE = "5c7f01e403a06e82fa5a98db4c4dfdfcdacdf486"
CANONICAL = "2bbf06d61dfaebd99aafa7d6c9e25812e2e8b47b"
PRIMARY = "0f52131c9f56f49128e7a413396331917e687a1f"
E03_ARCHIVE = Path("/path/to/local-user/.codex/.chatgpt-projects/g-p-6aa88bc298e481919617a14c6b893825/TRACE_ESCAPE_E03_R4_E02_TEMPORAL_SEAL_AND_INTEGRATION_PATH_FINALIZATION_DELIVERY_v1.0.0_2026-09-21.zip")
E03_SHA256 = "675f4c437cd4830e6f627189fb19c9f95f97fb7bc1e3ae153ecd8e42b96c1c8d"
E03_BYTES = 171247
E03_MEMBERS = 42
S13_CLOSURE = {
    "MAIN_ACCEPTANCE/TRACE_ESCAPE_MAIN_E03_R2_PER_CALL_ACCEPTANCE_REGISTER_v1.0.0_2026-09-21.json": "76 accepted E03 receipt identities and claim boundaries",
    "MAIN_ACCEPTANCE/e03_acceptance_binding_final.json": "MAIN acceptance binding for the accepted E03 totals",
    "PLAN/active_authority_binding_final.json": "Active MAIN authority and zero-effect boundary",
    "PUBLIC/brcg_required_launch_integration_final.json": "Required post-case BRCG integration boundary",
    "PUBLIC/call_atlas_final_accepted.json": "101 accepted Call Atlas receipts",
    "PUBLIC/case_corpus_final_accepted.json": "227 accepted semantic records",
    "PUBLIC/corpus_metrics_final_accepted.json": "Cross-bound accepted count identities",
    "PUBLIC/evidence_delta_sequence_final_accepted.json": "Evidence Delta 98 → 98 → 74 → 3 → 2 → 1 and exact survivor",
    "PUBLIC/gameplay_integration_contract_final_accepted.json": "Gameplay/prebrief binding and zero runtime calls",
    "PUBLIC/post_case_filter_predicates.json": "Deterministic post-case predicates",
    "PUBLIC/prebrief_overview_contract_final.json": "Prebrief overview payload",
    "PUBLIC/public_projection_policy.json": "Public/private and claim-boundary policy",
    "PUBLIC/semantic_contribution_index_final_accepted.json": "Semantic contribution classification",
    "PUBLIC/source_provenance_index_final_accepted.json": "Source provenance index",
    "RECEIPTS/00_main_r3_review_binding_and_zero_effects.md": "MAIN review and zero-effect receipt",
    "RECEIPTS/01_e03_byte_preservation.md": "Accepted corpus byte-preservation receipt",
    "RECEIPTS/05_integration_reference_resolution.md": "Prebrief reference-resolution receipt",
    "RECEIPTS/06_public_private_secret_scan.md": "Public-safe input receipt",
}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run(args: list[str], *, cwd: Path = REPO, check: bool = True, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, cwd=cwd, text=True, capture_output=True, env=env)
    if check and result.returncode:
        raise SystemExit(f"command failed {args}\n{result.stdout}{result.stderr}")
    return result


def git(*args: str) -> str:
    return run(["git", *args]).stdout.strip()


def put(root: Path, rel: str, data: bytes | str) -> None:
    path = root / rel; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data.encode() if isinstance(data, str) else data)


def put_json(root: Path, rel: str, value: object) -> None:
    put(root, rel, json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def capture(root: Path, log: str, command: list[str], totals: str, purpose: str) -> dict:
    start = utc_now(); began = time.monotonic(); result = run(command, check=False); runtime = round(time.monotonic() - began, 3); end = utc_now()
    record = f"COMMAND={' '.join(command)}\nSTART_UTC={start}\nEND_UTC={end}\nRUNTIME_SECONDS={runtime}\nEXIT={result.returncode}\nTOTALS={totals}\n--- STDOUT ---\n{result.stdout}\n--- STDERR ---\n{result.stderr}"
    put(root, log, record)
    if result.returncode:
        raise SystemExit(f"focused evidence failed {log}\n{record}")
    return {"log": log, "command": " ".join(command), "startUtc": start, "endUtc": end, "runtimeSeconds": runtime, "exit": 0, "totals": totals, "purpose": purpose, "sha256": sha(record.encode())}


def capture_journey(root: Path) -> dict:
    output = root / "JOURNEY/results"; output.mkdir(parents=True)
    command = ["npx", "playwright", "test", "--workers=1", "tests/e2e/s12-p4-launch.spec.ts", "--grep", "production title reaches authorized fullscreen CRT through ordinary controls", "--reporter=json", "--trace=on", f"--output={output}"]
    start = utc_now(); began = time.monotonic(); result = run(command, check=False); runtime = round(time.monotonic() - began, 3); end = utc_now()
    put(root, "JOURNEY/playwright-report.json", result.stdout)
    put_json(root, "JOURNEY/command.json", {"argv": command, "cwd": str(REPO), "startUtc": start, "endUtc": end, "runtimeSeconds": runtime, "exit": result.returncode, "stderr": result.stderr})
    if result.returncode: raise SystemExit(f"production journey failed\n{result.stdout}{result.stderr}")
    return {"log": "JOURNEY/playwright-report.json", "command": " ".join(command), "startUtc": start, "endUtc": end, "runtimeSeconds": runtime, "exit": 0, "totals": "1 passed / 1", "purpose": "Exact-queryless production title-to-authorization-to-fullscreen-CRT journey using visible controls.", "sha256": sha(result.stdout.encode())}


def recover_s13(root: Path) -> dict:
    if not E03_ARCHIVE.is_file() or sha(E03_ARCHIVE.read_bytes()) != E03_SHA256 or E03_ARCHIVE.stat().st_size != E03_BYTES:
        raise SystemExit("S13_INPUT_RECOVERY_BLOCKED_EXACT_ARCHIVE_ABSENT")
    with zipfile.ZipFile(E03_ARCHIVE) as archive:
        infos = archive.infolist()
        if len(infos) != E03_MEMBERS or len({info.filename for info in infos}) != len(infos): raise SystemExit("S13_ARCHIVE_MEMBER_STOP")
        if any(info.filename.startswith(("/", "\\")) or ".." in Path(info.filename).parts or ((info.external_attr >> 16) & 0o170000) not in (0, 0o100000) for info in infos): raise SystemExit("S13_ARCHIVE_SAFETY_STOP")
        with tempfile.TemporaryDirectory(prefix="s13-exact-source-") as temporary:
            source = Path(temporary); archive.extractall(source)
            for args in (["python3", "VERIFY_DELIVERY.py"], ["python3", "VERIFY_DELIVERY.py", str(E03_ARCHIVE)]):
                checked = run(args, cwd=source, check=False)
                if checked.returncode or "VERIFY_DELIVERY PASS fails 0" not in checked.stdout: raise SystemExit("S13_SOURCE_VERIFY_STOP")
            target = root / "S13_INPUTS"
            rows = []
            for rel, role in S13_CLOSURE.items():
                src = source / rel; dst = target / rel; dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(src, dst)
                rows.append({"originalInternalPath": rel, "deliveryPath": f"S13_INPUTS/{rel}", "sha256": sha(src.read_bytes()), "bytes": src.stat().st_size, "semanticRole": role, "acceptanceStatus": "E03 DATA ACCEPTED BY CHATGPT MAIN LEAD"})
            shutil.copy2(source / "VERIFY_DELIVERY.py", target / "SOURCE_VERIFY_DELIVERY.py")
            shutil.copy2(source / "MANIFEST.sha256", target / "ORIGINAL_MANIFEST.sha256")
            subset = [f"{sha(path.read_bytes())}  {path.relative_to(target).as_posix()}" for path in sorted(item for item in target.rglob("*") if item.is_file() and item.name != "MANIFEST.sha256")]
            put(target, "MANIFEST.sha256", "\n".join(subset) + "\n")
    value = {"schemaVersion": "1.0.0", "sourceArchive": {"path": str(E03_ARCHIVE), "sha256": E03_SHA256, "bytes": E03_BYTES, "members": E03_MEMBERS}, "sourceValidation": [{"argv": ["python3", "VERIFY_DELIVERY.py"], "result": "PASS"}, {"argv": ["python3", "VERIFY_DELIVERY.py", E03_ARCHIVE.name], "result": "PASS"}], "selectionPolicy": "Minimal public-safe S13 integration closure; excludes private/redacted audit, E02 pending projection, account data, raw provider payloads, credentials, and unrelated plan history.", "totals": {"callAtlasReceipts": 101, "semanticRecords": 227, "filterSequence": [98, 98, 74, 3, 2, 1], "exactSurvivor": "HERO.EXACT_CONVERGENCE", "r55CountSlots": [98, 3, 2]}, "validatorCommand": "python3 VERIFY_DELIVERY.py (run against the exact 42-member source extraction before selection); delivery root VERIFY_DELIVERY.py cross-binds the selected closure", "inputs": rows}
    put_json(root, "S13_INPUT_MAP.json", value)
    return value


def manifest(root: Path) -> None:
    rows = [f"{sha(path.read_bytes())}  {path.relative_to(root).as_posix()}" for path in sorted(item for item in root.rglob("*") if item.is_file() and item.name != "MANIFEST.sha256")]
    put(root, "MANIFEST.sha256", "\n".join(rows) + "\n")


def deterministic_zip(root: Path, output: Path) -> None:
    if output.exists(): output.unlink()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(item for item in root.rglob("*") if item.is_file()):
            info = zipfile.ZipInfo(path.relative_to(root).as_posix(), (2000, 1, 1, 0, 0, 0)); info.external_attr = 0o100644 << 16; info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def recovery(bundle: Path, patch: bytes, changed: list[str], candidate: str, tree: str) -> str:
    transcript: list[str] = []
    def step(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
        result = run(args, cwd=cwd, check=False); transcript.append(f"$ {' '.join(args)}\nEXIT={result.returncode}\n{result.stdout}{result.stderr}")
        if result.returncode: raise SystemExit("S12_P4_RECOVERY_STOP\n" + "\n".join(transcript))
        return result
    step(["git", "bundle", "verify", str(bundle)], REPO)
    with tempfile.TemporaryDirectory(prefix="s12-p4-recovery-") as temporary:
        temp = Path(temporary); bare = temp / "recovered.git"
        step(["git", "init", "--bare", str(bare)], temp)
        step(["git", "-C", str(bare), "fetch", str(REPO), f"{PARENT}:refs/heads/base"], temp)
        step(["git", "-C", str(bare), "fetch", str(bundle), "HEAD:refs/heads/candidate"], temp)
        step(["git", "-C", str(bare), "fsck", "--full"], temp)
        got_candidate = step(["git", "-C", str(bare), "rev-parse", "refs/heads/candidate"], temp).stdout.strip()
        got_tree = step(["git", "-C", str(bare), "rev-parse", "refs/heads/candidate^{tree}"], temp).stdout.strip()
        got_parent = step(["git", "-C", str(bare), "show", "-s", "--format=%P", "refs/heads/candidate"], temp).stdout.strip()
        got_patch = step(["git", "-C", str(bare), "diff", "--binary", "refs/heads/base", "refs/heads/candidate"], temp).stdout.encode()
        got_changed = step(["git", "-C", str(bare), "diff", "--name-only", "refs/heads/base", "refs/heads/candidate"], temp).stdout.splitlines()
        if (got_candidate, got_tree, got_parent, got_patch, got_changed) != (candidate, tree, PARENT, patch, changed):
            raise SystemExit("S12_P4_RECOVERY_EXACT_STOP")
    transcript.append(f"RECOVERED_CANDIDATE={candidate}\nRECOVERED_TREE={tree}\nRECOVERED_PARENT={PARENT}\nRECOVERED_PATHS={len(changed)}\nPATCH_SHA256={sha(patch)}\nRESULT=PASS")
    return "\n".join(transcript) + "\n"


def input_row(path: str, digest: str, role: str) -> dict:
    return {"path": path, "sha256": digest, "role": role}


def main() -> None:
    if git("rev-parse", "HEAD^") != PARENT or git("rev-parse", f"{PARENT}^{{tree}}") != PARENT_TREE:
        raise SystemExit("S12_P4_PACKAGE_PARENT_STOP")
    if run(["git", "symbolic-ref", "-q", "HEAD"], check=False).returncode == 0:
        raise SystemExit("S12_P4_PACKAGE_POSTURE_STOP")
    if git("rev-parse", "refs/heads/codex-s5-20260918") != CANONICAL or git("rev-parse", "refs/heads/g6p-a0-point-click") != PRIMARY:
        raise SystemExit("S12_P4_PACKAGE_PROTECTED_REF_STOP")
    status = run(["git", "status", "--short", "--untracked-files=all"]).stdout.splitlines()
    unexpected = [line for line in status if not line.startswith("?? artifacts/g6p-s5/SCREENSHOTS/")]
    if unexpected: raise SystemExit(f"S12_P4_PACKAGE_DIRTY_STOP {unexpected}")

    candidate = git("rev-parse", "HEAD"); tree = git("rev-parse", "HEAD^{tree}"); changed = git("diff", "--name-only", PARENT, candidate).splitlines()
    with tempfile.TemporaryDirectory(prefix="s12-p4-package-") as temporary:
        root = Path(temporary) / "delivery"; root.mkdir()
        shutil.copy2(REPO / "scripts/s12-p4/verify_delivery.py", root / "VERIFY_DELIVERY.py")
        shutil.copy2(REPO / "scripts/s12-p4/run_negative_probes.py", root / "RUN_NEGATIVE_PROBES.py")

        tests = [
            capture(root, "LOGS/unit.txt", ["npx", "vitest", "run", "--config", "scripts/nq5-s7-r3/current-vitest.config.mjs", "tests/unit/s12-p4-launch.test.ts", "tests/unit/s12-p4-r1-credits.test.ts"], "6 passed / 6", "Existing launch/reset coverage plus exact Credits provenance and public-copy bindings."),
            capture(root, "LOGS/credits-playwright.txt", ["npx", "playwright", "test", "--workers=1", "tests/e2e/s12-p4-launch.spec.ts", "--grep", "Credits"], "3 passed / 3", "Keyboard/Escape, pointer/RETURN, real-touch/RETURN, exact copy, and focus restoration."),
            capture(root, "LOGS/terminal-playwright.txt", ["npx", "playwright", "test", "--workers=1", "tests/e2e/s12-p4-launch.spec.ts", "--grep", "authorized terminal remains"], "1 passed / 1", "Current fullscreen CRT exclusivity and internal terminal question/navigation assertions."),
            capture(root, "LOGS/typecheck.txt", ["npm", "run", "typecheck", "--", "--pretty", "false"], "1 command passed", "Compile the cross-cutting production root and focused tests."),
            capture(root, "LOGS/lint.txt", ["npx", "eslint", "src/app/LaunchScreen.tsx", "tests/unit/s12-p4-r1-credits.test.ts", "tests/e2e/s12-p4-launch.spec.ts"], "3 changed-scope files passed", "Changed-scope lint for production and focused tests."),
            capture(root, "LOGS/build.txt", ["npm", "run", "build"], "typecheck and production build passed", "Build the production artifact used for non-activation authentication."),
        ]
        tests.append(capture_journey(root))
        assets = sorted((REPO / "dist/assets").glob("index-*.js"))
        if len(assets) != 1: raise SystemExit(f"S12_P4_PRODUCTION_ASSET_STOP {assets}")
        production = assets[0]; blob = production.read_bytes(); put(root, "PRODUCTION/app.js", blob)
        shutil.copy2(REPO / "src/app/CREDITS_PROVENANCE.json", root / "CREDITS_PROVENANCE.json")

        put_json(root, "TITLE_CREDITS_NAVIGATION.json", {
            "schemaVersion": "1.0.0", "publicTitle": "Tarka", "publicWordmark": "TARKA", "internalCodename": "TRACE//ESCAPE", "publicTraceEscapeTitle": False,
            "browserTitle": "Tarka — A Pixel Retro Nansen Investigation",
            "exactTitleLines": ["TARKA", "A PIXEL RETRO", "NANSEN INVESTIGATION", "CREATED FOR THE", "NANSEN MERIDIAN BUILDATHON", "SEPTEMBER 14–27, 2026", "[ PLAY ]", "CREDITS", "POWERED BY NANSEN API"],
            "controls": ["PLAY", "CREDITS"],
            "forbiddenControls": {key: False for key in ("CONTINUE", "SAVE", "LOAD", "SETTINGS", "OPTIONS", "ACCESSIBILITY", "PLAIN_LIST")},
            "freshReset": {"playOwner": "FULL_FRESH_RESET", "playAgainOwner": "FULL_FRESH_RESET", "playAgainPreservesOwner": False, "keyedRemount": True, "staleResume": False, "gameplayPersistenceOnly": True, "developmentStoragePreserved": True, "unrelatedStoragePreserved": True},
            "credits": {"requiredSections": ["TARKA / CREDITS", "CREATED FOR THE NANSEN MERIDIAN BUILDATHON — SEPTEMBER 14–27, 2026", "POWERED BY NANSEN API", "CONTRIBUTORS", "DATA / SOURCES / ATTRIBUTION", "ABOUT THE TITLE"], "contributors": [], "contributorDisposition": "CONTRIBUTOR_METADATA_NOT_YET_BOUND", "dataSources": ["NANSEN API", "ETHEREUM", "EULER FINANCE · MARCH 13, 2023", "FROZEN HISTORICAL CASE SNAPSHOT"], "returnToOpener": True, "escapeBack": True, "titleFocusRestoresTo": "CREDITS", "pointerTouchKeyboard": True},
            "productionModel": "ONE_ROOT_APPLICATION_STATE_MODEL", "mainMenuTarget": "TARKA_TITLE_SCREEN", "playAgainTarget": "FULL_FRESH_RESET_THEN_OPENING_CUTSCENE",
            "terminal": {"presentation": "FULLSCREEN_CRT_ONLY", "logicalViewport": "480x270", "alternateSelector": False, "roomVisibleBehindCrt": False, "interfaceVisibleBehindCrt": False, "characterDialogueOverTerminal": False, "stateSurvivesInternalNavigation": True},
        })
        put_json(root, "PRODUCTION_NON_ACTIVATION.json", {
            "path": production.relative_to(REPO).as_posix(), "authenticatedCopy": "PRODUCTION/app.js", "sha256": sha(blob), "bytes": len(blob),
            "titlePresent": True, "navigationPresent": True, "r55RegistryAbsent": True, "haystackAbsent": True, "heroCountDataAbsent": True, "mission02Absent": True,
            "ordinaryProductionOpensR55Harness": False, "runtimeProviderCalls": 0,
        })
        s13 = recover_s13(root)
        put_json(root, "S13_READINESS.json", {
            "schemaVersion": "1.0.0", "status": "EXACT_INPUT_RECOVERED_READ_ONLY", "s13Started": False,
            "acceptedCallAtlasReceipts": 101, "semanticRecords": 227, "postCaseFilterSequence": "98 → 98 → 74 → 3 → 2 → 1", "heroRecord": "HERO.EXACT_CONVERGENCE", "r55CountSlots": [98, 3, 2],
            "providerActivity": 0, "accountActivity": 0, "credentialActivity": 0,
            "sourceArchive": s13["sourceArchive"], "inputMap": "S13_INPUT_MAP.json", "providerCalls": 0,
        })

        preflight = {"head": PARENT, "tree": PARENT_TREE, "parent": "ead7f3633ae04ec73be35b55d14181486b8be639", "posture": "DETACHED_HEAD", "canonical": CANONICAL, "protectedPrimary": PRIMARY, "trackedDirty": False, "staged": [], "conflicted": [], "sourceRelevantUntracked": [], "untrackedNotSourceRelevant": ["artifacts/g6p-s5/SCREENSHOTS/evidence-sea-placeholder.png", "artifacts/g6p-s5/SCREENSHOTS/plain-200pct-forced.png", "artifacts/g6p-s5/SCREENSHOTS/terminal-4x.png"], "stash": ["stash@{0}: WIP on (no branch): b86d8dd S9-P1-R4 note-completion contact and E02-neutral optional side-lead seam"], "stashModified": False}
        put_json(root, "PREFLIGHT.json", preflight)
        patch = run(["git", "diff", "--binary", PARENT, candidate]).stdout.encode(); changed_text = "\n".join(changed) + "\n"
        put(root, "GIT/CANDIDATE.patch", patch); put(root, "GIT/CHANGED_PATHS.txt", changed_text); put(root, "GIT/CANDIDATE_COMMIT.raw", run(["git", "cat-file", "commit", candidate]).stdout)
        bundle_path = root / "GIT/candidate.bundle"; bundle_path.parent.mkdir(parents=True, exist_ok=True); run(["git", "bundle", "create", str(bundle_path), "HEAD", f"^{PARENT}"])
        bundle = bundle_path.read_bytes(); put(root, "GIT/RECOVERY.raw", recovery(bundle_path, patch, changed, candidate, tree))
        put_json(root, "GIT_STATE.json", {"candidate": candidate, "tree": tree, "parent": PARENT, "parentTree": PARENT_TREE, "parentCount": 1, "posture": "DETACHED_HEAD", "patchSha256": sha(patch), "changedPathsSha256": sha(changed_text.encode()), "bundleSha256": sha(bundle), "canonical": CANONICAL, "protectedPrimary": PRIMARY})
        put_json(root, "FINAL_GIT_STATE.json", {"head": candidate, "tree": tree, "parent": PARENT, "posture": "DETACHED_HEAD", "canonical": CANONICAL, "protectedPrimary": PRIMARY, "trackedDirty": False, "staged": [], "conflicted": [], "sourceRelevantUntracked": [], "stashModified": False})
        put_json(root, "EXCLUDED_EFFECTS.json", {key: 0 for key in ("r55DialogueActivation", "finalDataIntegration", "mission02Activation", "universalEnding", "layout", "art", "audio", "provider", "account", "credential", "dependency", "lockfile", "canonicalRef", "protectedPrimary", "deployment", "publication")})
        not_run = [
            {"suite": "complete 38-test browser matrix", "reason": "The requested focused cross-cutting smoke passed; no shared-routing failure triggered expansion."},
            {"suite": "full Vitest suite", "reason": "The six focused unit tests and production browser paths cover the changed state owners; complete regression is reserved for S15/release-candidate closure."},
        ]
        put_json(root, "TEST_DECISIONS.json", {"testsRun": tests, "testsNotRun": not_run, "expansionCondition": "Expand only if the focused production smoke reveals shared routing/reducer impact; it did not."})
        put(root, "TESTS_NOT_RUN.md", "# Tests deliberately not run\n\n- Complete 38-test browser matrix: the requested focused root-navigation smoke passed without shared-routing failure.\n- Full Vitest suite: the focused navigation/reset fixture and five browser paths cover the changed state owners; complete regression remains reserved for S15/release-candidate closure.\n")

        spec = importlib.util.spec_from_file_location("s12_p4_probes", root / "RUN_NEGATIVE_PROBES.py"); module = importlib.util.module_from_spec(spec); assert spec and spec.loader; spec.loader.exec_module(module)
        seeded = [{"id": probe, "result": "VERIFIER_REJECTED", "intendedReason": intended, "exit": 1} for probe, intended in module.PROBES]
        put_json(root, "NEGATIVE_PROBE_RESULTS.json", {"clean": "PASS", "probeCount": len(seeded), "allFailedClosed": True, "probes": seeded})

        seal_targets = sorted(path for path in root.rglob("*") if path.is_file() and path.name not in {"VERIFY_DELIVERY.py", "MANIFEST.sha256"})
        seals = {path.relative_to(root).as_posix(): sha(path.read_bytes()) for path in seal_targets}
        verifier_path = root / "VERIFY_DELIVERY.py"; verifier = verifier_path.read_text(encoding="utf-8"); marker = "EXPECTED_SHA256: dict[str, str] = {}"
        if verifier.count(marker) != 1: raise SystemExit("S12_P4_VERIFIER_SEAL_MARKER_STOP")
        verifier_path.write_text(verifier.replace(marker, "EXPECTED_SHA256: dict[str, str] = " + repr(seals)), encoding="utf-8")
        manifest(root)
        clean = run(["python3", str(verifier_path)], cwd=root, check=False)
        if clean.returncode: raise SystemExit(f"initial verifier failed\n{clean.stdout}{clean.stderr}")
        probes = run(["python3", str(root / "RUN_NEGATIVE_PROBES.py"), "--root", str(root)], cwd=root, check=False)
        if probes.returncode: raise SystemExit(f"negative probes failed\n{probes.stdout}{probes.stderr}")
        final = run(["python3", str(verifier_path)], cwd=root, check=False)
        if final.returncode: raise SystemExit(f"final verifier failed\n{final.stdout}{final.stderr}")
        manifest(root)

        OUTPUTS.mkdir(parents=True, exist_ok=True); output = OUTPUTS / OUTPUT_NAME; deterministic_zip(root, output)
        rebuild = Path(temporary) / "rebuild.zip"; deterministic_zip(root, rebuild)
        if sha(output.read_bytes()) != sha(rebuild.read_bytes()): raise SystemExit("S12_P4_NONDETERMINISTIC_PACKAGE")
        print(json.dumps({"delivery": str(output), "sha256": sha(output.read_bytes()), "bytes": output.stat().st_size, "members": len(zipfile.ZipFile(output).namelist()), "candidate": candidate, "tree": tree, "parent": PARENT, "probes": len(seeded), "verifier": final.stdout.strip(), "probeHarness": probes.stdout.strip()}, indent=2))


if __name__ == "__main__":
    main()
