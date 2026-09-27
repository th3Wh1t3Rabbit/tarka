#!/usr/bin/env python3
"""Build and deeply verify the S17-P2-R1 Principal-feedback return bundle."""

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

BASE = "f7d8ea5ecf0984b3ca4fbcf1272126c0d136d815"
BASE_TREE = "93a975c232b8a68a8e940f93ef6a10d8229f1805"
BASE_PARENT = "09aee898c078ddcf1d8abf20c1815cc11486beea"
PROTECTED_BASE = BASE_PARENT
PACKET_SHA = "886a96f36f5efc9815adba480c3d1fe1175377904b80f8764260b89c170f1237"
ROOT_NAME = "TRACE_ESCAPE_CODEX_TO_MAIN_S17_P2_R1_PRINCIPAL_FEEDBACK_AND_TERMINAL_FIDELITY_v1.0.0_2026-09-26"
DEFAULT_OUTPUT = Path("/path/to/local-user/Downloads") / f"{ROOT_NAME}.zip"
DEFAULT_PACKET = Path("/tmp/trace-escape-s17-p2.hRNIgO")


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
    files = []
    for path in sorted(item for item in stage.rglob("*") if item.is_file() and item.name != "MANIFEST.json"):
        files.append({"path": path.relative_to(stage).as_posix(), "size": path.stat().st_size, "sha256": sha256(path)})
    return {
        "schema": "tarka.s17-p2-r1.return-manifest.v1",
        "status": "COMPLETE_PENDING_MAIN_AND_PRINCIPAL_REVIEW",
        "identity": identity,
        "files": files,
    }


VERIFIER = r'''#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, subprocess, sys, tempfile
from pathlib import Path

PACKET_SHA = "886a96f36f5efc9815adba480c3d1fe1175377904b80f8764260b89c170f1237"
BASE = "f7d8ea5ecf0984b3ca4fbcf1272126c0d136d815"
BASE_TREE = "93a975c232b8a68a8e940f93ef6a10d8229f1805"
BASE_PARENT = "09aee898c078ddcf1d8abf20c1815cc11486beea"
PROTECTED_BASE = BASE_PARENT

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
    if result.returncode:
        fail(f"command failed ({' '.join(args)}): {result.stdout[-2000:]}")
    return result.stdout.strip()

def verify_protected(root, recovered):
    protected = json.loads((root / "INPUT_AUTHORITY" / "PROTECTED_FILES.json").read_text(encoding="utf-8"))
    rows = protected.get("files", [])
    if protected.get("base") != PROTECTED_BASE or len(rows) != 553:
        fail("protected manifest authority mismatch")
    for row in rows:
        name = row.get("path")
        expected = row.get("sha256")
        candidate = recovered / name
        if not candidate.is_file() or digest(candidate) != expected:
            fail(f"protected candidate byte mismatch: {name}")

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
authorization = json.loads((root / "INPUT_AUTHORITY" / "AUTHORIZATION.json").read_text(encoding="utf-8"))
if authorization.get("candidate") != BASE or authorization.get("tree") != BASE_TREE or authorization.get("soleParent") != BASE_PARENT:
    fail("incoming authorization identity mismatch")
if authorization.get("sourceEdits") is not False or authorization.get("protectedPort") != 4174:
    fail("incoming frozen-build limitations were not preserved as evidence")
receipt = json.loads((root / "INPUT_AUTHORITY" / "PACKET_RECEIPT.json").read_text(encoding="utf-8"))
if receipt.get("sha256") != PACKET_SHA: fail("incoming packet hash mismatch")
report = (root / "EVIDENCE" / "PRINCIPAL_FEEDBACK_REGISTER.md").read_text(encoding="utf-8")
for phrase in ["Full-text one-frame placement blip", "`USE FORM` produced the VHS line", "Open drawer hotspot placement", "Nansen terminal fidelity and audio", "exactly 50% below"]:
    if phrase not in report: fail(f"feedback register omission: {phrase}")

if args.deep:
    bundle = root / "REPOSITORY.bundle"
    patch = root / "S17_P2_R1.full-index.binary.patch"
    with tempfile.TemporaryDirectory(prefix="s17-p2-r1-verify-") as td:
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
        verify_protected(root, recovered)
        reconstruction = temp / "reconstruction"
        call(["git", "clone", "--quiet", str(bundle), str(reconstruction)], temp)
        call(["git", "checkout", "--quiet", BASE], reconstruction)
        call(["git", "apply", "--index", "--binary", str(patch)], reconstruction)
        rebuilt_tree = call(["git", "write-tree"], reconstruction)
        if rebuilt_tree != identity["tree"]: fail(f"patch tree mismatch: {rebuilt_tree}")

print("PASS: S17-P2-R1 member set, hashes, authority, identity" + (", protected bytes, Git recovery/fsck, and patch reconstruction" if args.deep else ""))
'''


