#!/usr/bin/env python3
"""Build and deeply verify the minimal S17-P1-R1 return bundle."""

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

BASE = "09aee898c078ddcf1d8abf20c1815cc11486beea"
BASE_TREE = "cd3f421637426e48783ac0033a8516cd58cafe69"
BASE_PARENT = "190d0ec0e48853871acfb2f70f97c4e61a9f4592"
PACKET_SHA = "57b536f803ef0eaa88bcd6f917ba950154b41ff81e97b56c15b522846ac4ba1d"
ROOT_NAME = "TRACE_ESCAPE_CODEX_TO_MAIN_S17_P1_R1_SPEECH_DISPLAY_AND_FINAL_ROOM_CLOSEOUT_v1.0.0_2026-09-26"
DEFAULT_OUTPUT = Path("/path/to/local-user/Downloads") / f"{ROOT_NAME}.zip"
DEFAULT_PROBES = Path("/tmp/s17-p1-r1-probes.Dz75gS")
DEFAULT_PACKET = Path("/tmp/trace-escape-s17-p1-r1.Efrici")


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
        "schema": "tarka.s17-p1-r1.return-manifest.v1",
        "status": "COMPLETE_PENDING_MAIN_REVIEW",
        "identity": identity,
        "files": files,
    }


VERIFIER = r'''#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, subprocess, sys, tempfile
from pathlib import Path

PACKET_SHA = "57b536f803ef0eaa88bcd6f917ba950154b41ff81e97b56c15b522846ac4ba1d"
BASE = "09aee898c078ddcf1d8abf20c1815cc11486beea"
BASE_TREE = "cd3f421637426e48783ac0033a8516cd58cafe69"
BASE_PARENT = "190d0ec0e48853871acfb2f70f97c4e61a9f4592"

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
receipt = json.loads((root / "EVIDENCE" / "SOURCE_AUTHORITY_RECEIPT.json").read_text(encoding="utf-8"))
if receipt.get("incomingPacket", {}).get("sha256") != PACKET_SHA: fail("incoming authority pin mismatch")
if receipt.get("exactBase", {}).get("commit") != BASE or receipt.get("exactBase", {}).get("tree") != BASE_TREE:
    fail("source receipt base mismatch")
if receipt.get("p1Authority", {}).get("finalScript", {}).get("bubbles") != 724: fail("final script authority count mismatch")
if receipt.get("p1Authority", {}).get("reachability", {}).get("rows") != 43: fail("reachability authority count mismatch")
protected = json.loads((root / "EVIDENCE" / "PROTECTED_INTEGRITY.json").read_text(encoding="utf-8"))
if protected.get("checked") != 553 or protected.get("failures") != 0 or not protected.get("pass"):
    fail("protected integrity evidence mismatch")
base_identity = json.loads((root / "INPUT_AUTHORITY" / "BASE_IDENTITY.json").read_text(encoding="utf-8"))
if base_identity.get("candidate") != BASE or base_identity.get("tree") != BASE_TREE or base_identity.get("parent") != BASE_PARENT:
    fail("original P1 base identity mismatch")
protected_manifest = json.loads((root / "INPUT_AUTHORITY" / "PROTECTED_FILES.json").read_text(encoding="utf-8"))
if protected_manifest.get("base") != BASE or len(protected_manifest.get("files", [])) != 553:
    fail("original protected manifest mismatch")

if args.deep:
    bundle = root / "REPOSITORY.bundle"
    patch = root / "S17_P1_R1.full-index.binary.patch"
    with tempfile.TemporaryDirectory(prefix="s17-p1-r1-verify-") as td:
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

print("PASS: S17-P1-R1 return member set, hashes, authority, identity" + (", Git recovery/fsck, and patch reconstruction" if args.deep else ""))
'''


