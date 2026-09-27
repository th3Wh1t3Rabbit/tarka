#!/usr/bin/env python3
from hashlib import sha256
from pathlib import Path
import json
import subprocess
import tempfile

root = Path(__file__).resolve().parent
binding = json.loads((root / 'FINAL_BINDING.json').read_text())
errors = []
manifest_entries = {}
for line in (root / 'MANIFEST.sha256').read_text().splitlines():
    digest, rel = line.split('  ', 1)
    manifest_entries[rel] = digest
    path = root / rel
    if not path.is_file():
        errors.append('missing ' + rel)
    elif sha256(path.read_bytes()).hexdigest() != digest:
        errors.append('hash ' + rel)

actual_files = {
    path.relative_to(root).as_posix()
    for path in root.rglob('*')
    if path.is_file() and path.name != 'MANIFEST.sha256'
}
if actual_files != set(manifest_entries):
    errors.append('manifest-membership')
for rel in actual_files:
    lowered = rel.lower()
    if '/node_modules/' in f'/{lowered}/' or lowered.endswith('.zip') or '/traces/' in f'/{lowered}/':
        errors.append('forbidden-member ' + rel)
    if rel.startswith('/') or '..' in Path(rel).parts:
        errors.append('unsafe-path ' + rel)

expected_paths = (root / 'GIT/CHANGED_PATHS.txt').read_text().splitlines()
if expected_paths != sorted(expected_paths) or len(expected_paths) != len(set(expected_paths)):
    errors.append('changed-paths-order-or-duplicate')

with tempfile.TemporaryDirectory() as td:
    temporary = Path(td)
    verify_repo = temporary / 'verify-repo'
    repo = temporary / 'reconstructed-repo'
    subprocess.run(['git', 'init', '-q', str(verify_repo)], check=True)
    check = subprocess.run(['git', '-C', str(verify_repo), 'bundle', 'verify', str(root / 'GIT/CANDIDATE.bundle')], capture_output=True, text=True)
    if check.returncode:
        errors.append('bundle ' + check.stderr.strip())
    else:
        subprocess.run(['git', 'clone', '-q', str(root / 'GIT/CANDIDATE.bundle'), str(repo)], check=True)
        subprocess.run(['git', '-C', str(repo), 'checkout', '-q', binding['candidate']], check=True)
        fsck = subprocess.run(['git', '-C', str(repo), 'fsck', '--strict', '--full'], capture_output=True, text=True)
        if fsck.returncode:
            errors.append('fsck ' + fsck.stderr.strip())
        commit = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip()
        tree = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD^{tree}'], text=True).strip()
        parents = subprocess.check_output(['git', '-C', str(repo), 'rev-list', '--parents', '-n', '1', 'HEAD'], text=True).split()
        parent = parents[1] if len(parents) == 2 else 'NON_SINGLE_PARENT'
        changed = subprocess.check_output(['git', '-C', str(repo), 'diff', '--name-only', binding['parent'], binding['candidate']], text=True).splitlines()
        if commit != binding['candidate']:
            errors.append('candidate ' + commit)
        if tree != binding['tree']:
            errors.append('tree ' + tree)
        if parent != binding['parent']:
            errors.append('parent ' + parent)
        if changed != expected_paths:
            errors.append('changed-paths')
        subprocess.run(['git', '-C', str(repo), 'checkout', '-q', binding['parent']], check=True)
        patch = subprocess.run(['git', '-C', str(repo), 'apply', '--index', str(root / 'GIT/FULL_INDEX_BINARY.patch')], capture_output=True, text=True)
        if patch.returncode:
            errors.append('patch ' + patch.stderr.strip())
        else:
            patched = subprocess.check_output(['git', '-C', str(repo), 'write-tree'], text=True).strip()
            if patched != binding['tree']:
                errors.append('patch-tree ' + patched)

if errors:
    print('FAIL')
    print('\n'.join(errors))
    raise SystemExit(1)
print('PASS S15-R9 manifest, complete bundle reconstruction, exact candidate/tree/sole parent/changed paths, and full-index binary patch')
