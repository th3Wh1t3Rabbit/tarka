#!/usr/bin/env python3
"""Execute the 41 isolated fail-closed mutations required by S12-P3-R4."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

PROBES = [
    ("01_edges_removed", "state_graph_exact"), ("02_dangling_target", "dangling_edge"), ("03_fake_clip", "fake_clip"),
    ("04_fake_catalog", "catalog_identity"), ("05_false_speaker", "false_speaker"), ("06_effects_removed", "menu_semantics_exact"),
    ("07_ledger_missing", "evidence_missing:REGISTRY/r55-source-ledger.json"),
    ("08_graph_validation_missing", "evidence_missing:GRAPH_VALIDATION.json"), ("09_evidence_missing", "evidence_missing:ENGINE_HARNESS.json"),
    ("10_production_activation", "production_artifact"), ("11_id_drift", "unstable_id"), ("12_a1_actor", "performance_projection"),
    ("13_choices_removed", "menu_count"), ("14_predicates_removed", "menu_semantics_exact"), ("15_ledger_empty", "ledger_exact"),
    ("16_registry_ledger_missing", "registry_ledger_mismatch"), ("17_coverage_zero", "coverage_claim"),
    ("18_catalog_mismatch", "performance_projection"), ("19_idle_substitution", "idle_substitution"), ("20_graph_contradiction", "graph_receipt"),
    ("21_offset_ids", "unstable_id"), ("22_global_choices", "engine_harness"), ("23_foreign_edge", "engine_harness"),
    ("24_synthetic_traverse", "synthetic_traverse"), ("25_raw_source_erased", "raw_span_mismatch"),
    ("26_trailing_span_deleted", "source_reconstruction"), ("27_state_graph_removed", "state_graph_exact"),
    ("28_cross_line_and_duplicate_edges", "duplicate_edge"), ("29_false_action_choice", "false_choice:OPEN / CLOSE"),
    ("30_predicate_after_selection", "menu_semantics_exact"),
    ("31_per_cue_or_map_tamper", "per_cue_catalog"),
    ("32_git_test_probe_provenance_deleted", "evidence_missing:REGISTRY/r55-provenance.json"),
    ("33_production_hash_boolean_only", "production_artifact"),
    ("34_dialogue_node_text_changed", "node_ledger_dialogue"),
    ("35_valid_speaker_swapped", "node_ledger_dialogue"),
    ("36_choice_response_redirect", "menu_response_exact"),
    ("37_state_effects_removed", "state_effect_exact"),
    ("38_cue_actor_and_projection_rebuilt", "cue_subject_exact"),
    ("39_patch_replaced_receipt_updated", "sealed_payload:GIT/CANDIDATE.patch"),
    ("40_bundle_pack_corrupt_receipt_updated", "git_bundle_recovery"),
    ("41_subject_object_actor_regression", "cue_subject_exact"),
]


def write_bytes(path: Path, data: bytes) -> None:
    temporary = path.with_name(path.name + ".probe-tmp")
    temporary.write_bytes(data)
    temporary.replace(path)


def load(root: Path, rel: str):
    return json.loads((root / rel).read_text(encoding="utf-8"))


def save(root: Path, rel: str, value) -> None:
    write_bytes(root / rel, (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode())


def registry(root: Path):
    return load(root, "REGISTRY/r55-registry.json")


def save_registry(root: Path, value) -> None:
    save(root, "REGISTRY/r55-registry.json", value)


def first_cue(document):
    return next(cue for node in document["graph"]["nodes"] for cue in node.get("cues", []))


def rebuild_performance(root: Path, document) -> None:
    fields = ("actor", "intent", "preferredClip", "selectedClip", "manifestPath", "manifestBlob", "manifestSha256", "selectionBlob", "selectionSha256", "membership", "fallback", "fallbackReason", "changesStoryMeaning")
    rows = {}
    for node in document["graph"]["nodes"]:
        for cue in node.get("cues", []):
            key = (cue["actor"], cue["intent"], cue.get("selectedClip"))
            rows.setdefault(key, {field: cue.get(field) for field in fields})
    performance = load(root, "REGISTRY/r55-performance-map.json")
    performance["mappings"] = sorted(rows.values(), key=lambda row: (row["actor"], row["intent"], row["selectedClip"] or ""))
    save(root, "REGISTRY/r55-performance-map.json", performance)


def rebuild_audit(document) -> None:
    audit = document["cueSubjectAudit"]
    audit["records"] = [
        {"nodeId": node["id"], "cueIndex": index, "sourceText": cue["sourceText"], "actor": cue["actor"], "subjectResolution": cue["subjectResolution"], "leadingSubject": cue["leadingSubject"]}
        for node in document["graph"]["nodes"] for index, cue in enumerate(node.get("cues", []))
    ]


def menu_edge(document, option: str):
    nodes = {node["id"]: node for node in document["graph"]["nodes"]}
    return next(edge for edge in document["graph"]["edges"] if edge["kind"] == "TOPIC_CHOICE" and nodes[edge["target"]]["text"] == option and nodes[edge["source"]]["anchor"] == "Postauthorization root menu")


def mutate(root: Path, probe_id: str) -> None:
    if probe_id in {"01_edges_removed", "27_state_graph_removed"}:
        document = registry(root)
        document["graph"]["edges"] = [] if probe_id == "01_edges_removed" else [edge for edge in document["graph"]["edges"] if edge["kind"] != "STATE_MACHINE"]
        save_registry(root, document)
    elif probe_id == "02_dangling_target":
        document = registry(root); document["graph"]["edges"][0]["target"] = "r55-00000000000000000000"; save_registry(root, document)
    elif probe_id == "03_fake_clip":
        document = registry(root); first_cue(document)["selectedClip"] = "FAKE.NONEXISTENT.CLIP"; save_registry(root, document)
    elif probe_id == "04_fake_catalog":
        document = registry(root); document["catalog"]["manifestBlob"] = "FAKE"; save_registry(root, document)
    elif probe_id == "05_false_speaker":
        document = registry(root); next(node for node in document["graph"]["nodes"] if node["kind"] == "dialogueLine")["speaker"] = "TOPIC"; save_registry(root, document)
    elif probe_id == "06_effects_removed":
        document = registry(root); menu_edge(document, "DID YOU CATCH THE GAME THIS WEEKEND?")["effects"] = []; save_registry(root, document)
    elif probe_id == "07_ledger_missing":
        (root / "REGISTRY/r55-source-ledger.json").unlink()
    elif probe_id == "08_graph_validation_missing":
        (root / "GRAPH_VALIDATION.json").unlink()
    elif probe_id == "09_evidence_missing":
        (root / "ENGINE_HARNESS.json").unlink()
    elif probe_id == "10_production_activation":
        path = root / "PRODUCTION/index-DBC_kJlO.js"; write_bytes(path, path.read_bytes() + b"\nr55Review\n")
    elif probe_id == "11_id_drift":
        document = registry(root); document["graph"]["nodes"][0]["id"] = "r55-byte-offset-100"; save_registry(root, document)
    elif probe_id == "12_a1_actor":
        document = registry(root); first_cue(document)["actor"] = "rook"; save_registry(root, document)
    elif probe_id == "13_choices_removed":
        document = registry(root); choice_ids = {node["id"] for node in document["graph"]["nodes"] if node["kind"] in {"choice", "menu"}}; document["graph"]["nodes"] = [node for node in document["graph"]["nodes"] if node["id"] not in choice_ids]; document["graph"]["edges"] = [edge for edge in document["graph"]["edges"] if edge["source"] not in choice_ids and edge["target"] not in choice_ids]; save_registry(root, document)
    elif probe_id == "14_predicates_removed":
        document = registry(root)
        for edge in document["graph"]["edges"]: edge["predicate"] = None
        save_registry(root, document)
    elif probe_id == "15_ledger_empty":
        document = load(root, "REGISTRY/r55-source-ledger.json"); document["entries"] = []; save(root, "REGISTRY/r55-source-ledger.json", document)
    elif probe_id == "16_registry_ledger_missing":
        document = registry(root); document.pop("sourceLedger", None); save_registry(root, document)
    elif probe_id == "17_coverage_zero":
        document = load(root, "REGISTRY/r55-source-ledger.json"); document["coverage"]["exactReconstructions"] = 0; save(root, "REGISTRY/r55-source-ledger.json", document)
    elif probe_id == "18_catalog_mismatch":
        document = load(root, "REGISTRY/r55-performance-map.json"); document["catalog"]["selectionBlob"] = "FAKE"; save(root, "REGISTRY/r55-performance-map.json", document)
    elif probe_id == "19_idle_substitution":
        document = registry(root); cue = next(cue for node in document["graph"]["nodes"] for cue in node.get("cues", []) if cue.get("actor") == "rook" and cue.get("intent") == "MOVEMENT"); cue["selectedClip"] = "characters.rook.animations.idle"; save_registry(root, document)
    elif probe_id == "20_graph_contradiction":
        document = load(root, "GRAPH_VALIDATION.json"); document["nodes"] += 1; save(root, "GRAPH_VALIDATION.json", document)
    elif probe_id == "21_offset_ids":
        document = registry(root); document["graph"]["nodes"][0]["id"] = "r55-offset-000000000000"; save_registry(root, document)
    elif probe_id == "22_global_choices":
        document = load(root, "ENGINE_HARNESS.json"); document["currentNodeEdgesOnly"] = False; save(root, "ENGINE_HARNESS.json", document)
    elif probe_id == "23_foreign_edge":
        document = load(root, "ENGINE_HARNESS.json"); document["rejectForeignEdges"] = False; save(root, "ENGINE_HARNESS.json", document)
    elif probe_id == "24_synthetic_traverse":
        document = registry(root); document["graph"]["edges"][0]["effects"].append({"type": "traverse:fake", "once": False, "sourceId": "fake"}); save_registry(root, document)
    elif probe_id == "25_raw_source_erased":
        ledger = load(root, "REGISTRY/r55-source-ledger.json")
        for entry in ledger["entries"]:
            if entry.get("classification") == "EXECUTABLE_STORY_SOURCE": entry["rawText"] = ""
        save(root, "REGISTRY/r55-source-ledger.json", ledger)
        document = registry(root); document["sourceLedger"] = ledger["entries"]; save_registry(root, document)
    elif probe_id == "26_trailing_span_deleted":
        ledger = load(root, "REGISTRY/r55-source-ledger.json"); path = ledger["coverage"]["partitions"][0]["path"]; candidates = [entry for entry in ledger["entries"] if entry.get("path") == path and entry.get("classification") == "EXECUTABLE_STORY_SOURCE"]; victim = max(candidates, key=lambda entry: entry["byteEnd"]); ledger["entries"].remove(victim); ledger["coverage"]["uncoveredBytes"] = 0; save(root, "REGISTRY/r55-source-ledger.json", ledger); document = registry(root); document["sourceLedger"] = ledger["entries"]; save_registry(root, document)
    elif probe_id == "28_cross_line_and_duplicate_edges":
        document = registry(root); nodes = {node["text"]: node["id"] for node in document["graph"]["nodes"] if node["kind"] == "system"}; edges = document["graph"]["edges"]; edges.append(dict(next(edge for edge in edges if edge["kind"] == "STATE_MACHINE"))); edges.append({"kind": "STATE_MACHINE", "source": nodes["OPENING_CUTSCENE"], "target": nodes["TITLE_CREDITS"], "predicate": None, "effects": []}); save_registry(root, document)
    elif probe_id == "29_false_action_choice":
        document = registry(root); menu = next(node for node in document["graph"]["nodes"] if node["kind"] == "menu"); fake = dict(next(node for node in document["graph"]["nodes"] if node["kind"] == "choice")); fake["id"] = "r55-00000000000000000001"; fake["text"] = "OPEN / CLOSE"; document["graph"]["nodes"].append(fake); document["graph"]["edges"].append({"kind": "TOPIC_CHOICE", "source": menu["id"], "target": fake["id"], "predicate": None, "effects": []}); save_registry(root, document)
    elif probe_id == "30_predicate_after_selection":
        document = registry(root); edge = menu_edge(document, "DID YOU CATCH THE GAME THIS WEEKEND?"); predicate = edge["predicate"]; edge["predicate"] = None; response = next(item for item in document["graph"]["edges"] if item["source"] == edge["target"]); response["predicate"] = predicate; save_registry(root, document)
    elif probe_id == "31_per_cue_or_map_tamper":
        document = registry(root); first_cue(document)["manifestSha256"] = "0" * 64; save_registry(root, document); mapping = load(root, "REGISTRY/r55-performance-map.json"); mapping["mappings"] = []; save(root, "REGISTRY/r55-performance-map.json", mapping)
    elif probe_id == "32_git_test_probe_provenance_deleted":
        for rel in ("REGISTRY/r55-provenance.json", "GIT/CANDIDATE.patch", "LOGS/unit.txt", "NEGATIVE_PROBE_RESULTS.json"):
            (root / rel).unlink()
    elif probe_id == "33_production_hash_boolean_only":
        path = root / "PRODUCTION/index-DBC_kJlO.js"; blob = bytearray(path.read_bytes()); blob[0] ^= 1; write_bytes(path, bytes(blob)); receipt = load(root, "PRODUCTION_NON_ACTIVATION.json"); receipt["sha256"] = hashlib.sha256(bytes(blob)).hexdigest(); receipt["registryAbsent"] = True; receipt["ordinaryReviewOpensHarness"] = False; save(root, "PRODUCTION_NON_ACTIVATION.json", receipt)
    elif probe_id == "34_dialogue_node_text_changed":
        document = registry(root); next(node for node in document["graph"]["nodes"] if node["kind"] == "dialogueLine")["text"] += " altered"; save_registry(root, document)
    elif probe_id == "35_valid_speaker_swapped":
        document = registry(root); node = next(node for node in document["graph"]["nodes"] if node["kind"] == "dialogueLine" and node["speaker"] == "ROOK"); node["speaker"] = "ARTHUR"; save_registry(root, document)
    elif probe_id == "36_choice_response_redirect":
        document = registry(root); edge = next(edge for edge in document["graph"]["edges"] if edge["kind"] == "TOPIC_RESPONSE"); edge["target"] = next(node["id"] for node in document["graph"]["nodes"] if node["kind"] == "dialogueLine" and node["id"] != edge["target"]); save_registry(root, document)
    elif probe_id == "37_state_effects_removed":
        document = registry(root); next(edge for edge in document["graph"]["edges"] if edge["kind"] == "STATE_MACHINE")["effects"] = []; save_registry(root, document)
    elif probe_id == "38_cue_actor_and_projection_rebuilt":
        document = registry(root); cue = next(cue for node in document["graph"]["nodes"] for cue in node.get("cues", []) if cue["sourceText"] == "He looks back at Rook.]"); cue["actor"] = "rook"; rebuild_audit(document); save_registry(root, document); rebuild_performance(root, document); save(root, "CUE_SUBJECT_AUDIT.json", document["cueSubjectAudit"])
    elif probe_id == "39_patch_replaced_receipt_updated":
        path = root / "GIT/CANDIDATE.patch"; blob = path.read_bytes() + b"\nsubstituted patch\n"; write_bytes(path, blob); state = load(root, "GIT_STATE.json"); state["patchSha256"] = hashlib.sha256(blob).hexdigest(); save(root, "GIT_STATE.json", state)
    elif probe_id == "40_bundle_pack_corrupt_receipt_updated":
        path = root / "GIT/candidate.bundle"; blob = bytearray(path.read_bytes()); start = bytes(blob).find(b"\n\n") + 2; index = start + max(16, (len(blob) - start - 20) // 2); blob[index] ^= 1; blob[-20:] = hashlib.sha1(bytes(blob[start:-20])).digest(); write_bytes(path, bytes(blob)); state = load(root, "GIT_STATE.json"); state["bundleSha256"] = hashlib.sha256(bytes(blob)).hexdigest(); state["packTrailerSha1"] = bytes(blob[-20:]).hex(); save(root, "GIT_STATE.json", state)
    elif probe_id == "41_subject_object_actor_regression":
        document = registry(root); wrong = {"He looks back at Rook.]": "rook", "then back at Rook.]": "rook", "[Rook walks to Arthur.": "arthur", "Rook turns toward Arthur,\nbarely containing himself.]": "arthur"}
        for node in document["graph"]["nodes"]:
            for cue in node.get("cues", []):
                if cue["sourceText"] in wrong: cue["actor"] = wrong[cue["sourceText"]]
        rebuild_audit(document); save_registry(root, document); rebuild_performance(root, document); save(root, "CUE_SUBJECT_AUDIT.json", document["cueSubjectAudit"])
    else:
        raise ValueError(probe_id)


def regenerate_manifest(root: Path) -> None:
    rows = []
    for path in sorted(item for item in root.rglob("*") if item.is_file() and item.name != "MANIFEST.sha256"):
        rows.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(root).as_posix()}")
    write_bytes(root / "MANIFEST.sha256", ("\n".join(rows) + "\n").encode())


def link_or_copy(source: str, destination: str) -> str:
    try:
        os.link(source, destination)
        return destination
    except OSError:
        return shutil.copy2(source, destination)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    root = args.root.resolve()
    results = []
    with tempfile.TemporaryDirectory(prefix="s12-p3-r3-probes-") as temporary:
        temp = Path(temporary)
        for probe_id, intended in PROBES:
            target = temp / probe_id
            shutil.copytree(root, target, copy_function=link_or_copy)
            mutate(target, probe_id)
            regenerate_manifest(target)
            run = subprocess.run([sys.executable, str(target / "VERIFY_DELIVERY.py")], text=True, capture_output=True)
            output = run.stdout + run.stderr
            if run.returncode == 0 or intended not in output:
                raise SystemExit(f"probe false success {probe_id} exit={run.returncode} intended={intended}\n{output}")
            results.append({"id": probe_id, "result": "VERIFIER_REJECTED", "intendedReason": intended, "exit": run.returncode})
    save(root, "NEGATIVE_PROBE_RESULTS.json", {"clean": "PASS", "probeCount": len(results), "allFailedClosed": True, "probes": results})
    regenerate_manifest(root)
    clean = subprocess.run([sys.executable, str(root / "VERIFY_DELIVERY.py")], text=True, capture_output=True)
    if clean.returncode != 0:
        raise SystemExit(f"clean verification failed\n{clean.stdout}{clean.stderr}")
    print(f"PASS S12_P3_R4_NEGATIVE_PROBES {len(results)}")


if __name__ == "__main__":
    import sys
    main()
