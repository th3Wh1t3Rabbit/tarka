#!/usr/bin/env python3
"""Fixed-hash and semantic verifier for the S12-P3-R4 delivery."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LIVE_REPO = Path("/tmp/trace-escape-s10-p1")
EXPECTED_PARENT = "6da301384c109faf6d32cca8412204ec9241922f"
EXPECTED_PARENT_TREE = "e366d22723aca368d616803169ebbcd5268c6f30"
EXPECTED_CANONICAL = "2bbf06d61dfaebd99aafa7d6c9e25812e2e8b47b"
EXPECTED_PRIMARY = "0f52131c9f56f49128e7a413396331917e687a1f"
EXPECTED_ARCHIVE = "8613c16b6f7df8fcae312b71237729b34eb4fd01619085c3ed0d28d336b01771"
EXPECTED_MANIFEST_BLOB = "593d551a792faad0020a9817369b930393d49332"
EXPECTED_MANIFEST_SHA = "fc4cdcdee5efeda166da04b67f1dbdcdf5ddad05433907ab5ec1da66406a2d01"
EXPECTED_SELECTION_BLOB = "9a551a3da846cd62151c17298a653e71f87bf71d"
EXPECTED_SELECTION_SHA = "44fb8b0135cc8d8e446f41a7e122468267c83bb96974c79d872c25c37d13f649"
EXPECTED_PRODUCTION_SHA = "5c2cda34dac959c6077372bf7d68d8f476a13baf0eae4acf4c5c6b1ba09d9ed8"

# package_delivery.py replaces this exact literal after every claim-bearing byte exists.
EXPECTED_SHA256: dict[str, str] = {}

EXECUTABLE = {
    "FULL_TEXT/02_A1_OPENING_AND_AUTHORIZATION_FULL.md": (19461, "e14f2a98f89322f5f0915ea32c02a9b633fcd650531a997203bb2698a1932c18"),
    "FULL_TEXT/03_A2_A4_WORLD_PUZZLE_CANON_FULL.md": (10057, "25167738eb81d414730795343b9678d0a1a17936661e89eee32c646e83e4b616"),
    "FULL_TEXT/04_HERO_TERMINAL_CANON_FULL.md": (18527, "9eb3fa747a238d708b92f55473afa8d5703c3f3f2165ae12f33a3714a2bb6971"),
    "FULL_TEXT/05_BRCG_BRANCH_CANON_FULL.md": (8133, "67276b9841ea79702d44f7fb5b53c28244b6ec463f413f026dd736748cd5e18a"),
    "FULL_TEXT/06_UNIVERSAL_ENDING_CANON_FULL.md": (11847, "cf3c554a563ff2bb83f134f19ecddc9ee0a97ef9c8284f3bc183ecf9b8dfc88d"),
    "FULL_TEXT/07_BACKGROUND_OBJECT_CANON_FULL.md": (10225, "24d7682fea53aee1abc190ff11fe6647eb45e71a9449cfcabad7d5e65379f31c"),
    "FULL_TEXT/08_INVENTORY_INTERACTIONS_FULL.md": (11995, "2b0a8b99058f219751a3742f114fb06b522376230aeab7dada51012de738361d"),
    "FULL_TEXT/09_REPEAT_RECOVERY_AND_HINTS_FULL.md": (5750, "b8c8478c98f1cb3006f8a0c57c89c114987e6de16a6ef95a51639e4dd4393cc1"),
    "FULL_TEXT/10_ARTHUR_ITEM_REACTIONS_AND_GUIDANCE_FULL.md": (8608, "8b4e1bc6bf569a87406232166c9e671c6cf0218c7976038b9633416b747956b2"),
    "MAIN_INTEGRATION/04_STATE_MACHINE_AND_REDUCER_CONTRACT.md": (1590, "9845d5c91d3daaf5a506f213977cc165084095104eb591c5ef5211f755c92abf"),
}
A1_OPTIONS = ["WHAT IS IT YOU NEED ME TO DO AGAIN?", "TELL ME AGAIN HOW NANSEN ACCESS HELPS US WITH OUR CASE?", "DID YOU CATCH THE GAME THIS WEEKEND?", "SO, HOW ARE THE HEALTH BENEFITS WORKING HERE?", "I’LL GET BACK TO THE FORM."]
POST_OPTIONS = ["WHAT SHOULD I BE DOING RIGHT NOW?", "TELL ME AGAIN HOW NANSEN HELPS.", "DID YOU CATCH THE GAME THIS WEEKEND?", "SO, HOW ARE THE HEALTH BENEFITS WORKING HERE?", "CAN I CALL YOU ARTHUR YET?", "I’LL GET BACK TO THE CASE."]
STATE_EDGES = {
    ("TARKA_TITLE_SCREEN", "TITLE_PLAY"), ("TITLE_PLAY", "FULL_FRESH_RESET"), ("FULL_FRESH_RESET", "OPENING_CUTSCENE"),
    ("OPENING_CUTSCENE", "AUTHORIZATION_PUZZLE"), ("AUTHORIZATION_PUZZLE", "CASE_WORLD_AND_TERMINAL"),
    ("CASE_WORLD_AND_TERMINAL", "PROOF_COMPLETE"), ("PROOF_COMPLETE", "CLOSE_CASE_CONFIRMATION"),
    ("CLOSE_CASE_CONFIRMATION", "ENDING_COMMITTED"), ("ENDING_COMMITTED", "FINAL_COMPLETION_SCREEN"),
    ("BOOT", "TARKA_TITLE_SCREEN"), ("TITLE_CREDITS", "TARKA_CREDITS"), ("TARKA_CREDITS", "TARKA_TITLE_SCREEN"),
    ("ENDING_MAIN_MENU", "TARKA_TITLE_SCREEN"), ("ENDING_PLAY_AGAIN", "FULL_FRESH_RESET"),
    ("FORM_AVAILABLE", "FORM_TAKEN"), ("FORM_TAKEN", "PEN_AVAILABLE/TAKEN"), ("PEN_AVAILABLE/TAKEN", "FORM_COMPLETED"),
    ("FORM_COMPLETED", "BARELY_LEGIBLE_SIGNED_FORM + POORLY_MISHANDLED_BROKEN_PEN"),
    ("BARELY_LEGIBLE_SIGNED_FORM + POORLY_MISHANDLED_BROKEN_PEN", "ARTHUR_REVIEW"),
    ("ARTHUR_REVIEW", "STAMP_RETURN_CONTACT"), ("STAMP_RETURN_CONTACT", "AUTHORIZED"),
    ("PREBRIEF_NO_EULER_FILE", "Q1"), ("Q1", "Q2"), ("Q2", "Q3_EXACT_RECEIPT"),
    ("Q3_EXACT_RECEIPT", "PROOF_ASSEMBLY"), ("PROOF_ASSEMBLY", "PROOF_COMPLETE"), ("PROOF_COMPLETE", "CLOSE_CASE"),
}
PROBES = [
    "01_edges_removed", "02_dangling_target", "03_fake_clip", "04_fake_catalog", "05_false_speaker", "06_effects_removed",
    "07_ledger_missing", "08_graph_validation_missing", "09_evidence_missing", "10_production_activation", "11_id_drift",
    "12_a1_actor", "13_choices_removed", "14_predicates_removed", "15_ledger_empty", "16_registry_ledger_missing",
    "17_coverage_zero", "18_catalog_mismatch", "19_idle_substitution", "20_graph_contradiction", "21_offset_ids",
    "22_global_choices", "23_foreign_edge", "24_synthetic_traverse", "25_raw_source_erased", "26_trailing_span_deleted",
    "27_state_graph_removed", "28_cross_line_and_duplicate_edges", "29_false_action_choice", "30_predicate_after_selection",
    "31_per_cue_or_map_tamper", "32_git_test_probe_provenance_deleted", "33_production_hash_boolean_only",
    "34_dialogue_node_text_changed", "35_valid_speaker_swapped", "36_choice_response_redirect", "37_state_effects_removed",
    "38_cue_actor_and_projection_rebuilt", "39_patch_replaced_receipt_updated", "40_bundle_pack_corrupt_receipt_updated",
    "41_subject_object_actor_regression",
]
ALLOWED_PREFIXES = ("scripts/s12-p3/", "src/story/r55/", "tests/unit/s12-p3-r55-registry.test.ts", "tests/e2e/s12-p3-r55-review.spec.ts")
REQUIRED = {
    "REGISTRY/r55-registry.json", "REGISTRY/r55-source-ledger.json", "REGISTRY/r55-provenance.json", "REGISTRY/r55-performance-map.json",
    "SOURCE_COVERAGE.json", "SOURCE_RECONSTRUCTION.json", "GRAPH_VALIDATION.json", "MENU_EXHAUSTION.json", "CUE_SUBJECT_AUDIT.json",
    "CATALOG_BINDING.json", "ENGINE_HARNESS.json", "PRODUCTION_NON_ACTIVATION.json", "PRODUCTION/index-DBC_kJlO.js",
    "GIT/CANDIDATE.patch", "GIT/CHANGED_PATHS.txt", "GIT/CANDIDATE_COMMIT.raw", "GIT/candidate.bundle", "GIT/RECOVERY.raw",
    "GIT_STATE.json", "PREFLIGHT.json", "FINAL_GIT_STATE.json", "TEST_DECISIONS.json", "TESTS_NOT_RUN.md",
    "NEGATIVE_PROBE_RESULTS.json", "RUN_NEGATIVE_PROBES.py", "VERIFY_DELIVERY.py", "LOGS/unit.txt", "LOGS/playwright.txt",
    "LOGS/typecheck.txt", "LOGS/lint.txt", "LOGS/build.txt",
}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load(rel: str, findings: list[str]):
    try:
        return json.loads((ROOT / rel).read_text(encoding="utf-8"))
    except Exception as exc:
        findings.append(f"evidence_missing:{rel}:{type(exc).__name__}")
        return {}


def run(args: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True)


def manifest_and_seals(findings: list[str]) -> None:
    manifest = ROOT / "MANIFEST.sha256"
    if not manifest.is_file():
        findings.append("manifest_missing"); return
    listed = {}
    for row in manifest.read_text(encoding="utf-8").splitlines():
        try: digest, rel = row.split("  ", 1)
        except ValueError: findings.append("manifest_format"); continue
        if rel in listed or rel.startswith("/") or ".." in Path(rel).parts or not re.fullmatch(r"[a-f0-9]{64}", digest): findings.append("manifest_format"); continue
        listed[rel] = digest; target = ROOT / rel
        if not target.is_file() or sha(target.read_bytes()) != digest: findings.append(f"manifest_mismatch:{rel}")
    actual = {path.relative_to(ROOT).as_posix() for path in ROOT.rglob("*") if path.is_file() and path.name != "MANIFEST.sha256"}
    if actual != set(listed): findings.append("manifest_member_set")
    for rel in REQUIRED:
        if rel not in listed: findings.append(f"evidence_missing:{rel}")
    if not EXPECTED_SHA256: findings.append("sealed_map_missing")
    for rel, digest in EXPECTED_SHA256.items():
        target = ROOT / rel
        if not target.is_file() or sha(target.read_bytes()) != digest: findings.append(f"sealed_payload:{rel}")


def expected_menu_specs() -> dict[str, dict[str, dict]]:
    return {
        "1. Silent Arthur topic menu": {
            A1_OPTIONS[0]: {"menuPredicate": {"type": "STATE_IN", "states": ["FORM_AVAILABLE", "FORM_TAKEN", "PEN_AVAILABLE/TAKEN", "FORM_COMPLETED"]}, "effects": [], "responses": [("No form collected", ["FORM_AVAILABLE"]), ("Form collected, pen not collected", ["FORM_TAKEN"]), ("Form and pen available, form incomplete", ["PEN_AVAILABLE/TAKEN"]), ("Completed form available", ["FORM_COMPLETED"])]},
            A1_OPTIONS[1]: {"menuPredicate": None, "effects": [], "responses": [("3. Nansen reminder topic", None)]},
            A1_OPTIONS[2]: {"menuPredicate": None, "topic": "WEEKEND_GAME", "responses": [("4. Weekend-game topic", None)]},
            A1_OPTIONS[3]: {"menuPredicate": None, "topic": "HEALTH_BENEFITS", "responses": [("5. Health-benefits topic", None)]},
            A1_OPTIONS[4]: {"menuPredicate": None, "effects": [], "responses": [("6. Exit topic", None)]},
        },
        "Postauthorization root menu": {
            POST_OPTIONS[0]: {"menuPredicate": {"type": "STATE_IN", "states": ["AUTHORIZED", "PREBRIEF_NO_EULER_FILE", "Q1", "Q2", "Q3_EXACT_RECEIPT", "PROOF_ASSEMBLY", "PROOF_COMPLETE"]}, "effects": [], "responses": [("Authorized, Euler file not collected", ["AUTHORIZED", "PREBRIEF_NO_EULER_FILE"]), ("Euler file collected, Question 1 incomplete", ["Q1"]), ("Question 1 complete, Question 2 incomplete", ["Q2"]), ("Question 2 complete, Question 3 incomplete", ["Q3_EXACT_RECEIPT"]), ("Exact receipt found, proof incomplete", ["PROOF_ASSEMBLY"]), ("Proof complete, case open", ["PROOF_COMPLETE"])]},
            POST_OPTIONS[1]: {"menuPredicate": None, "effects": [], "responses": [("TELL ME AGAIN HOW NANSEN HELPS", None)]},
            POST_OPTIONS[2]: {"menuPredicate": {"type": "NOT_ASKED", "topic": "WEEKEND_GAME"}, "topic": "WEEKEND_GAME", "responses": [("DID YOU CATCH THE GAME THIS WEEKEND?", None)]},
            POST_OPTIONS[3]: {"menuPredicate": {"type": "NOT_ASKED", "topic": "HEALTH_BENEFITS"}, "topic": "HEALTH_BENEFITS", "responses": [("SO, HOW ARE THE HEALTH BENEFITS WORKING HERE?", None)]},
            POST_OPTIONS[4]: {"menuPredicate": {"type": "ALL", "predicates": [{"type": "NOT_ASKED", "topic": "CALL_ARTHUR"}, {"type": "STATE_NOT_IN", "states": ["PROOF_COMPLETE", "CLOSE_CASE"]}]}, "topic": "CALL_ARTHUR", "responses": [("CAN I CALL YOU ARTHUR YET?", None)]},
            POST_OPTIONS[5]: {"menuPredicate": None, "effects": [], "responses": [("Exit", None)]},
        },
    }


def verify_semantics(findings: list[str]) -> None:
    registry = load("REGISTRY/r55-registry.json", findings); ledger_doc = load("REGISTRY/r55-source-ledger.json", findings)
    provenance = load("REGISTRY/r55-provenance.json", findings); performance = load("REGISTRY/r55-performance-map.json", findings)
    entries = ledger_doc.get("entries", []) if isinstance(ledger_doc, dict) else []; ledger = {row.get("id"): row for row in entries}
    if not entries or len(ledger) != len(entries): findings.append("ledger_exact")
    if registry.get("sourceLedger") != entries: findings.append("registry_ledger_mismatch")
    for rel, field in (("REGISTRY/r55-registry.json", "registrySha256"), ("REGISTRY/r55-source-ledger.json", "sourceLedgerSha256"), ("REGISTRY/r55-performance-map.json", "performanceMapSha256")):
        if provenance.get(field) != (sha((ROOT / rel).read_bytes()) if (ROOT / rel).is_file() else None): findings.append(f"provenance_hash:{field}")
    if registry.get("archiveSha256") != EXPECTED_ARCHIVE or provenance.get("archiveSha256") != EXPECTED_ARCHIVE: findings.append("archive_identity")
    reconstruction = []
    for path, (member_bytes, member_sha) in EXECUTABLE.items():
        if registry.get("sourceMembers", {}).get(path) != {"bytes": member_bytes, "sha256": member_sha}: findings.append(f"source_member_identity:{path}")
        spans = sorted((row for row in entries if row.get("path") == path and row.get("semanticClass") != "ARCHIVE_MEMBER"), key=lambda row: (row.get("byteStart", -1), row.get("byteEnd", -1)))
        cursor = 0; chunks = []
        for row in spans:
            raw = row.get("rawText", "").encode() if isinstance(row.get("rawText"), str) else b""
            if row.get("byteStart") != cursor or row.get("byteEnd") != cursor + len(raw) or sha(raw) != row.get("rawSha256"): findings.append(f"raw_span_mismatch:{path}"); break
            cursor += len(raw); chunks.append(raw)
        blob = b"".join(chunks); exact = cursor == member_bytes and sha(blob) == member_sha
        if not exact: findings.append(f"source_reconstruction:{path}")
        reconstruction.append({"path": path, "bytes": len(blob), "sha256": sha(blob), "exact": exact})
    coverage = ledger_doc.get("coverage", {})
    if coverage.get("executableMembers") != 10 or coverage.get("exactReconstructions") != 10 or coverage.get("rawMismatchCount") != 0 or coverage.get("uncoveredBytes") != 0 or coverage.get("overlappingBytes") != 0: findings.append("coverage_claim")
    if load("SOURCE_COVERAGE.json", findings) != coverage: findings.append("coverage_receipt")
    if load("SOURCE_RECONSTRUCTION.json", findings) != {"exactCount": 10, "mismatchCount": 0, "members": reconstruction}: findings.append("reconstruction_receipt")

    graph = registry.get("graph", {}); node_list = graph.get("nodes", []); edge_list = graph.get("edges", []); nodes = {row.get("id"): row for row in node_list}
    if len(nodes) != len(node_list): findings.append("duplicate_node")
    edge_keys = [json.dumps(row, sort_keys=True, ensure_ascii=False) for row in edge_list]
    if len(edge_keys) != len(set(edge_keys)): findings.append("duplicate_edge")
    if any(row.get("source") not in nodes or row.get("target") not in nodes for row in edge_list): findings.append("dangling_edge")
    for node in node_list:
        entry = ledger.get(node.get("ledgerId"))
        if not entry: findings.append("node_ledger_missing"); continue
        if node.get("source") != {key: entry.get(key) for key in ("path", "byteStart", "byteEnd", "lineStart", "lineEnd")}: findings.append("node_ledger_source")
        if node.get("kind") in {"dialogueLine", "choice"} and node.get("id") != node.get("ledgerId"): findings.append("node_ledger_id")
        if node.get("kind") == "dialogueLine" and (node.get("text") != entry.get("displayText") or node.get("speaker") != entry.get("speaker")): findings.append("node_ledger_dialogue")
        if node.get("kind") == "choice" and node.get("text") != entry.get("displayText"): findings.append("node_ledger_choice")
    if any(node.get("speaker") in {"TOPIC", "ACTION", "OPEN", "CLOSE", "PUSH / PULL", "GIVE"} for node in node_list): findings.append("false_speaker")
    if any(not re.fullmatch(r"r55-[a-f0-9]{20}", str(node.get("id", ""))) for node in node_list): findings.append("unstable_id")
    if any(str(effect.get("type", "")).startswith("traverse") for edge in edge_list for effect in edge.get("effects", [])): findings.append("synthetic_traverse")
    state_edges = [row for row in edge_list if row.get("kind") == "STATE_MACHINE"]
    actual_state = {(nodes.get(row.get("source"), {}).get("text"), nodes.get(row.get("target"), {}).get("text")) for row in state_edges}
    if actual_state != STATE_EDGES or len(state_edges) != 27 or graph.get("stateMachine") != {"authoredOccurrences": 30, "uniqueEdges": 27}: findings.append("state_graph_exact")
    for edge in state_edges:
        if edge.get("effects") != [{"type": "SET_STORY_STATE", "state": nodes.get(edge.get("target"), {}).get("text"), "once": False, "sourceId": edge.get("source")}]: findings.append("state_effect_exact")
    if load("GRAPH_VALIDATION.json", findings) != {"nodes": len(node_list), "edges": len(edge_list), "stateAuthoredOccurrences": 30, "stateUniqueEdges": 27, "duplicateEdges": 0, "falseCrossLineEdges": 0}: findings.append("graph_receipt")

    specs = expected_menu_specs(); menus = [row for row in node_list if row.get("kind") == "menu"]
    if [row.get("anchor") for row in menus] != list(specs): findings.append("menu_count")
    for menu in menus:
        spec = specs.get(menu.get("anchor"), {}); choice_edges = [row for row in edge_list if row.get("source") == menu.get("id") and row.get("kind") == "TOPIC_CHOICE"]
        if [nodes.get(row.get("target"), {}).get("text") for row in choice_edges] != list(spec): findings.append("menu_options_exact")
        for edge in choice_edges:
            choice = nodes.get(edge.get("target"), {}); expected = spec.get(choice.get("text"), {}); topic = expected.get("topic")
            expected_effects = [{"type": "MARK_TOPIC_ASKED", "topic": topic, "once": True, "sourceId": choice.get("id")}] if topic else expected.get("effects", [])
            if edge.get("predicate") != expected.get("menuPredicate") or edge.get("effects") != expected_effects: findings.append("menu_semantics_exact")
            responses = [row for row in edge_list if row.get("source") == choice.get("id") and row.get("kind") == "TOPIC_RESPONSE"]
            actual = [(nodes.get(row.get("target"), {}).get("anchor"), row.get("predicate"), row.get("effects")) for row in responses]
            wanted = [(anchor, {"type": "STATE_IN", "states": states} if states else None, []) for anchor, states in expected.get("responses", [])]
            if actual != wanted: findings.append("menu_response_exact")
    for label in ("OPEN / CLOSE", "GIVE BLANK FORM TO ARTHUR"):
        if not any(row.get("semanticClass") == "INTERACTION_ACTION" and row.get("displayText") == label for row in entries) or any(row.get("kind") == "choice" and row.get("text") == label for row in node_list): findings.append(f"false_choice:{label}")
    menu_receipt = load("MENU_EXHAUSTION.json", findings)
    if menu_receipt.get("a1Options") != A1_OPTIONS or menu_receipt.get("postAuthorizationOptions") != POST_OPTIONS or menu_receipt.get("noExhaustedChoiceDeadlock") is not True or menu_receipt.get("resetRestoresAvailability") is not True: findings.append("menu_receipt")

    cues = [(node, index, cue) for node in node_list for index, cue in enumerate(node.get("cues", []))]
    expected_subjects = {"He looks back at Rook.]": "arthur", "then back at Rook.]": "arthur", "[Rook walks to Arthur.": "rook", "Rook turns toward Arthur,\nbarely containing himself.]": "rook"}
    actual_subjects = {cue.get("sourceText"): cue.get("actor") for _, _, cue in cues if cue.get("sourceText") in expected_subjects}
    if actual_subjects != expected_subjects: findings.append("cue_subject_exact")
    first = next((node for node in node_list if node.get("text") == "“This the Records Office?”"), {})
    if [cue.get("actor") for cue in first.get("cues", [])[:3]] != ["arthur", "arthur", "rook"]: findings.append("cue_first_sequence")
    audit_rows = [{"nodeId": node.get("id"), "cueIndex": index, "sourceText": cue.get("sourceText"), "actor": cue.get("actor"), "subjectResolution": cue.get("subjectResolution"), "leadingSubject": cue.get("leadingSubject")} for node, index, cue in cues]
    audit = registry.get("cueSubjectAudit", {})
    if audit.get("totalCues") != len(cues) or audit.get("records") != audit_rows or load("CUE_SUBJECT_AUDIT.json", findings) != audit: findings.append("cue_subject_audit")

    catalog = registry.get("catalog", {}); exact_catalog = {"manifestBlob": EXPECTED_MANIFEST_BLOB, "manifestSha256": EXPECTED_MANIFEST_SHA, "selectionBlob": EXPECTED_SELECTION_BLOB, "selectionSha256": EXPECTED_SELECTION_SHA}
    if any(catalog.get(key) != value for key, value in exact_catalog.items()): findings.append("catalog_identity")
    admitted = {f"characters.rook.animations.{name}" for name in catalog.get("clips", {}).get("rook", [])} | {f"characters.mrIndex.animations.{name}" for name in catalog.get("clips", {}).get("arthur", [])}
    projection = {}; fields = ("actor", "intent", "preferredClip", "selectedClip", "manifestPath", "manifestBlob", "manifestSha256", "selectionBlob", "selectionSha256", "membership", "fallback", "fallbackReason", "changesStoryMeaning")
    for _, _, cue in cues:
        if any(cue.get(key) != value for key, value in exact_catalog.items()): findings.append("per_cue_catalog")
        if cue.get("selectedClip") is not None and cue.get("selectedClip") not in admitted: findings.append("fake_clip")
        if cue.get("actor") == "rook" and cue.get("intent") == "MOVEMENT" and str(cue.get("selectedClip")).endswith(".idle"): findings.append("idle_substitution")
        projection.setdefault((cue.get("actor"), cue.get("intent"), cue.get("selectedClip")), {key: cue.get(key) for key in fields})
    mappings = performance.get("mappings", []); wanted = sorted(projection.values(), key=lambda row: (row["actor"], row["intent"], row["selectedClip"] or ""))
    if performance.get("catalog") != catalog or mappings != wanted: findings.append("performance_projection")
    binding = load("CATALOG_BINDING.json", findings)
    if any(binding.get(key) != value for key, value in exact_catalog.items()) or binding.get("cueCount") != len(cues) or binding.get("mappingCount") != len(mappings) or binding.get("projectionExact") is not True: findings.append("catalog_receipt")
    production_path = ROOT / "PRODUCTION/index-DBC_kJlO.js"; production = production_path.read_bytes() if production_path.is_file() else b""
    if sha(production) != EXPECTED_PRODUCTION_SHA or any(token in production for token in (b"r55-registry", b"R55 review", b"mathematically precise haystack", b"r55Review")): findings.append("production_artifact")
    receipt = load("PRODUCTION_NON_ACTIVATION.json", findings)
    if receipt.get("sha256") != EXPECTED_PRODUCTION_SHA or receipt.get("bytes") != len(production) or receipt.get("ordinaryReviewOpensHarness") is not False: findings.append("production_receipt")


def verify_git(findings: list[str]) -> None:
    preflight = load("PREFLIGHT.json", findings)
    expected_preflight = {"head": EXPECTED_PARENT, "tree": EXPECTED_PARENT_TREE, "parent": "62384bcaf230264dc0b37099330f568c45af1dba", "posture": "DETACHED_HEAD", "canonical": EXPECTED_CANONICAL, "protectedPrimary": EXPECTED_PRIMARY, "trackedDirty": False, "staged": [], "conflicted": [], "sourceRelevantUntracked": [], "stashModified": False}
    if any(preflight.get(key) != value for key, value in expected_preflight.items()): findings.append("preflight_identity")
    state = load("GIT_STATE.json", findings); final_state = load("FINAL_GIT_STATE.json", findings)
    raw = (ROOT / "GIT/CANDIDATE_COMMIT.raw").read_bytes() if (ROOT / "GIT/CANDIDATE_COMMIT.raw").is_file() else b""
    candidate = hashlib.sha1(f"commit {len(raw)}\0".encode() + raw).hexdigest(); tree_match = re.search(rb"^tree ([a-f0-9]{40})$", raw, re.M); parents = re.findall(rb"^parent ([a-f0-9]{40})$", raw, re.M); tree = tree_match.group(1).decode() if tree_match else None
    if state.get("candidate") != candidate or state.get("tree") != tree or parents != [EXPECTED_PARENT.encode()] or state.get("parent") != EXPECTED_PARENT or state.get("parentCount") != 1: findings.append("git_commit_identity")
    if final_state.get("head") != candidate or final_state.get("tree") != tree or final_state.get("parent") != EXPECTED_PARENT or final_state.get("posture") != "DETACHED_HEAD": findings.append("final_git_identity")
    patch_path = ROOT / "GIT/CANDIDATE.patch"; patch = patch_path.read_bytes() if patch_path.is_file() else b""; changed_path = ROOT / "GIT/CHANGED_PATHS.txt"; changed_text = changed_path.read_text() if changed_path.is_file() else ""; changed = changed_text.splitlines()
    if not patch or sha(patch) != state.get("patchSha256") or sha(changed_text.encode()) != state.get("changedPathsSha256") or any(not path.startswith(ALLOWED_PREFIXES) for path in changed): findings.append("git_scope")
    bundle_path = ROOT / "GIT/candidate.bundle"; bundle = bundle_path.read_bytes() if bundle_path.is_file() else b""; split = bundle.find(b"\n\n"); pack = bundle[split + 2:] if split >= 0 else b""
    if not bundle.startswith(b"# v2 git bundle\n") or candidate.encode() not in bundle[:2048] or b"-" + EXPECTED_PARENT.encode() not in bundle[:2048] or sha(bundle) != state.get("bundleSha256"): findings.append("git_bundle_header")
    if len(pack) < 20 or hashlib.sha1(pack[:-20]).digest() != pack[-20:] or pack[-20:].hex() != state.get("packTrailerSha1"): findings.append("git_pack_trailer")
    if not LIVE_REPO.is_dir(): findings.append("git_live_repo_missing"); return
    live = lambda args: run(["git", "-C", str(LIVE_REPO), *args], LIVE_REPO)
    checks = [live(["rev-parse", "HEAD"]), live(["rev-parse", "HEAD^{tree}"]), live(["show", "-s", "--format=%P", "HEAD"]), live(["cat-file", "commit", candidate]), live(["diff", "--binary", EXPECTED_PARENT, candidate]), live(["diff", "--name-only", EXPECTED_PARENT, candidate])]
    if any(item.returncode for item in checks) or checks[0].stdout.strip() != candidate or checks[1].stdout.strip() != tree or checks[2].stdout.strip() != EXPECTED_PARENT or checks[3].stdout.encode() != raw or checks[4].stdout.encode() != patch or checks[5].stdout.splitlines() != changed: findings.append("git_live_exact")
    if live(["rev-parse", "refs/heads/codex-s5-20260918"]).stdout.strip() != EXPECTED_CANONICAL or live(["rev-parse", "refs/heads/g6p-a0-point-click"]).stdout.strip() != EXPECTED_PRIMARY: findings.append("git_protected_refs")
    if live(["bundle", "verify", str(bundle_path)]).returncode: findings.append("git_bundle_verify")
    with tempfile.TemporaryDirectory(prefix="s12-p3-r4-recovery-") as temporary:
        bare = Path(temporary) / "recovered.git"
        steps = [run(["git", "init", "--bare", str(bare)], Path(temporary)), run(["git", "-C", str(bare), "fetch", str(LIVE_REPO), f"{EXPECTED_PARENT}:refs/heads/base"], Path(temporary)), run(["git", "-C", str(bare), "bundle", "verify", str(bundle_path)], Path(temporary)), run(["git", "-C", str(bare), "fetch", str(bundle_path), "HEAD:refs/heads/candidate"], Path(temporary)), run(["git", "-C", str(bare), "fsck", "--full"], Path(temporary))]
        if any(step.returncode for step in steps): findings.append("git_bundle_recovery")
        else:
            recovered_tree = run(["git", "-C", str(bare), "rev-parse", "refs/heads/candidate^{tree}"], Path(temporary)).stdout.strip(); recovered_parent = run(["git", "-C", str(bare), "show", "-s", "--format=%P", "refs/heads/candidate"], Path(temporary)).stdout.strip()
            recovered_patch = run(["git", "-C", str(bare), "diff", "--binary", "refs/heads/base", "refs/heads/candidate"], Path(temporary)).stdout.encode(); recovered_changed = run(["git", "-C", str(bare), "diff", "--name-only", "refs/heads/base", "refs/heads/candidate"], Path(temporary)).stdout.splitlines()
            if recovered_tree != tree or recovered_parent != EXPECTED_PARENT or recovered_patch != patch or recovered_changed != changed: findings.append("git_recovery_exact")
    excluded = state.get("excludedEffects", {})
    if not excluded or any(value != 0 for value in excluded.values()): findings.append("excluded_effects")


def verify_evidence(findings: list[str]) -> None:
    decisions = load("TEST_DECISIONS.json", findings); rows = {row.get("log"): row for row in decisions.get("testsRun", [])}
    for rel in ("LOGS/unit.txt", "LOGS/playwright.txt", "LOGS/typecheck.txt", "LOGS/lint.txt", "LOGS/build.txt"):
        text = (ROOT / rel).read_text(encoding="utf-8") if (ROOT / rel).is_file() else ""; row = rows.get(rel, {})
        if not all(token in text for token in ("COMMAND=", "START_UTC=", "END_UTC=", "RUNTIME_SECONDS=", "EXIT=0", "TOTALS=")) or row.get("exit") != 0 or row.get("sha256") != sha(text.encode()) or not row.get("purpose"): findings.append(f"test_evidence:{rel}")
    if not decisions.get("testsNotRun") or not (ROOT / "TESTS_NOT_RUN.md").read_text(encoding="utf-8").strip(): findings.append("tests_not_run")
    engine = load("ENGINE_HARNESS.json", findings)
    if any(engine.get(key) is not True for key in ("currentNodeEdgesOnly", "rejectForeignEdges", "predicatesBeforeSelection", "typedEffectsExactlyOnce", "deterministicReset", "rawAndDisplaySeparated")): findings.append("engine_harness")
    results = load("NEGATIVE_PROBE_RESULTS.json", findings); probes = results.get("probes", [])
    if results.get("clean") != "PASS" or results.get("probeCount") != 41 or results.get("allFailedClosed") is not True or [row.get("id") for row in probes] != PROBES or any(row.get("result") != "VERIFIER_REJECTED" or row.get("exit") != 1 or not row.get("intendedReason") for row in probes): findings.append("negative_probe_results")


def verify() -> list[str]:
    findings: list[str] = []
    manifest_and_seals(findings); verify_semantics(findings); verify_git(findings); verify_evidence(findings)
    return list(dict.fromkeys(findings))


if __name__ == "__main__":
    failures = verify()
    if failures:
        print("FAIL"); print("\n".join(failures)); raise SystemExit(1)
    print("PASS S12_P3_R4_DELIVERY")
