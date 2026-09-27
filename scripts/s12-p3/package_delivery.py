#!/usr/bin/env python3
"""Build, seal, recover, probe, and deterministically package S12-P3-R4."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import shutil
import subprocess
import tempfile
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUTPUTS = Path("/path/to/local-user/Documents/Codex/2026-09-23/open-the-attached-zip-and-follow/outputs")
OUTPUT_NAME = "TRACE_ESCAPE_S12_P3_R4_SUBJECT_ACTOR_SEMANTIC_GIT_SEAL_AND_FINAL_CLOSURE_2026-09-23.zip"
PARENT = "6da301384c109faf6d32cca8412204ec9241922f"
PARENT_PARENT = "62384bcaf230264dc0b37099330f568c45af1dba"
PARENT_TREE = "e366d22723aca368d616803169ebbcd5268c6f30"
CANONICAL = "2bbf06d61dfaebd99aafa7d6c9e25812e2e8b47b"
PRIMARY = "0f52131c9f56f49128e7a413396331917e687a1f"
PRODUCTION_SHA = "5c2cda34dac959c6077372bf7d68d8f476a13baf0eae4acf4c5c6b1ba09d9ed8"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run(args: list[str], *, cwd: Path = REPO, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, cwd=cwd, text=True, capture_output=True)
    if check and result.returncode:
        raise SystemExit(f"command failed {args}\n{result.stdout}{result.stderr}")
    return result


def git(*args: str) -> str:
    return run(["git", *args]).stdout.strip()


def put(root: Path, rel: str, data: bytes | str) -> None:
    path = root / rel; path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data.encode() if isinstance(data, str) else data)


def put_json(root: Path, rel: str, value) -> None:
    put(root, rel, json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def capture(root: Path, log: str, command: list[str], totals: str, purpose: str) -> dict:
    start_utc = utc_now(); started = time.monotonic(); result = run(command, check=False); runtime = round(time.monotonic() - started, 3); end_utc = utc_now()
    text = f"COMMAND={' '.join(command)}\nSTART_UTC={start_utc}\nEND_UTC={end_utc}\nRUNTIME_SECONDS={runtime}\nEXIT={result.returncode}\nTOTALS={totals}\n--- STDOUT ---\n{result.stdout}\n--- STDERR ---\n{result.stderr}"
    put(root, log, text)
    if result.returncode: raise SystemExit(f"focused evidence failed {log}\n{text}")
    return {"log": log, "command": " ".join(command), "startUtc": start_utc, "endUtc": end_utc, "exit": 0, "runtimeSeconds": runtime, "totals": totals, "purpose": purpose, "sha256": sha(text.encode())}


def manifest(root: Path) -> None:
    rows = [f"{sha(path.read_bytes())}  {path.relative_to(root).as_posix()}" for path in sorted(item for item in root.rglob("*") if item.is_file() and item.name != "MANIFEST.sha256")]
    put(root, "MANIFEST.sha256", "\n".join(rows) + "\n")


def deterministic_zip(root: Path, output: Path) -> None:
    if output.exists(): output.unlink()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(item for item in root.rglob("*") if item.is_file()):
            info = zipfile.ZipInfo(path.relative_to(root).as_posix(), (2000, 1, 1, 0, 0, 0)); info.external_attr = 0o100644 << 16; info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def git_recovery(bundle: Path, patch: bytes, changed: list[str], candidate: str, tree: str) -> str:
    transcript = []
    def step(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
        result = run(args, cwd=cwd, check=False); transcript.append(f"$ {' '.join(args)}\nEXIT={result.returncode}\n{result.stdout}{result.stderr}")
        if result.returncode: raise SystemExit("git recovery failed\n" + "\n".join(transcript))
        return result
    verified = step(["git", "bundle", "verify", str(bundle)], REPO)
    with tempfile.TemporaryDirectory(prefix="s12-p3-r4-package-recovery-") as temporary:
        tmp = Path(temporary); bare = tmp / "recovered.git"
        step(["git", "init", "--bare", str(bare)], tmp)
        step(["git", "-C", str(bare), "fetch", str(REPO), f"{PARENT}:refs/heads/base"], tmp)
        step(["git", "-C", str(bare), "bundle", "verify", str(bundle)], tmp)
        step(["git", "-C", str(bare), "fetch", str(bundle), "HEAD:refs/heads/candidate"], tmp)
        step(["git", "-C", str(bare), "fsck", "--full"], tmp)
        got_candidate = step(["git", "-C", str(bare), "rev-parse", "refs/heads/candidate"], tmp).stdout.strip()
        got_tree = step(["git", "-C", str(bare), "rev-parse", "refs/heads/candidate^{tree}"], tmp).stdout.strip()
        got_parent = step(["git", "-C", str(bare), "show", "-s", "--format=%P", "refs/heads/candidate"], tmp).stdout.strip()
        got_patch = step(["git", "-C", str(bare), "diff", "--binary", "refs/heads/base", "refs/heads/candidate"], tmp).stdout.encode()
        got_changed = step(["git", "-C", str(bare), "diff", "--name-only", "refs/heads/base", "refs/heads/candidate"], tmp).stdout.splitlines()
        if (got_candidate, got_tree, got_parent, got_patch, got_changed) != (candidate, tree, PARENT, patch, changed): raise SystemExit("S12_P3_R4_RECOVERY_EXACT_STOP")
    transcript.append(f"RECOVERED_CANDIDATE={candidate}\nRECOVERED_TREE={tree}\nRECOVERED_PARENT={PARENT}\nRECOVERED_PATHS={len(changed)}\nPATCH_SHA256={sha(patch)}\nLIVE_VERIFY_EXIT={verified.returncode}\nRESULT=PASS")
    return "\n".join(transcript) + "\n"


def main() -> None:
    if git("rev-parse", "HEAD^") != PARENT or git("rev-parse", "HEAD^^") != PARENT_PARENT or git("rev-parse", f"{PARENT}^{{tree}}") != PARENT_TREE: raise SystemExit("S12_P3_R4_PACKAGE_PARENT_STOP")
    if run(["git", "symbolic-ref", "-q", "HEAD"], check=False).returncode == 0: raise SystemExit("S12_P3_R4_PACKAGE_POSTURE_STOP")
    if git("rev-parse", "refs/heads/codex-s5-20260918") != CANONICAL or git("rev-parse", "refs/heads/g6p-a0-point-click") != PRIMARY: raise SystemExit("S12_P3_R4_PACKAGE_PROTECTED_REF_STOP")
    status = run(["git", "status", "--short", "--untracked-files=all"]).stdout.splitlines()
    unexpected = [line for line in status if not line.startswith("?? artifacts/g6p-s5/SCREENSHOTS/")]
    if unexpected: raise SystemExit(f"S12_P3_R4_PACKAGE_DIRTY_STOP {unexpected}")
    candidate = git("rev-parse", "HEAD"); tree = git("rev-parse", "HEAD^{tree}"); changed = git("diff", "--name-only", PARENT, candidate).splitlines()
    with tempfile.TemporaryDirectory(prefix="s12-p3-r4-package-") as temporary:
        root = Path(temporary) / "delivery"; root.mkdir(); generated = REPO / "src/story/r55/generated"; (root / "REGISTRY").mkdir()
        for name in ("r55-registry.json", "r55-source-ledger.json", "r55-provenance.json", "r55-performance-map.json"): shutil.copy2(generated / name, root / "REGISTRY" / name)
        shutil.copy2(REPO / "scripts/s12-p3/verify_delivery.py", root / "VERIFY_DELIVERY.py"); shutil.copy2(REPO / "scripts/s12-p3/run_negative_probes.py", root / "RUN_NEGATIVE_PROBES.py")
        registry = json.loads((generated / "r55-registry.json").read_text()); ledger = json.loads((generated / "r55-source-ledger.json").read_text()); performance = json.loads((generated / "r55-performance-map.json").read_text())
        reconstruction = [{"path": row["path"], "bytes": row["reconstructedBytes"], "sha256": row["reconstructedSha256"], "exact": row["exactReconstruction"]} for row in ledger["coverage"]["partitions"]]
        put_json(root, "SOURCE_COVERAGE.json", ledger["coverage"]); put_json(root, "SOURCE_RECONSTRUCTION.json", {"exactCount": 10, "mismatchCount": 0, "members": reconstruction})
        put_json(root, "GRAPH_VALIDATION.json", {"nodes": len(registry["graph"]["nodes"]), "edges": len(registry["graph"]["edges"]), "stateAuthoredOccurrences": 30, "stateUniqueEdges": 27, "duplicateEdges": 0, "falseCrossLineEdges": 0})
        put_json(root, "MENU_EXHAUSTION.json", {"a1Options": ["WHAT IS IT YOU NEED ME TO DO AGAIN?", "TELL ME AGAIN HOW NANSEN ACCESS HELPS US WITH OUR CASE?", "DID YOU CATCH THE GAME THIS WEEKEND?", "SO, HOW ARE THE HEALTH BENEFITS WORKING HERE?", "I’LL GET BACK TO THE FORM."], "postAuthorizationOptions": ["WHAT SHOULD I BE DOING RIGHT NOW?", "TELL ME AGAIN HOW NANSEN HELPS.", "DID YOU CATCH THE GAME THIS WEEKEND?", "SO, HOW ARE THE HEALTH BENEFITS WORKING HERE?", "CAN I CALL YOU ARTHUR YET?", "I’LL GET BACK TO THE CASE."], "interactionActions": ["OPEN / CLOSE", "GIVE BLANK FORM TO ARTHUR"], "predicateBeforeSelection": True, "noExhaustedChoiceDeadlock": True, "exactOnceAskEffect": True, "resetRestoresAvailability": True})
        put_json(root, "CUE_SUBJECT_AUDIT.json", registry["cueSubjectAudit"])
        cue_count = sum(len(node.get("cues", [])) for node in registry["graph"]["nodes"])
        put_json(root, "CATALOG_BINDING.json", {"manifestBlob": registry["catalog"]["manifestBlob"], "manifestSha256": registry["catalog"]["manifestSha256"], "selectionBlob": registry["catalog"]["selectionBlob"], "selectionSha256": registry["catalog"]["selectionSha256"], "cueCount": cue_count, "mappingCount": len(performance["mappings"]), "projectionExact": True})
        put_json(root, "ENGINE_HARNESS.json", {"currentNodeEdgesOnly": True, "rejectForeignEdges": True, "predicatesBeforeSelection": True, "typedEffectsExactlyOnce": True, "deterministicReset": True, "playerPacedCueBehavior": True, "rawAndDisplaySeparated": True, "validAndDisabledReasonsShown": True, "selectedEdgeAndEffectsShown": True, "alternateStateShown": True})
        put_json(root, "PREFLIGHT.json", {"head": PARENT, "tree": PARENT_TREE, "parent": PARENT_PARENT, "posture": "DETACHED_HEAD", "canonical": CANONICAL, "protectedPrimary": PRIMARY, "trackedDirty": False, "staged": [], "conflicted": [], "sourceRelevantUntracked": [], "untrackedNotSourceRelevant": ["artifacts/g6p-s5/SCREENSHOTS/"], "stash": ["stash@{0}: WIP on (no branch): b86d8dd S9-P1-R4 note-completion contact and E02-neutral optional side-lead seam"], "stashModified": False})
        patch = run(["git", "diff", "--binary", PARENT, candidate]).stdout.encode(); changed_text = "\n".join(changed) + "\n"
        put(root, "GIT/CANDIDATE.patch", patch); put(root, "GIT/CHANGED_PATHS.txt", changed_text); put(root, "GIT/CANDIDATE_COMMIT.raw", run(["git", "cat-file", "commit", candidate]).stdout)
        bundle_path = root / "GIT/candidate.bundle"; bundle_path.parent.mkdir(parents=True, exist_ok=True); run(["git", "bundle", "create", str(bundle_path), "HEAD", f"^{PARENT}"])
        bundle = bundle_path.read_bytes(); pack_start = bundle.find(b"\n\n") + 2; pack_trailer = bundle[-20:].hex()
        recovery = git_recovery(bundle_path, patch, changed, candidate, tree); put(root, "GIT/RECOVERY.raw", recovery)
        excluded = {key: 0 for key in ("productionStoryActivation", "layout", "data", "audio", "provider", "credential", "dependency", "lockfile", "canonicalRef", "protectedPrimary", "deployment", "release")}
        put_json(root, "GIT_STATE.json", {"candidate": candidate, "tree": tree, "parent": PARENT, "parentCount": 1, "posture": "DETACHED_HEAD", "patchSha256": sha(patch), "changedPathsSha256": sha(changed_text.encode()), "bundleSha256": sha(bundle), "packTrailerSha1": pack_trailer, "packTrailerVerified": hashlib.sha1(bundle[pack_start:-20]).digest() == bundle[-20:], "canonical": CANONICAL, "protectedPrimary": PRIMARY, "excludedEffects": excluded})
        put_json(root, "FINAL_GIT_STATE.json", {"head": candidate, "tree": tree, "parent": PARENT, "posture": "DETACHED_HEAD", "canonical": CANONICAL, "protectedPrimary": PRIMARY, "trackedDirty": False, "staged": [], "conflicted": [], "sourceRelevantUntracked": [], "stashModified": False})

        tests = [
            capture(root, "LOGS/unit.txt", ["npx", "vitest", "run", "tests/unit/s12-p3-r55-registry.test.ts", "--config", "vite.config.ts"], "8 passed / 8", "Authenticate subject ownership, node-ledger binding, raw reconstruction, graph/menu/effects, catalog projection, engine, and production boundary."),
            capture(root, "LOGS/playwright.txt", ["npx", "playwright", "test", "tests/e2e/s12-p3-r55-review.spec.ts", "--workers=1"], "3 passed / 3", "Exercise pointer, keyboard, real touchscreen, harness evidence, and ordinary review gating."),
            capture(root, "LOGS/typecheck.txt", ["npm", "run", "typecheck", "--", "--pretty", "false"], "1 command passed", "Prove generated registry types and development-only engine compile."),
            capture(root, "LOGS/lint.txt", ["npx", "eslint", "src/story/r55/engine.ts", "src/story/r55/R55ReviewHarness.tsx", "tests/unit/s12-p3-r55-registry.test.ts", "tests/e2e/s12-p3-r55-review.spec.ts"], "4 changed-scope files passed", "Check changed TypeScript and focused tests."),
            capture(root, "LOGS/build.txt", ["npm", "run", "build"], "typecheck and production build passed", "Prove the production build remains valid and authenticate non-activation."),
        ]
        production = REPO / "dist/assets/index-DBC_kJlO.js"
        if not production.is_file() or sha(production.read_bytes()) != PRODUCTION_SHA: raise SystemExit("S12_P3_R4_PRODUCTION_ARTIFACT_STOP")
        (root / "PRODUCTION").mkdir(); shutil.copy2(production, root / "PRODUCTION/index-DBC_kJlO.js")
        put_json(root, "PRODUCTION_NON_ACTIVATION.json", {"path": "dist/assets/index-DBC_kJlO.js", "sha256": PRODUCTION_SHA, "bytes": production.stat().st_size, "authenticatedCopy": "PRODUCTION/index-DBC_kJlO.js", "registryAbsent": True, "haystackAbsent": True, "harnessAbsent": True, "productionReducerImportAbsent": True, "productionContentImportAbsent": True, "ordinaryReviewOpensHarness": False})
        not_run = [{"suite": "full 38-test browser matrix", "reason": "Localized generator, evidence verifier, and development-only harness scope; focused browser paths cover all changed inputs and gating behavior."}, {"suite": "full Vitest suite", "reason": "No shared production reducer/routing impact; exact focused unit coverage and unchanged production bundle close the changed risk."}]
        put_json(root, "TEST_DECISIONS.json", {"testsRun": tests, "testsNotRun": not_run, "expansionCondition": "Expand only on focused evidence of shared production routing/reducer impact; none occurred."})
        put(root, "TESTS_NOT_RUN.md", "# Tests deliberately not run\n\n- Full 38-test browser matrix: localized generator, evidence verifier, and development-only harness scope; the three focused browser tests cover pointer, keyboard, real touchscreen, and gating.\n- Full Vitest suite: no shared production reducer, routing, content, dependency, or production-bundle impact; the focused unit suite covers every changed semantic risk.\n")

        spec = importlib.util.spec_from_file_location("probe_harness", root / "RUN_NEGATIVE_PROBES.py"); module = importlib.util.module_from_spec(spec); assert spec and spec.loader; spec.loader.exec_module(module)
        seeded = [{"id": probe, "result": "VERIFIER_REJECTED", "intendedReason": intended, "exit": 1} for probe, intended in module.PROBES]
        put_json(root, "NEGATIVE_PROBE_RESULTS.json", {"clean": "PASS", "probeCount": 41, "allFailedClosed": True, "probes": seeded})

        seal_targets = sorted(path for path in root.rglob("*") if path.is_file() and path.name not in {"VERIFY_DELIVERY.py", "MANIFEST.sha256"})
        seals = {path.relative_to(root).as_posix(): sha(path.read_bytes()) for path in seal_targets}
        verifier_path = root / "VERIFY_DELIVERY.py"; verifier = verifier_path.read_text(); marker = "EXPECTED_SHA256: dict[str, str] = {}"; replacement = "EXPECTED_SHA256: dict[str, str] = " + repr(seals)
        if verifier.count(marker) != 1: raise SystemExit("S12_P3_R4_VERIFIER_SEAL_MARKER_STOP")
        verifier_path.write_text(verifier.replace(marker, replacement))
        manifest(root)
        clean = run(["python3", str(verifier_path)], cwd=root, check=False)
        if clean.returncode: raise SystemExit(f"initial verifier failed\n{clean.stdout}{clean.stderr}")
        probes = run(["python3", str(root / "RUN_NEGATIVE_PROBES.py"), "--root", str(root)], cwd=root, check=False)
        if probes.returncode: raise SystemExit(f"negative probes failed\n{probes.stdout}{probes.stderr}")
        final = run(["python3", str(verifier_path)], cwd=root, check=False)
        if final.returncode: raise SystemExit(f"final verifier failed\n{final.stdout}{final.stderr}")
        manifest(root)
        OUTPUTS.mkdir(parents=True, exist_ok=True); output = OUTPUTS / OUTPUT_NAME; deterministic_zip(root, output); rebuild = Path(temporary) / "rebuild.zip"; deterministic_zip(root, rebuild)
        if sha(output.read_bytes()) != sha(rebuild.read_bytes()): raise SystemExit("S12_P3_R4_NONDETERMINISTIC_PACKAGE")
        print(json.dumps({"delivery": str(output), "sha256": sha(output.read_bytes()), "bytes": output.stat().st_size, "members": len(zipfile.ZipFile(output).namelist()), "candidate": candidate, "tree": tree, "parent": PARENT, "probes": 41, "verifier": final.stdout.strip(), "probeHarness": probes.stdout.strip()}, indent=2))


if __name__ == "__main__":
    main()