def verifier_result(stage: Path, deep: bool = False) -> subprocess.CompletedProcess[str]:
    args = [sys.executable, "VERIFY_RETURN.py"] + (["--deep"] if deep else [])
    return subprocess.run(args, cwd=stage, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


def rebuild_manifest(stage: Path, identity: dict[str, object]) -> None:
    write(stage / "MANIFEST.json", json.dumps(manifest_for(stage, identity), indent=2) + "\n")


def main() -> int:
    repo = Path.cwd().resolve()
    output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_OUTPUT
    packet = Path(os.environ.get("S17_P2_PACKET", str(DEFAULT_PACKET))).resolve()
    head = run(["git", "rev-parse", "HEAD"], repo).stdout.strip()
    tree = run(["git", "rev-parse", "HEAD^{tree}"], repo).stdout.strip()
    parents = run(["git", "show", "-s", "--format=%P", "HEAD"], repo).stdout.strip().split()
    if parents != [BASE]:
        raise SystemExit(f"HEAD must be the sole child of {BASE}; got parents {parents}")
    if run(["git", "status", "--porcelain", "--untracked-files=no"], repo).stdout.strip():
        raise SystemExit("tracked worktree must be clean before return packaging")
    required_authority = ["AUTHORIZATION.json", "KNOWN_PAPER_FINDING.md", "MAIN_REVIEW.md", "PROTECTED_FILES.json"]
    if any(not (packet / name).is_file() for name in required_authority):
        raise SystemExit(f"input authority directory is incomplete: {packet}")

    identity: dict[str, object] = {
        "schema": "tarka.s17-p2-r1.final-git-identity.v1",
        "commit": head,
        "tree": tree,
        "parent": BASE,
        "parentCount": 1,
        "base": BASE,
        "baseTree": BASE_TREE,
        "baseParent": BASE_PARENT,
        "incomingPacketSha256": PACKET_SHA,
        "status": "COMPLETE_PENDING_MAIN_AND_PRINCIPAL_REVIEW",
    }

    with tempfile.TemporaryDirectory(prefix="s17-p2-r1-return-") as td:
        temp = Path(td)
        stage = temp / ROOT_NAME
        stage.mkdir()
        shutil.copytree(repo / "review" / "s17-p1-r1", stage / "EVIDENCE")
        authority_stage = stage / "INPUT_AUTHORITY"
        authority_stage.mkdir()
        for name in required_authority:
            shutil.copy2(packet / name, authority_stage / name)
        write(authority_stage / "PACKET_RECEIPT.json", json.dumps({
            "schema": "tarka.s17-p2-r1.packet-receipt.v1",
            "file": "TRACE_ESCAPE_MAIN_TO_CODEX_S17_P2_FROZEN_PLAYTEST_2_PREPARATION_v1.0.0_2026-09-26.zip",
            "sha256": PACKET_SHA,
            "note": "The packet is retained as the frozen-build authority. Its no-source-edit limitation was explicitly superseded for this child candidate by the Principal's later direct instruction.",
        }, indent=2) + "\n")
        write(stage / "FINAL_GIT_IDENTITY.json", json.dumps(identity, indent=2) + "\n")
        write(stage / "CHANGED_PATHS.txt", run(["git", "diff", "--name-status", BASE, head], repo).stdout)
        write(stage / "S17_P2_R1.full-index.binary.patch", run(["git", "diff", "--binary", "--full-index", BASE, head], repo).stdout)
        run(["git", "bundle", "create", str(stage / "REPOSITORY.bundle"), "HEAD"], repo)
        write(stage / "VERIFY_RETURN.py", VERIFIER)
        os.chmod(stage / "VERIFY_RETURN.py", 0o755)
        write(stage / "START_HERE.md", """# TARKA S17-P2-R1 return

Status: **COMPLETE_PENDING_MAIN_AND_PRINCIPAL_REVIEW**. This is a Principal-authorized corrective child of the reviewed R1 candidate. It is not Principal/MAIN acceptance, deployment, publication, protected-ref promotion, or Playtest 2 authorization.

Begin with `READ_ORDER.txt`, then run `python3 VERIFY_RETURN.py --deep` from this directory. The return contains the exact one-child commit, a full-index binary patch, a complete recoverable Git bundle, the original frozen-build authority, the complete Principal feedback register, qualification evidence, and actual-browser captures.

Port 4174 and the frozen build on port 43623 were not modified. The corrected source was exercised only on the isolated development port 4175.
""")
        write(stage / "READ_ORDER.txt", """START_HERE.md
FINAL_GIT_IDENTITY.json
INPUT_AUTHORITY/PACKET_RECEIPT.json
INPUT_AUTHORITY/AUTHORIZATION.json
INPUT_AUTHORITY/MAIN_REVIEW.md
INPUT_AUTHORITY/KNOWN_PAPER_FINDING.md
INPUT_AUTHORITY/PROTECTED_FILES.json
EVIDENCE/PRINCIPAL_FEEDBACK_REGISTER.md
EVIDENCE/CORRECTION_REPORT.md
EVIDENCE/CARRIED_VS_NEW.md
EVIDENCE/TEST_EXECUTION.json
EVIDENCE/PROTECTED_INTEGRITY.json
EVIDENCE/SCREENSHOTS/INDEX.json
EVIDENCE/FACTS_DELTA_FOR_SUPPORT_LANE.md
EVIDENCE/LAUNCH_RECIPE.md
CHANGED_PATHS.txt
RECOVERY.md
MANIFEST.json
VERIFY_RETURN.py
""")
        write(stage / "RECOVERY.md", f"""# Recovery

Verify first with `python3 VERIFY_RETURN.py --deep`.

Complete repository recovery: `git clone REPOSITORY.bundle recovered-s17-p2-r1`. The recovered HEAD must equal `{head}` with tree `{tree}` and sole parent `{BASE}`.

Patch reconstruction: check out `{BASE}` in a compatible clone, then run `git apply --index --binary S17_P2_R1.full-index.binary.patch`. `git write-tree` must equal `{tree}`. The deep verifier performs both procedures in temporary directories, runs strict full Git fsck, and rechecks all 553 protected files in the recovered candidate.
""")
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
                receipt_path = target / "INPUT_AUTHORITY" / "PACKET_RECEIPT.json"
                receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
                receipt["sha256"] = "0" * 64
                write(receipt_path, json.dumps(receipt, indent=2) + "\n")
                rebuild_manifest(target, identity)
            result = verifier_result(target)
            controls[name] = {"expectedFailure": True, "failed": result.returncode != 0, "outputTail": result.stdout[-1000:]}
            if result.returncode == 0:
                raise SystemExit(f"negative control unexpectedly passed: {name}")

        write(stage / "VERIFICATION" / "negative-controls.json", json.dumps({
            "schema": "tarka.s17-p2-r1.negative-controls.v1",
            "status": "PASS",
            "controls": controls,
            "note": "The authority control regenerated its manifest so semantic packet pinning, not only file-digest rejection, caused failure.",
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
        print(json.dumps({
            "output": str(output),
            "sha256": sha256(output),
            "bytes": output.stat().st_size,
            "commit": head,
            "tree": tree,
            "parent": BASE,
            "stageDeepVerification": deep.stdout.strip(),
            "freshExtractionDeepVerification": fresh.stdout.strip(),
            "negativeControls": "PASS",
        }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