def verifier_result(stage: Path, deep: bool = False) -> subprocess.CompletedProcess[str]:
    args = [sys.executable, "VERIFY_RETURN.py"] + (["--deep"] if deep else [])
    return subprocess.run(args, cwd=stage, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


def rebuild_manifest(stage: Path, identity: dict[str, object]) -> None:
    write(stage / "MANIFEST.json", json.dumps(manifest_for(stage, identity), indent=2) + "\n")


def main() -> int:
    repo = Path.cwd().resolve()
    output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_OUTPUT
    probes = Path(os.environ.get("S17_P1_R1_PROBES", str(DEFAULT_PROBES))).resolve()
    packet = Path(os.environ.get("S17_P1_R1_PACKET", str(DEFAULT_PACKET))).resolve()
    head = run(["git", "rev-parse", "HEAD"], repo).stdout.strip()
    tree = run(["git", "rev-parse", "HEAD^{tree}"], repo).stdout.strip()
    parents = run(["git", "show", "-s", "--format=%P", "HEAD"], repo).stdout.strip().split()
    if parents != [BASE]:
        raise SystemExit(f"HEAD must be the sole child of {BASE}; got parents {parents}")
    if run(["git", "status", "--porcelain", "--untracked-files=no"], repo).stdout.strip():
        raise SystemExit("tracked worktree must be clean before return packaging")
    required_probes = ["authority-comparison.json", "blocked-layout.json", "room-storage.json", "source-integrity.json", "terminal-and-deltas.json"]
    if any(not (probes / name).is_file() for name in required_probes):
        raise SystemExit(f"postcommit probe directory is incomplete: {probes}")
    required_authority = ["BASE_IDENTITY.json", "PROTECTED_FILES.json"]
    if any(not (packet / name).is_file() for name in required_authority):
        raise SystemExit(f"input authority directory is incomplete: {packet}")
    for name in required_probes:
        report = json.loads((probes / name).read_text(encoding="utf-8"))
        candidate = report.get("candidate")
        if candidate is not None and candidate != head:
            raise SystemExit(f"probe {name} is for {candidate}, expected {head}")

    identity: dict[str, object] = {
        "schema": "tarka.s17-p1-r1.final-git-identity.v1",
        "commit": head,
        "tree": tree,
        "parent": BASE,
        "parentCount": 1,
        "base": BASE,
        "baseTree": BASE_TREE,
        "baseParent": BASE_PARENT,
        "status": "COMPLETE_PENDING_MAIN_REVIEW",
    }

    with tempfile.TemporaryDirectory(prefix="s17-p1-r1-return-") as td:
        temp = Path(td)
        stage = temp / ROOT_NAME
        stage.mkdir()
        shutil.copytree(repo / "review" / "s17-p1-r1", stage / "EVIDENCE")
        probe_stage = stage / "EVIDENCE" / "POSTCOMMIT_PROBES"
        probe_stage.mkdir()
        for name in required_probes:
            shutil.copy2(probes / name, probe_stage / name)
        authority_stage = stage / "INPUT_AUTHORITY"
        authority_stage.mkdir()
        for name in required_authority:
            shutil.copy2(packet / name, authority_stage / name)
        write(stage / "FINAL_GIT_IDENTITY.json", json.dumps(identity, indent=2) + "\n")
        write(stage / "CHANGED_PATHS.txt", run(["git", "diff", "--name-status", BASE, head], repo).stdout)
        write(stage / "S17_P1_R1.full-index.binary.patch", run(["git", "diff", "--binary", "--full-index", BASE, head], repo).stdout)
        run(["git", "bundle", "create", str(stage / "REPOSITORY.bundle"), "HEAD"], repo)
        write(stage / "VERIFY_RETURN.py", VERIFIER)
        os.chmod(stage / "VERIFY_RETURN.py", 0o755)
        write(stage / "START_HERE.md", """# TARKA S17-P1-R1 return

Status: **COMPLETE_PENDING_MAIN_REVIEW**. This is a correction candidate, not Principal/MAIN acceptance or release.

Begin with `READ_ORDER.txt`, then run `python3 VERIFY_RETURN.py --deep` from this directory. The return contains the exact one-child commit, full-index binary patch, complete recoverable Git bundle, correction report, source authority, executed-versus-carried qualification, targeted semantic mutants, postcommit source probes, and named actual-browser captures.

No Playtest 2 authorization, protected-ref promotion, deployment, publication, provider access, human audio audition, or rights determination is included. Port 4174 was not touched.
""")
        write(stage / "READ_ORDER.txt", """START_HERE.md
FINAL_GIT_IDENTITY.json
INPUT_AUTHORITY/BASE_IDENTITY.json
INPUT_AUTHORITY/PROTECTED_FILES.json
EVIDENCE/SOURCE_AUTHORITY_RECEIPT.json
EVIDENCE/CORRECTION_REPORT.md
EVIDENCE/CARRIED_VS_NEW.md
EVIDENCE/TEST_EXECUTION.json
EVIDENCE/MUTATIONS/semantic-mutants.json
EVIDENCE/PROTECTED_INTEGRITY.json
EVIDENCE/POSTCOMMIT_PROBES/blocked-layout.json
EVIDENCE/POSTCOMMIT_PROBES/room-storage.json
EVIDENCE/POSTCOMMIT_PROBES/terminal-and-deltas.json
EVIDENCE/FACTS_DELTA_FOR_SUPPORT_LANE.md
EVIDENCE/LAUNCH_RECIPE.md
CHANGED_PATHS.txt
RECOVERY.md
MANIFEST.json
VERIFY_RETURN.py
""")
        write(stage / "RECOVERY.md", f"""# Recovery

Verify first with `python3 VERIFY_RETURN.py --deep`.

Complete repository recovery: `git clone REPOSITORY.bundle recovered-s17-p1-r1`. The recovered HEAD must equal `{head}` with tree `{tree}` and sole parent `{BASE}`.

Patch reconstruction: check out `{BASE}` in a compatible clone, then run `git apply --index --binary S17_P1_R1.full-index.binary.patch`. `git write-tree` must equal `{tree}`. The deep verifier performs both procedures in temporary directories and runs strict full Git fsck.
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
            "schema": "tarka.s17-p1-r1.negative-controls.v1",
            "status": "PASS",
            "controls": controls,
            "note": "The authority control regenerated its manifest so semantic pinning, not only file-digest rejection, caused failure.",
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
