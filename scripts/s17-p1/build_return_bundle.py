#!/usr/bin/env python3
"""Build and deeply verify the single S17-P1 return bundle."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

BASE = "190d0ec0e48853871acfb2f70f97c4e61a9f4592"
BASE_TREE = "3dd1dcbdff539ccca77cef44ea1a97c6affb0546"
BASE_PARENT = "34a9406014cc5d14e6201840e9bf2ef187bf9a59"
PACKET_SHA = "905203d0da8593801575daca92c35429885fa321bcfa6711bb54fe4f45365bee"
ROOT_NAME = "TRACE_ESCAPE_CODEX_TO_MAIN_S17_P1_FINAL_TERMINAL_SCRIPT_AND_ROOM_INTEGRATION_v1.0.0_2026-09-26"
DEFAULT_OUTPUT = Path("/path/to/local-user/Downloads") / f"{ROOT_NAME}.zip"


def run(args: list[str], cwd: Path, *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=cwd, check=check, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write(path: Path, value: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding="utf-8")


def manifest_for(stage: Path, identity: dict[str, object]) -> dict[str, object]:
    rows = []
    for path in sorted(item for item in stage.rglob("*") if item.is_file() and item.name != "MANIFEST.json"):
        rows.append({"path": path.relative_to(stage).as_posix(), "size": path.stat().st_size, "sha256": sha256(path)})
    return {
        "schema": "tarka.s17-p1.return-manifest.v1",
        "status": "COMPLETE_PENDING_MAIN_REVIEW",
        "identity": identity,
        "files": rows,
    }


VERIFIER = r'''#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, shutil, subprocess, sys, tempfile
from pathlib import Path

PACKET_SHA = "905203d0da8593801575daca92c35429885fa321bcfa6711bb54fe4f45365bee"
BASE = "190d0ec0e48853871acfb2f70f97c4e61a9f4592"
BASE_TREE = "3dd1dcbdff539ccca77cef44ea1a97c6affb0546"
BASE_PARENT = "34a9406014cc5d14e6201840e9bf2ef187bf9a59"

def fail(message):
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)

def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def call(args, cwd):
    result = subprocess.run(args, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if result.returncode: fail(f"command failed ({' '.join(args)}): {result.stdout[-2000:]}")
    return result.stdout.strip()

parser = argparse.ArgumentParser()
parser.add_argument("--deep", action="store_true")
args = parser.parse_args()
root = Path(__file__).resolve().parent
manifest_path = root / "MANIFEST.json"
if not manifest_path.is_file(): fail("MANIFEST.json missing")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
expected = {row["path"]: row for row in manifest.get("files", [])}
actual = {path.relative_to(root).as_posix(): path for path in root.rglob("*") if path.is_file() and path.name != "MANIFEST.json"}
if set(expected) != set(actual):
    fail(f"member set mismatch: missing={sorted(set(expected)-set(actual))} extra={sorted(set(actual)-set(expected))}")
for name, row in expected.items():
    path = actual[name]
    if path.is_symlink(): fail(f"symlink forbidden: {name}")
    if path.stat().st_size != row["size"] or digest(path) != row["sha256"]: fail(f"digest mismatch: {name}")

identity = json.loads((root / "FINAL_GIT_IDENTITY.json").read_text(encoding="utf-8"))
if identity.get("base") != BASE or identity.get("baseTree") != BASE_TREE or identity.get("baseParent") != BASE_PARENT:
    fail("base authority mismatch")
if identity.get("parent") != BASE or identity.get("parentCount") != 1:
    fail("final commit is not the required one-child result")
source = json.loads((root / "EVIDENCE" / "SOURCE_AUTHORITY_RECEIPT.json").read_text(encoding="utf-8"))
if source.get("incomingPacket", {}).get("sha256") != PACKET_SHA:
    fail("incoming authority pin mismatch")
if source.get("exactBase", {}).get("commit") != BASE or source.get("exactBase", {}).get("tree") != BASE_TREE:
    fail("source receipt base mismatch")
if source.get("runtimeOutputs", {}).get("finalScript", {}).get("bubbles") != 724:
    fail("final script authority count mismatch")
if source.get("runtimeOutputs", {}).get("reachability", {}).get("rows") != 43:
    fail("reachability authority count mismatch")

if args.deep:
    bundle = root / "REPOSITORY.bundle"
    patch = root / "S17_P1.full-index.binary.patch"
    with tempfile.TemporaryDirectory(prefix="s17-return-verify-") as td:
        temp = Path(td)
        verifier_repo = temp / "verify.git"
        call(["git", "init", "--quiet", "--bare", str(verifier_repo)], temp)
        call(["git", "bundle", "verify", str(bundle)], verifier_repo)
        recovered = temp / "recovered"
        call(["git", "clone", "--quiet", str(bundle), str(recovered)], temp)
        call(["git", "fsck", "--full", "--strict"], recovered)
        head = call(["git", "rev-parse", "HEAD"], recovered)
        tree = call(["git", "rev-parse", "HEAD^{tree}"], recovered)
        parents = call(["git", "show", "-s", "--format=%P", "HEAD"], recovered).split()
        if head != identity["commit"] or tree != identity["tree"] or parents != [BASE]: fail("recovered Git identity mismatch")
        reconstruction = temp / "reconstruction"
        call(["git", "clone", "--quiet", str(bundle), str(reconstruction)], temp)
        call(["git", "checkout", "--quiet", BASE], reconstruction)
        call(["git", "apply", "--index", "--binary", str(patch)], reconstruction)
        rebuilt_tree = call(["git", "write-tree"], reconstruction)
        if rebuilt_tree != identity["tree"]: fail(f"patch tree mismatch: {rebuilt_tree}")

print("PASS: S17-P1 return bundle member set, hashes, authority, identity" + (", Git recovery/fsck, and patch reconstruction" if args.deep else ""))
'''


def verifier_result(stage: Path, deep: bool = False) -> subprocess.CompletedProcess[str]:
    args = [sys.executable, "VERIFY_RETURN.py"] + (["--deep"] if deep else [])
    return subprocess.run(args, cwd=stage, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


def rebuild_manifest(stage: Path, identity: dict[str, object]) -> None:
    write(stage / "MANIFEST.json", json.dumps(manifest_for(stage, identity), indent=2) + "\n")


def main() -> int:
    repo = Path.cwd().resolve()
    output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_OUTPUT
    head = run(["git", "rev-parse", "HEAD"], repo).stdout.strip()
    tree = run(["git", "rev-parse", "HEAD^{tree}"], repo).stdout.strip()
    parents = run(["git", "show", "-s", "--format=%P", "HEAD"], repo).stdout.strip().split()
    if parents != [BASE]:
        raise SystemExit(f"HEAD must be the sole child of {BASE}; got parents {parents}")
    if run(["git", "status", "--porcelain", "--untracked-files=no"], repo).stdout.strip():
        raise SystemExit("tracked worktree must be clean before return packaging")
    identity: dict[str, object] = {
        "schema": "tarka.s17-p1.final-git-identity.v1",
        "commit": head,
        "tree": tree,
        "parent": BASE,
        "parentCount": 1,
        "base": BASE,
        "baseTree": BASE_TREE,
        "baseParent": BASE_PARENT,
        "status": "COMPLETE_PENDING_MAIN_REVIEW",
    }

    with tempfile.TemporaryDirectory(prefix="s17-p1-return-") as td:
        temp = Path(td)
        stage = temp / ROOT_NAME
        stage.mkdir()
        shutil.copytree(repo / "review" / "s17-p1", stage / "EVIDENCE")
        write(stage / "FINAL_GIT_IDENTITY.json", json.dumps(identity, indent=2) + "\n")
        write(stage / "CHANGED_PATHS.txt", run(["git", "diff", "--name-status", BASE, head], repo).stdout)
        write(stage / "S17_P1.full-index.binary.patch", run(["git", "diff", "--binary", "--full-index", BASE, head], repo).stdout)
        run(["git", "bundle", "create", str(stage / "REPOSITORY.bundle"), "HEAD"], repo)
        write(stage / "VERIFY_RETURN.py", VERIFIER)
        os.chmod(stage / "VERIFY_RETURN.py", 0o755)
        write(stage / "START_HERE.md", """# TARKA S17-P1 return\n\nStatus: **COMPLETE_PENDING_MAIN_REVIEW**. This is a review candidate, not Principal/MAIN acceptance or release.\n\nBegin with `READ_ORDER.txt`, then run `python3 VERIFY_RETURN.py --deep` from this directory. The bundle contains the exact one-child commit, a full-index binary patch, a complete recoverable Git bundle, checkpoints A/B/C, dispositions, tests, mutations, source authority, production screenshots, and bounded audio evidence.\n\nNo Playtest 2 authorization, protected-ref promotion, deployment, publication, live provider action, or rights determination is included. Human listening, audio redistribution rights, Principal/MAIN acceptance, and release actions remain open.\n""")
        write(stage / "READ_ORDER.txt", """START_HERE.md\nFINAL_GIT_IDENTITY.json\nEVIDENCE/SOURCE_AUTHORITY_RECEIPT.json\nEVIDENCE/A_CHECKPOINT.json\nEVIDENCE/B_CHECKPOINT.json\nEVIDENCE/C_CHECKPOINT.json\nEVIDENCE/SOURCE_PERFORMANCE_ROUTE_DELTA.md\nEVIDENCE/REVIEW_CLASSIFICATION.md\nEVIDENCE/DOCS_LANE_FACTS.md\nEVIDENCE/PHASE_C/TEST_EXECUTION.json\nEVIDENCE/PHASE_C/DISPOSITIONS/COUNTS.json\nEVIDENCE/PHASE_C/DISPOSITIONS/TERMINAL_REQUIREMENT_DISPOSITIONS.json\nEVIDENCE/PHASE_C/DISPOSITIONS/TERMINAL_SCREEN_DISPOSITIONS.json\nEVIDENCE/PHASE_C/DISPOSITIONS/TERMINAL_HOST_DISPOSITIONS.json\nEVIDENCE/PHASE_C/MUTATIONS/semantic-mutants.json\nEVIDENCE/PHASE_C/AUDIO/actual-owner-two-wraps.json\nEVIDENCE/PHASE_C/oracle-matrix.json\nCHANGED_PATHS.txt\nRECOVERY.md\nMANIFEST.json\nVERIFY_RETURN.py\n""")
        write(stage / "RECOVERY.md", f"""# Recovery\n\nVerify first with `python3 VERIFY_RETURN.py --deep`.\n\nComplete repository recovery: `git clone REPOSITORY.bundle recovered-s17-p1`. The recovered HEAD must equal `{head}` with tree `{tree}` and sole parent `{BASE}`.\n\nPatch reconstruction: check out `{BASE}` in a compatible clone, then run `git apply --index --binary S17_P1.full-index.binary.patch`. `git write-tree` must equal `{tree}`. The deep verifier performs both procedures in temporary directories and runs strict full Git fsck.\n""")
        write(stage / "VERIFICATION" / "negative-controls.json", json.dumps({"status": "PENDING_PRESEAL"}, indent=2) + "\n")
        rebuild_manifest(stage, identity)

        controls: dict[str, object] = {}
        for name in ["tamper", "missing", "authority"]:
            target = temp / f"negative-{name}"
            shutil.copytree(stage, target)
            if name == "tamper":
                with (target / "START_HERE.md").open("a", encoding="utf-8") as handle:
                    handle.write("tampered\n")
            elif name == "missing":
                (target / "READ_ORDER.txt").unlink()
            else:
                receipt_path = target / "EVIDENCE" / "SOURCE_AUTHORITY_RECEIPT.json"
                receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
                receipt["incomingPacket"]["sha256"] = "0" * 64
                write(receipt_path, json.dumps(receipt, indent=2) + "\n")
                rebuild_manifest(target, identity)
            result = verifier_result(target)
            controls[name] = {"expectedFailure": True, "failed": result.returncode != 0, "outputTail": result.stdout[-1000:]}
            if result.returncode == 0:
                raise SystemExit(f"negative control unexpectedly passed: {name}")

        write(stage / "VERIFICATION" / "negative-controls.json", json.dumps({
            "schema": "tarka.s17-p1.negative-controls.v1",
            "status": "PASS",
            "controls": controls,
            "note": "Controls ran against a preseal member-identical staging copy; the authority case regenerated its manifest to prove semantic pinning rather than digest-only rejection.",
        }, indent=2) + "\n")
        rebuild_manifest(stage, identity)
        deep = verifier_result(stage, deep=True)
        if deep.returncode:
            raise SystemExit(deep.stdout)

        output.parent.mkdir(parents=True, exist_ok=True)
        if output.exists():
            output.unlink()
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for path in sorted(item for item in stage.rglob("*") if item.is_file()):
                archive.write(path, (Path(ROOT_NAME) / path.relative_to(stage)).as_posix())

        extract = temp / "fresh-extraction"
        with zipfile.ZipFile(output) as archive:
            archive.extractall(extract)
        fresh = verifier_result(extract / ROOT_NAME, deep=True)
        if fresh.returncode:
            raise SystemExit(fresh.stdout)
        result = {
            "output": str(output),
            "sha256": sha256(output),
            "bytes": output.stat().st_size,
            "commit": head,
            "tree": tree,
            "parent": BASE,
            "stageDeepVerification": deep.stdout.strip(),
            "freshExtractionDeepVerification": fresh.stdout.strip(),
            "negativeControls": "PASS",
        }
        print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
