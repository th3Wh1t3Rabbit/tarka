#!/usr/bin/env python3
"""R55 registry generator: byte-complete ledger and source-owned graph."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import zipfile
from pathlib import Path

A1_SHA = "c665ad8150efb170452d177aba9cfa63be79ee3b9774dc15d1c2ecff850cfca5"
ARCHIVE_SHA = "8613c16b6f7df8fcae312b71237729b34eb4fd01619085c3ed0d28d336b01771"
HOTSPOT_SHA = "ff6a2fcae4bf19b5fcfb9bb64942be419ac140ca0bf880fdab7963017552d948"
INVENTORY_SHA = "ea5780d63d4e42db6174a7fe032ab6ba11f19b208522d2af4314119bdab814bb"
PHRASE_SOURCE = "mathematically\nprecise haystack"
ACTIVATION = "NOT_PRODUCTION_ACTIVE_UNTIL_LATER_GATE"
PREFIX = "TRACE_ESCAPE_STORY_TO_MAIN_FINAL_INTEGRATION_HANDOFF_R55_TARKA_v1.0.0_2026-09-22/"
SPEAKERS = {"ROOK", "ARTHUR"}
LABELS = {"TOPIC": "topic", "ACTION": "action", "OPEN": "verbResponse", "CLOSE": "verbResponse", "PUSH / PULL": "verbResponse", "GIVE": "verbResponse", "LOOK AT": "verbResponse", "USE": "verbResponse", "TALK TO": "verbResponse"}
EXECUTABLE = {
    "FULL_TEXT/02_A1_OPENING_AND_AUTHORIZATION_FULL.md": "COPY.A1",
    "FULL_TEXT/03_A2_A4_WORLD_PUZZLE_CANON_FULL.md": "COPY.A2_A4",
    "FULL_TEXT/04_HERO_TERMINAL_CANON_FULL.md": "COPY.HERO",
    "FULL_TEXT/05_BRCG_BRANCH_CANON_FULL.md": "COPY.BRCG",
    "FULL_TEXT/06_UNIVERSAL_ENDING_CANON_FULL.md": "COPY.END",
    "FULL_TEXT/07_BACKGROUND_OBJECT_CANON_FULL.md": "COPY.BACKGROUND",
    "FULL_TEXT/08_INVENTORY_INTERACTIONS_FULL.md": "COPY.INVENTORY",
    "FULL_TEXT/09_REPEAT_RECOVERY_AND_HINTS_FULL.md": "COPY.REPEAT",
    "FULL_TEXT/10_ARTHUR_ITEM_REACTIONS_AND_GUIDANCE_FULL.md": "COPY.ARTHUR",
    "MAIN_INTEGRATION/04_STATE_MACHINE_AND_REDUCER_CONTRACT.md": "STATE_MACHINE",
}
PREFERRED = {("rook", "MOVEMENT"): "walkEast", ("rook", "GAZE"): "inspect", ("rook", "TALK"): "talkClosed", ("arthur", "STAMP"): "stamp", ("arthur", "TALK"): "talkClosed", ("rook", "IDLE"): "idle", ("arthur", "IDLE"): "idle"}
INTERACTION_ACTION_LABELS = {"OPEN / CLOSE", "GIVE BLANK FORM TO ARTHUR"}
MENU_SPECS = {
    ("FULL_TEXT/02_A1_OPENING_AND_AUTHORIZATION_FULL.md", "1 SILENT ARTHUR TOPIC MENU"): {
        "WHAT IS IT YOU NEED ME TO DO AGAIN?": {
            "branches": [
                ("No form collected", ["FORM_AVAILABLE"]),
                ("Form collected, pen not collected", ["FORM_TAKEN"]),
                ("Form and pen available, form incomplete", ["PEN_AVAILABLE/TAKEN"]),
                ("Completed form available", ["FORM_COMPLETED"]),
            ]
        },
        "TELL ME AGAIN HOW NANSEN ACCESS HELPS US WITH OUR CASE?": {"target": "3 Nansen reminder topic"},
        "DID YOU CATCH THE GAME THIS WEEKEND?": {"target": "4 Weekend-game topic", "mark": "WEEKEND_GAME"},
        "SO, HOW ARE THE HEALTH BENEFITS WORKING HERE?": {"target": "5 Health-benefits topic", "mark": "HEALTH_BENEFITS"},
        "I’LL GET BACK TO THE FORM.": {"target": "6 Exit topic"},
    },
    ("FULL_TEXT/10_ARTHUR_ITEM_REACTIONS_AND_GUIDANCE_FULL.md", "POSTAUTHORIZATION ROOT MENU"): {
        "WHAT SHOULD I BE DOING RIGHT NOW?": {
            "branches": [
                ("Authorized, Euler file not collected", ["AUTHORIZED", "PREBRIEF_NO_EULER_FILE"]),
                ("Euler file collected, Question 1 incomplete", ["Q1"]),
                ("Question 1 complete, Question 2 incomplete", ["Q2"]),
                ("Question 2 complete, Question 3 incomplete", ["Q3_EXACT_RECEIPT"]),
                ("Exact receipt found, proof incomplete", ["PROOF_ASSEMBLY"]),
                ("Proof complete, case open", ["PROOF_COMPLETE"]),
            ]
        },
        "TELL ME AGAIN HOW NANSEN HELPS.": {"target": "TELL ME AGAIN HOW NANSEN HELPS"},
        "DID YOU CATCH THE GAME THIS WEEKEND?": {"target": "DID YOU CATCH THE GAME THIS WEEKEND?", "mark": "WEEKEND_GAME", "notAsked": True},
        "SO, HOW ARE THE HEALTH BENEFITS WORKING HERE?": {"target": "SO, HOW ARE THE HEALTH BENEFITS WORKING HERE?", "mark": "HEALTH_BENEFITS", "notAsked": True},
        "CAN I CALL YOU ARTHUR YET?": {"target": "CAN I CALL YOU ARTHUR YET?", "mark": "CALL_ARTHUR", "notAsked": True, "notStates": ["PROOF_COMPLETE", "CLOSE_CASE"]},
        "I’LL GET BACK TO THE CASE.": {"target": "Exit"},
    },
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob(path: Path) -> str:
    data = path.read_bytes()
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()


def stable_id(path: str, anchor: str, kind: str, text: str, ordinal: int) -> str:
    raw = f"{path}\n{anchor}\n{kind}\n{sha256_bytes(text.encode())}\n{ordinal}".encode()
    return "r55-" + sha256_bytes(raw)[:20]


def read_archive(archive: Path) -> dict[str, bytes]:
    blob = archive.read_bytes()
    if sha256_bytes(blob) != ARCHIVE_SHA:
        raise SystemExit("S12_P3_R55_ADMISSION_STOP archive hash")
    files: dict[str, bytes] = {}
    with zipfile.ZipFile(archive) as handle:
        seen = []
        for info in handle.infolist():
            if info.filename.startswith("/") or ".." in Path(info.filename).parts:
                raise SystemExit("unsafe path")
            seen.append(info.filename)
            if not info.is_dir() and not info.filename.endswith("/"):
                files[info.filename] = handle.read(info)
    if len(seen) != len(set(seen)):
        raise SystemExit("duplicate member")
    return files


def rel(name: str) -> str:
    return name[len(PREFIX):]


def classify_member(path: str) -> tuple[str, str]:
    if path in EXECUTABLE and path.endswith("04_STATE_MACHINE_AND_REDUCER_CONTRACT.md"):
        return "EXECUTABLE_STORY_SOURCE", "explicit arrow-chain authority"
    if path in EXECUTABLE:
        return "EXECUTABLE_STORY_SOURCE", "canonical copy owner"
    if path == "FULL_TEXT/00_COMPLETE_SCRIPT_AND_INTERACTION_BOOK.md":
        return "NONEXECUTABLE_DOCUMENTATION", "convenience view of the canonical section files"
    if path in {"STATE/final_hotspot_register.json", "STATE/final_inventory_register.json", "STATE/final_story_state.json"}:
        return "STRUCTURAL_REGISTER", "machine register"
    if path.startswith("STATE/"):
        return "NONEXECUTABLE_DOCUMENTATION", "prose mirror of a structural register"
    if path.startswith("PUBLIC_TITLE/"):
        return "TITLE_ENDING_AUTHORITY", "title authority; navigation arrows are restated in the state-machine contract"
    if path == "MAIN_INTEGRATION/05_PERFORMANCE_AND_CONTROL_POLICY.md" or path.startswith("CONTRACTS/"):
        return "PERFORMANCE_AUTHORITY", "performance or interaction policy"
    if path.startswith(("SOURCE_", "DELTA/", "AUTHORITY/", "AUDIT/", "MAIN_", "DATA_BINDINGS/", "VERIFY_")) or path in {"START_HERE.md", "READ_ORDER.txt", "SEND_TO_MAIN_PROMPT.txt", "MANIFEST.sha256", "PACKAGE_SUMMARY.json"}:
        return "PROVENANCE_OR_INSTRUCTIONS", "provenance, instructions, or verifier"
    return "NONEXECUTABLE_DOCUMENTATION", "governance or narrative prose"


def load_catalog(repo: Path, catalog_ref: str | None = None) -> dict:
    manifest_relative = "public/art-packs/production/manifest.json"
    selector_relative = "src/adventure/semanticCatalog.ts"
    manifest_path = repo / manifest_relative
    selector_path = repo / selector_relative
    if catalog_ref:
        manifest_bytes = subprocess.check_output(["git", "show", f"{catalog_ref}:{manifest_relative}"], cwd=repo)
        selector_bytes = subprocess.check_output(["git", "show", f"{catalog_ref}:{selector_relative}"], cwd=repo)
        manifest_blob = hashlib.sha1(f"blob {len(manifest_bytes)}\0".encode() + manifest_bytes).hexdigest()
        selector_blob = hashlib.sha1(f"blob {len(selector_bytes)}\0".encode() + selector_bytes).hexdigest()
    else:
        manifest_bytes = manifest_path.read_bytes()
        selector_bytes = selector_path.read_bytes()
        manifest_blob = git_blob(manifest_path)
        selector_blob = git_blob(selector_path)
    manifest = json.loads(manifest_bytes)
    return {
        "manifestPath": manifest_relative,
        "manifestBlob": manifest_blob,
        "manifestSha256": sha256_bytes(manifest_bytes),
        "selectionOwner": selector_relative,
        "selectionBlob": selector_blob,
        "selectionSha256": sha256_bytes(selector_bytes),
        "clips": {"rook": sorted(manifest["characters"]["rook"]["animations"]), "arthur": sorted(manifest["characters"]["mrIndex"]["animations"])},
    }


def bind_clip(catalog: dict, actor: str, intent: str) -> dict:
    preferred = PREFERRED.get((actor, intent))
    clips = catalog["clips"].get(actor, [])
    if preferred and preferred in clips:
        fallback = preferred == "idle" and intent not in {"IDLE"}
        return {"actor": actor, "intent": intent, "preferredClip": f"characters.{'mrIndex' if actor == 'arthur' else 'rook'}.animations.{preferred}", "selectedClip": f"characters.{'mrIndex' if actor == 'arthur' else 'rook'}.animations.{preferred}", "manifestPath": catalog["manifestPath"], "manifestBlob": catalog["manifestBlob"], "manifestSha256": catalog["manifestSha256"], "selectionBlob": catalog["selectionBlob"], "selectionSha256": catalog["selectionSha256"], "membership": True, "fallback": fallback, "fallbackReason": None if not fallback else "no dedicated clip; idle is the admitted fallback", "changesStoryMeaning": False}
    if actor in catalog["clips"] and "idle" in catalog["clips"][actor]:
        return {"actor": actor, "intent": intent, "preferredClip": None, "selectedClip": f"characters.{'mrIndex' if actor == 'arthur' else 'rook'}.animations.idle", "manifestPath": catalog["manifestPath"], "manifestBlob": catalog["manifestBlob"], "manifestSha256": catalog["manifestSha256"], "selectionBlob": catalog["selectionBlob"], "selectionSha256": catalog["selectionSha256"], "membership": True, "fallback": True, "fallbackReason": "preferred capability is absent or the actor/intent is unresolved", "changesStoryMeaning": False}
    return {"actor": actor, "intent": "UNRESOLVED", "preferredClip": None, "selectedClip": None, "manifestPath": catalog["manifestPath"], "manifestBlob": catalog["manifestBlob"], "manifestSha256": catalog["manifestSha256"], "selectionBlob": catalog["selectionBlob"], "selectionSha256": catalog["selectionSha256"], "membership": False, "fallback": True, "fallbackReason": "no admitted clip", "changesStoryMeaning": False}


def cue_intent(text: str) -> str:
    folded = text.lower()
    if "stamp" in folded or "thunk" in folded:
        return "STAMP"
    if any(word in folded for word in ("walk", "enter", "steps", "turns", "turn toward")):
        return "MOVEMENT"
    if any(word in folded for word in ("look", "gaze", "stare")):
        return "GAZE"
    if any(word in folded for word in ("smile", "exhale", "blink", "frown")):
        return "EXPRESSION"
    if any(word in folded for word in ("hold", "sheet", "paper", "form", "pen")):
        return "PROP"
    if any(word in folded for word in ("beat", "pause", "wait")):
        return "BEAT"
    return "STAGE"


def resolve_actor(clause: str, previous: str | None) -> tuple[str, str, str | None]:
    """Resolve only the leading grammatical subject inside one stage block.

    Character names later in a cue are objects and never establish ownership.  A
    leading pronoun or lowercase continuation may inherit only from an earlier
    explicit subject in the same bracketed stage block.
    """
    leading = re.sub(r"^\s*\[?\s*", "", clause)
    explicit = re.match(r"(Rook|Arthur)\b", leading, re.IGNORECASE)
    if explicit:
        actor = explicit.group(1).lower()
        return actor, "EXPLICIT_LEADING_SUBJECT", explicit.group(1)
    if re.match(r"He\b", leading, re.IGNORECASE) and previous in {"arthur", "rook"}:
        return previous, "INHERITED_LEADING_PRONOUN", "He"
    if re.match(r"(?:and\s+)?then\b", leading, re.IGNORECASE) and previous in {"arthur", "rook"}:
        return previous, "INHERITED_SUBJECTLESS_CONTINUATION", None
    return "UNRESOLVED", "AMBIGUOUS_UNRESOLVED", None


def split_stage(text: str) -> list[str]:
    parts = [part.strip() for part in re.split(r"\n\s*\n", text.strip()) if part.strip()]
    return parts or ([text.strip()] if text.strip() else [])


def norm_heading(text: str) -> str:
    return re.sub(r"[^A-Z0-9]+", " ", text.upper()).strip()


def line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def byte_at(text: str, char_index: int) -> int:
    return len(text[:char_index].encode())


def span(path: str, text: str, start: int, end: int, semantic: str, owner: str, anchor: str, in_graph: bool, reason: str | None, ordinals: dict) -> dict:
    raw = text[start:end]
    ordinals[semantic + anchor + raw] = ordinals.get(semantic + anchor + raw, 0) + 1
    ordinal = ordinals[semantic + anchor + raw] - 1
    return {
        "id": stable_id(path, anchor, semantic, raw, ordinal),
        "path": path,
        "memberSha256": sha256_bytes(text.encode()),
        "byteStart": byte_at(text, start),
        "byteEnd": byte_at(text, end),
        "lineStart": line_of(text, start),
        "lineEnd": line_of(text, max(start, end - 1)),
        "rawText": raw,
        "rawSha256": sha256_bytes(raw.encode()),
        "rawEncoding": "utf-8",
        "displayText": raw,
        "semanticClass": semantic,
        "owner": owner,
        "anchor": anchor,
        "inGraph": in_graph,
        "omissionReason": reason,
    }


def classify_gap(raw: str) -> str:
    if raw.strip() == "" or re.fullmatch(r"[\s`>#*\-_=\[\]()]+", raw or ""):
        return "MARKUP_OR_SEPARATOR"
    return "NONEXECUTABLE_PROSE"


def parse_events(body: str) -> list[dict]:
    lines = body.splitlines(keepends=True)
    events = []
    index = 0
    cursor = 0
    positions = []
    for line in lines:
        positions.append(cursor)
        cursor += len(line)
    while index < len(lines):
        line = lines[index]
        stripped = line.strip()
        if stripped.startswith("["):
            start = positions[index]
            depth = stripped.count("[") - stripped.count("]")
            chunk = [line]
            index += 1
            while index < len(lines) and depth > 0:
                depth += lines[index].count("[") - lines[index].count("]")
                chunk.append(lines[index])
                index += 1
            text = "".join(chunk).strip("\n")
            events.append({"kind": "stage", "text": text, "start": start, "end": start + len("".join(chunk).rstrip("\n"))})
            continue
        label = stripped[:-1] if stripped.endswith(":") else None
        if label in LABELS:
            start = positions[index]
            index += 1
            payload = []
            while index < len(lines) and lines[index].strip() and not lines[index].strip().startswith("[") and lines[index].strip()[:-1] not in LABELS and lines[index].strip()[:-1] not in SPEAKERS:
                payload.append(lines[index])
                index += 1
            text = "".join(payload).strip("\n")
            end = positions[index - 1] + len(lines[index - 1].rstrip("\n")) if payload else positions[index - 1] + len(stripped)
            events.append({"kind": LABELS[label], "label": label, "text": text, "start": start, "end": max(end, start + len(stripped))})
            continue
        if stripped[:-1] in SPEAKERS and stripped.endswith(":"):
            speaker = stripped[:-1]
            start = positions[index] + len(line)  # spoken text starts after the speaker line
            index += 1
            spoken = []
            while index < len(lines):
                nxt = lines[index].strip()
                if nxt.startswith("[") or (nxt.endswith(":") and (nxt[:-1] in SPEAKERS or nxt[:-1] in LABELS)):
                    break
                spoken.append(lines[index])
                index += 1
            text = "".join(spoken).strip("\n")
            end = start + len("".join(spoken).rstrip("\n")) if spoken else start
            events.append({"kind": "dialogue", "speaker": speaker, "text": text, "start": positions[index - len(spoken) - 1] if spoken else positions[index - 1], "end": end if spoken else positions[max(0, index - 1)] + len(lines[max(0, index - 1)].rstrip("\n")), "textStart": start if spoken else positions[index - 1], "textEnd": end})
            continue
        if stripped and stripped == stripped.upper() and len(stripped) > 8 and not stripped.startswith("→"):
            predicate = None
            start = positions[index]
            end = start + len(line.rstrip("\n"))
            index += 1
            if index < len(lines) and lines[index].strip().startswith("["):
                predicate = lines[index].strip().strip("[]")
                end = positions[index] + len(lines[index].rstrip("\n"))
                index += 1
            events.append({"kind": "choice", "text": stripped, "predicate": predicate, "start": start, "end": end})
            continue
        index += 1
    return events


def partition_executable(path: str, text: str, owner: str, ordinals: dict) -> tuple[list[dict], list[dict]]:
    spans = []
    covered = []
    for match in re.finditer(r"(?m)^#{1,3} .+$", text):
        covered.append((match.start(), match.end(), "heading", match.group(0)))
    for match in re.finditer(r"```text\n|```", text):
        if match.group(0).startswith("```"):
            covered.append((match.start(), match.end(), "fence", match.group(0)))
    elements = []
    for match in re.finditer(r"```text\n(.*?)```", text, re.S):
        body = match.group(1)
        base = match.start(1)
        for event in parse_events(body):
            elements.append({**event, "start": base + event["start"], "end": base + event["end"]})
    for start, end, _kind, raw in covered:
        if _kind == "heading":
            anchor = raw.lstrip("#").strip()
            spans.append(span(path, text, start, end, "HEADING_OR_CONTAINER", owner, anchor, False, "heading is a container, not an executable branch", ordinals))
        else:
            spans.append(span(path, text, start, end, "MARKUP_OR_SEPARATOR", owner, "markup", False, "fence marker", ordinals))
    return spans, elements


def add_gap_spans(path: str, text: str, owner: str, spans: list[dict], ordinals: dict) -> list[dict]:
    ranges = sorted((item["byteStart"], item["byteEnd"]) for item in spans)
    # convert existing char-based spans already stored as bytes
    cursor = 0
    gaps = []
    for start, end in ranges:
        if start > cursor:
            gaps.append((cursor, start))
        cursor = max(cursor, end)
    if cursor < len(text.encode()):
        gaps.append((cursor, len(text.encode())))
    # map byte gaps back to character slices by walking
    encoded = text.encode()
    out = list(spans)
    for start, end in gaps:
        raw = encoded[start:end].decode()
        # find char position
        char_start = len(encoded[:start].decode())
        semantic = classify_gap(raw)
        out.append(span(path, text, char_start, char_start + len(raw), semantic, owner, "gap", False, "unparsed prose" if semantic == "NONEXECUTABLE_PROSE" else "whitespace or markdown syntax", ordinals))
    out.sort(key=lambda item: (item["byteStart"], item["byteEnd"]))
    return out


def check_partition(text: str, spans: list[dict]) -> None:
    size = len(text.encode())
    ordered = sorted(spans, key=lambda item: (item["byteStart"], item["byteEnd"]))
    cursor = 0
    for item in ordered:
        if item["byteStart"] != cursor or item["byteEnd"] > size or item["byteStart"] < 0:
            raise SystemExit(f"partition failed cursor={cursor} start={item['byteStart']} end={item['byteEnd']} size={size}")
        raw = item["rawText"].encode()
        if len(raw) != item["byteEnd"] - item["byteStart"] or sha256_bytes(raw) != item["rawSha256"]:
            raise SystemExit(f"raw span failed {path} {item['id']}")
        cursor = item["byteEnd"]
    if cursor != size or b"".join(item["rawText"].encode() for item in ordered) != text.encode():
        raise SystemExit(f"partition reconstruction failed {path}")


def build(files: dict[str, bytes], repo: Path, catalog_ref: str | None = None) -> dict:
    catalog = load_catalog(repo, catalog_ref)
    hot = {item["id"]: item["name"] for item in json.loads(files[PREFIX + "STATE/final_hotspot_register.json"])["hotspots"]}
    inv = {item["id"]: item["name"] for item in json.loads(files[PREFIX + "STATE/final_inventory_register.json"])["inventory"]}
    if sha256_bytes(files[PREFIX + "STATE/final_hotspot_register.json"]) != HOTSPOT_SHA or sha256_bytes(files[PREFIX + "STATE/final_inventory_register.json"]) != INVENTORY_SHA:
        raise SystemExit("register hash")
    a1 = files[PREFIX + "FULL_TEXT/02_A1_OPENING_AND_AUTHORIZATION_FULL.md"].decode()
    begin = "<!-- BEGIN EXACT A1.1-A1.5 CARRY-FORWARD -->"
    end = "<!-- END EXACT A1.1-A1.5 CARRY-FORWARD -->"
    region = a1[a1.index(begin) + len(begin):a1.index(end)]
    if region.startswith("\n"):
        region = region[1:]
    if sha256_bytes(region.encode()) != A1_SHA or PHRASE_SOURCE not in region or re.search(r"hieroglyphs?", region, re.I):
        raise SystemExit("A1 admission")
    ledger = []
    nodes = []
    edges = []
    ordinals: dict[str, int] = {}
    first_dialogue_under: dict[tuple[str, str], str] = {}
    source_members: dict[str, dict] = {}
    state_authored_occurrences = 0
    state_edge_keys: set[tuple[str, str]] = set()
    for name in sorted(files):
        path = rel(name)
        data = files[name]
        source_members[path] = {"bytes": len(data), "sha256": sha256_bytes(data)}
        kind, reason = classify_member(path)
        if path not in EXECUTABLE:
            raw = data.decode()
            ledger.append({"id": stable_id(path, "member", "archiveMember", path, 0), "path": path, "memberSha256": sha256_bytes(data), "memberBytes": len(data), "byteStart": 0, "byteEnd": len(data), "lineStart": 1, "lineEnd": raw.count("\n") + 1, "rawText": raw, "rawSha256": sha256_bytes(data), "rawEncoding": "utf-8", "displayText": raw, "semanticClass": "ARCHIVE_MEMBER", "classification": kind, "owner": None, "anchor": "member", "inGraph": False, "omissionReason": reason})
            continue
        text = data.decode()
        owner = EXECUTABLE[path]
        spans, _ = partition_executable(path, text, owner, ordinals)
        # dialogue and other fence elements
        for fence in re.finditer(r"```text\n(.*?)```", text, re.S):
            body = fence.group(1)
            base = fence.start(1)
            anchor = path
            for heading in re.finditer(r"(?m)^#{1,3} .+$", text):
                if heading.start() < fence.start():
                    anchor = heading.group(0).lstrip("#").strip()
            token_lines = [line.strip() for line in body.splitlines() if line.strip()]

            def chain(line: str) -> list[str] | None:
                parts = [part.strip() for part in line.split("→")]
                parts = [part for part in parts if part]
                banned = {"OPEN", "CLOSE", "GIVE", "TOPIC", "ACTION"}
                if parts and all(part not in banned and re.fullmatch(r"[A-Z0-9_/+]+(?: \+ [A-Z0-9_/+]+)*", part) for part in parts):
                    return parts
                return None

            parsed_lines = [chain(line) for line in token_lines]
            if token_lines and any("→" in line for line in token_lines) and all(item is not None for item in parsed_lines):
                search_from = 0
                authored_chains: list[list[str]] = []
                current_chain: list[str] | None = None
                for line, parts in zip(token_lines, parsed_lines):
                    local = body.find(line, search_from)
                    search_from = local + len(line)
                    record = span(path, text, base + local, base + local + len(line), "STATE_MACHINE_RECORD", owner, "STATE_MACHINE", False, None, ordinals)
                    record["displayText"] = line
                    spans.append(record)
                    if line.startswith("→"):
                        if current_chain is None:
                            raise SystemExit("state continuation without a preceding chain")
                        current_chain.extend(parts or [])
                    else:
                        current_chain = list(parts or [])
                        authored_chains.append(current_chain)
                    for part in parts or []:
                        node_id = stable_id(path, "STATE_MACHINE", "STATE_MACHINE_RECORD", part, 0)
                        if not any(node["id"] == node_id for node in nodes):
                            nodes.append({"id": node_id, "ledgerId": record["id"], "kind": "system", "owner": "STATE_MACHINE", "speaker": None, "text": part, "anchor": "STATE_MACHINE", "source": {"path": path, "byteStart": record["byteStart"], "byteEnd": record["byteEnd"], "lineStart": record["lineStart"], "lineEnd": record["lineEnd"]}, "cues": [], "hotspotIds": [], "inventoryIds": [], "activation": ACTIVATION, "playableMission02": False, "entrypoint": False})
                for authored_chain in authored_chains:
                    state_authored_occurrences += max(0, len(authored_chain) - 1)
                    for left_text, right_text in zip(authored_chain, authored_chain[1:]):
                        left = stable_id(path, "STATE_MACHINE", "STATE_MACHINE_RECORD", left_text, 0)
                        right = stable_id(path, "STATE_MACHINE", "STATE_MACHINE_RECORD", right_text, 0)
                        key = (left, right)
                        if key in state_edge_keys:
                            continue
                        state_edge_keys.add(key)
                        edges.append({"kind": "STATE_MACHINE", "source": left, "target": right, "predicate": None, "effects": [{"type": "SET_STORY_STATE", "state": right_text, "once": False, "sourceId": left}]})
                continue
            events = parse_events(body)
            pending: list[dict[str, str | None]] = []
            previous_dialogue = None
            for event in events:
                abs_start = base + event["start"]
                abs_end = base + event["end"]
                if event["kind"] == "stage":
                    stage_actor = None
                    for clause in split_stage(event["text"]):
                        actor, resolution, leading_subject = resolve_actor(clause, stage_actor)
                        if resolution == "EXPLICIT_LEADING_SUBJECT":
                            stage_actor = actor
                        pending.append({"sourceText": clause, "actor": actor, "subjectResolution": resolution, "leadingSubject": leading_subject})
                    spans.append(span(path, text, abs_start, abs_end, "STAGE_CUE", owner, anchor, False, "cue metadata on the following dialogue line", ordinals))
                    continue
                if event["kind"] == "dialogue":
                    cues = []
                    for subject in pending:
                        clause = str(subject["sourceText"])
                        actor = str(subject["actor"])
                        intent = cue_intent(clause)
                        bound = bind_clip(catalog, actor if actor != "UNRESOLVED" else "rook", intent if actor != "UNRESOLVED" else "STAGE")
                        if actor == "UNRESOLVED":
                            bound = bind_clip(catalog, "UNRESOLVED", "UNRESOLVED")
                        cues.append({"sourceText": clause, "subjectResolution": subject["subjectResolution"], "leadingSubject": subject["leadingSubject"], **bound})
                    pending = []
                    record = span(path, text, abs_start, max(abs_end, abs_start + 1), "DIALOGUE_LINE", owner, anchor, True, None, ordinals)
                    record["speaker"] = event["speaker"]
                    record["displayText"] = event["text"]
                    record["displaySha256"] = sha256_bytes(event["text"].encode())
                    record["id"] = stable_id(path, anchor, "DIALOGUE_LINE", event["text"], ordinals.get(path + anchor + event["text"], 0))
                    ordinals[path + anchor + event["text"]] = ordinals.get(path + anchor + event["text"], 0) + 1
                    record["id"] = stable_id(path, anchor, "DIALOGUE_LINE", event["text"], ordinals[path + anchor + event["text"]] - 1)
                    spans.append(record)
                    node = {"id": record["id"], "ledgerId": record["id"], "kind": "dialogueLine", "owner": owner, "speaker": event["speaker"], "text": event["text"], "anchor": anchor, "source": {"path": path, "byteStart": record["byteStart"], "byteEnd": record["byteEnd"], "lineStart": record["lineStart"], "lineEnd": record["lineEnd"]}, "cues": cues, "hotspotIds": [i for i, n in hot.items() if n and n in event["text"]], "inventoryIds": [i for i, n in inv.items() if n and n in event["text"]], "activation": ACTIVATION, "playableMission02": False, "entrypoint": previous_dialogue is None}
                    nodes.append(node)
                    first_dialogue_under.setdefault((path, norm_heading(anchor)), node["id"])
                    if previous_dialogue:
                        edges.append({"kind": "AUTHORED_FENCE_SEQUENCE", "source": previous_dialogue, "target": node["id"], "predicate": None, "effects": []})
                        node["entrypoint"] = False
                    previous_dialogue = node["id"]
                    continue
                previous_dialogue = None
                semantic = {"topic": "TOPIC", "action": "VERB_RESPONSE", "verbResponse": "VERB_RESPONSE", "choice": "UPPERCASE_RECORD"}[event["kind"]]
                menu_spec = MENU_SPECS.get((path, norm_heading(anchor)))
                if event["kind"] == "choice" and menu_spec and event["text"] in menu_spec:
                    semantic = "CHOICE"
                elif event["kind"] == "choice" and event["text"] in INTERACTION_ACTION_LABELS:
                    semantic = "INTERACTION_ACTION"
                record = span(path, text, abs_start, max(abs_end, abs_start + 1), semantic, owner, anchor, False, "response catalog has no authored traversal" if semantic == "VERB_RESPONSE" else None, ordinals)
                record["displayText"] = event["text"]
                record["displaySha256"] = sha256_bytes(event["text"].encode())
                record["id"] = stable_id(path, anchor, semantic, event["text"], ordinals.get(path + anchor + semantic + event["text"], 0))
                ordinals[path + anchor + semantic + event["text"]] = ordinals.get(path + anchor + semantic + event["text"], 0) + 1
                record["id"] = stable_id(path, anchor, semantic, event["text"], ordinals[path + anchor + semantic + event["text"]] - 1)
                if semantic == "CHOICE":
                    record["menuKey"] = norm_heading(anchor)
                    record["inGraph"] = False
                if "CASE FILE 02...................... SEALED" in event["text"]:
                    record["semanticClass"] = "STATIC_STINGER"
                    record["inGraph"] = False
                    record["omissionReason"] = "Mission 02 static stinger is not playable"
                spans.append(record)
            # choices resolved after all files; stored on spans
        filled = add_gap_spans(path, text, owner, spans, ordinals)
        check_partition(text, filled)
        for item in filled:
            item["classification"] = "EXECUTABLE_STORY_SOURCE"
            item["memberBytes"] = len(data)
            ledger.append(item)
    # resolve choices now that headings' first dialogue exists
    choice_spans = [entry for entry in ledger if entry.get("semanticClass") == "CHOICE"]
    menus: dict[str, str] = {}
    for entry in choice_spans:
        spec = MENU_SPECS[(entry["path"], entry["menuKey"])][entry["displayText"]]
        predicates = []
        if spec.get("notAsked"):
            predicates.append({"type": "NOT_ASKED", "topic": spec["mark"]})
        if spec.get("branches"):
            predicates.append({"type": "STATE_IN", "states": [state for _anchor, states in spec["branches"] for state in states]})
        if spec.get("notStates"):
            predicates.append({"type": "STATE_NOT_IN", "states": spec["notStates"]})
        predicate = predicates[0] if len(predicates) == 1 else ({"type": "ALL", "predicates": predicates} if predicates else None)
        effects = []
        if spec.get("mark"):
            effects = [{"type": "MARK_TOPIC_ASKED", "topic": spec["mark"], "once": True, "sourceId": entry["id"]}]
        menu_key = entry["path"] + entry["anchor"]
        if menu_key not in menus:
            menus[menu_key] = stable_id(entry["path"], entry["anchor"], "MENU", entry["anchor"], 0)
            nodes.append({"id": menus[menu_key], "ledgerId": entry["id"], "kind": "menu", "owner": entry["owner"], "speaker": None, "text": entry["anchor"], "anchor": entry["anchor"], "source": {"path": entry["path"], "byteStart": entry["byteStart"], "byteEnd": entry["byteEnd"], "lineStart": entry["lineStart"], "lineEnd": entry["lineEnd"]}, "cues": [], "hotspotIds": [], "inventoryIds": [], "activation": ACTIVATION, "playableMission02": False, "entrypoint": True})
        nodes.append({"id": entry["id"], "ledgerId": entry["id"], "kind": "choice", "owner": entry["owner"], "speaker": None, "text": entry["displayText"], "anchor": entry["anchor"], "source": {"path": entry["path"], "byteStart": entry["byteStart"], "byteEnd": entry["byteEnd"], "lineStart": entry["lineStart"], "lineEnd": entry["lineEnd"]}, "cues": [], "hotspotIds": [], "inventoryIds": [], "activation": ACTIVATION, "playableMission02": False, "entrypoint": False})
        edges.append({"kind": "TOPIC_CHOICE", "source": menus[menu_key], "target": entry["id"], "predicate": predicate, "effects": effects})
        targets = spec.get("branches") or [(spec["target"], None)]
        for target_anchor, states in targets:
            target = first_dialogue_under.get((entry["path"], norm_heading(target_anchor)))
            if not target:
                raise SystemExit(f"missing exact menu target {entry['displayText']} -> {target_anchor}")
            response_predicate = {"type": "STATE_IN", "states": states} if states else None
            edges.append({"kind": "TOPIC_RESPONSE", "source": entry["id"], "target": target, "predicate": response_predicate, "effects": []})
        entry["inGraph"] = True
        entry["omissionReason"] = None
    deduplicated = []
    seen_edges = set()
    for edge in edges:
        key = json.dumps(edge, sort_keys=True, ensure_ascii=False)
        if key not in seen_edges:
            seen_edges.add(key)
            deduplicated.append(edge)
    edges = deduplicated
    # dialogue nodes already appended during parse; mark their ledger inGraph
    graph_ids = {node["id"] for node in nodes}
    for entry in ledger:
        if entry["id"] in graph_ids:
            entry["inGraph"] = True
            entry["omissionReason"] = None
    for node in nodes:
        if node["kind"] == "system":
            node["entrypoint"] = not any(edge["target"] == node["id"] for edge in edges)
    indegree = {node["id"]: 0 for node in nodes}
    for edge in edges:
        indegree[edge["target"]] = indegree.get(edge["target"], 0) + 1
    for node in nodes:
        if node["kind"] == "dialogueLine" and indegree[node["id"]] == 0:
            node["entrypoint"] = True
    entrypoints = [{"id": node["id"], "name": node["anchor"], "kind": node["kind"]} for node in nodes if node.get("entrypoint")]
    registry = {
        "schemaVersion": "s12-p3-r4-registry.v1",
        "activation": ACTIVATION,
        "archiveSha256": ARCHIVE_SHA,
        "catalog": catalog,
        "a1": {"sha256": A1_SHA, "bytes": 5861, "lines": 489, "phrase": "mathematically precise haystack", "phraseSource": PHRASE_SOURCE, "phraseNodeId": next(node["id"] for node in nodes if PHRASE_SOURCE in node.get("text", "")), "hieroglyphsPresent": False},
        "title": {"publicTitle": "Tarka", "displayWordmark": "TARKA", "internalCodename": "TRACE//ESCAPE", "controls": ["PLAY", "CREDITS"], "activation": ACTIVATION},
        "mission02": {"playable": False, "inGraph": False, "stingerText": "CASE FILE 02...................... SEALED\n\nFUTURE ACCESS..................... PENDING", "activation": ACTIVATION},
        "namedRoutes": {"direct": "NOT_DEFINED_IN_R55", "curious": "NOT_DEFINED_IN_R55", "mistaken": "NOT_DEFINED_IN_R55", "coreSequence": "STATE_MACHINE_ARROW_CHAIN"},
        "countSlots": [{"token": "{{E03_Q1_PRIOR_ACCEPTED_COUNT}}", "value": 98, "activation": ACTIVATION}, {"token": "{{E03_Q2_PRIOR_ACCEPTED_COUNT}}", "value": 3, "activation": ACTIVATION}, {"token": "{{E03_Q2_CURRENT_ACCEPTED_COUNT}}", "value": 2, "activation": ACTIVATION}],
        "sourceMembers": source_members,
        "sourceLedger": ledger,
        "graph": {"nodes": nodes, "edges": edges, "entrypoints": entrypoints, "stateMachine": {"authoredOccurrences": state_authored_occurrences, "uniqueEdges": len([edge for edge in edges if edge["kind"] == "STATE_MACHINE"])}},
    }
    audit_records = []
    for node in nodes:
        for cue_index, cue in enumerate(node.get("cues", [])):
            audit_records.append({
                "nodeId": node["id"],
                "cueIndex": cue_index,
                "sourceText": cue["sourceText"],
                "actor": cue["actor"],
                "subjectResolution": cue["subjectResolution"],
                "leadingSubject": cue["leadingSubject"],
            })
    registry["cueSubjectAudit"] = {
        "rule": "leading explicit Rook/Arthur; leading He or then-continuation inherits within the same stage block; object names and following dialogue speakers never own the cue",
        "totalCues": len(audit_records),
        "explicitCount": sum(row["subjectResolution"] == "EXPLICIT_LEADING_SUBJECT" for row in audit_records),
        "inheritedCount": sum(str(row["subjectResolution"]).startswith("INHERITED_") for row in audit_records),
        "unresolvedCount": sum(row["subjectResolution"] == "AMBIGUOUS_UNRESOLVED" for row in audit_records),
        "records": audit_records,
    }
    validate(registry, files)
    return registry


def validate(registry: dict, files: dict[str, bytes]) -> None:
    nodes = {node["id"]: node for node in registry["graph"]["nodes"]}
    edges = registry["graph"]["edges"]
    ledger = {entry["id"]: entry for entry in registry["sourceLedger"]}
    if len(ledger) != len(registry["sourceLedger"]) or len(nodes) != len(registry["graph"]["nodes"]):
        raise SystemExit("duplicate id")
    edge_keys = [json.dumps(edge, sort_keys=True, ensure_ascii=False) for edge in edges]
    if len(edge_keys) != len(set(edge_keys)):
        raise SystemExit("duplicate edge")
    indegree = {node_id: 0 for node_id in nodes}
    outdegree = {node_id: 0 for node_id in nodes}
    for edge in edges:
        if edge["source"] not in nodes or edge["target"] not in nodes:
            raise SystemExit("dangling")
        if edge["kind"] == "AUTHORED_FENCE_SEQUENCE" and edge["effects"]:
            raise SystemExit("sequence effect")
        if any(effect.get("type", "").startswith("traverse") or str(effect.get("id", "")).startswith("traverse:") for effect in edge["effects"]):
            raise SystemExit("synthetic traverse")
        if edge["kind"] == "STATE_MACHINE":
            expected_effects = [{"type": "SET_STORY_STATE", "state": nodes[edge["target"]]["text"], "once": False, "sourceId": edge["source"]}]
            if edge["effects"] != expected_effects:
                raise SystemExit("state effect mismatch")
        indegree[edge["target"]] += 1
        outdegree[edge["source"]] += 1
    isolated_choices = [node for node in nodes.values() if node["kind"] == "choice" and (indegree[node["id"]] == 0 or outdegree[node["id"]] == 0)]
    entry_ids = {item["id"] for item in registry["graph"]["entrypoints"]}
    unaccounted = [node for node in nodes.values() if indegree[node["id"]] == 0 and node["id"] not in entry_ids]
    if isolated_choices or unaccounted:
        raise SystemExit(f"topology choices={len(isolated_choices)} unaccounted={len(unaccounted)}")
    for node in nodes.values():
        if node["ledgerId"] not in ledger:
            raise SystemExit(f"missing ledger {node['kind']} {node['text'][:40]} {node['ledgerId']}")
        entry = ledger[node["ledgerId"]]
        if node["source"] != {key: entry[key] for key in ("path", "byteStart", "byteEnd", "lineStart", "lineEnd")}:
            raise SystemExit("node ledger source mismatch")
        if node["kind"] in {"dialogueLine", "choice"} and node["id"] != node["ledgerId"]:
            raise SystemExit("node ledger id mismatch")
        if node["kind"] == "dialogueLine" and (node["text"] != entry["displayText"] or node["speaker"] != entry["speaker"]):
            raise SystemExit("dialogue ledger mismatch")
        if node["kind"] == "choice" and node["text"] != entry["displayText"]:
            raise SystemExit("choice ledger mismatch")
        if node.get("speaker") in LABELS:
            raise SystemExit("false speaker")
    first = next(node for node in nodes.values() if node.get("text") == "“This the Records Office?”")
    if [cue["actor"] for cue in first["cues"][:3]] != ["arthur", "arthur", "rook"]:
        raise SystemExit("actor")
    expected_subjects = {
        "He looks back at Rook.]": "arthur",
        "then back at Rook.]": "arthur",
        "[Rook walks to Arthur.": "rook",
        "Rook turns toward Arthur,\nbarely containing himself.]": "rook",
    }
    actual_subjects = {cue["sourceText"]: cue["actor"] for node in nodes.values() for cue in node.get("cues", []) if cue["sourceText"] in expected_subjects}
    if actual_subjects != expected_subjects:
        raise SystemExit(f"cue subject mismatch {actual_subjects}")
    audit = registry.get("cueSubjectAudit", {})
    audit_rows = audit.get("records", [])
    cues = [cue for node in registry["graph"]["nodes"] for cue in node.get("cues", [])]
    if audit.get("totalCues") != len(cues) or len(audit_rows) != len(cues):
        raise SystemExit("cue subject audit incomplete")
    expected_state_edges = {
        ("TARKA_TITLE_SCREEN", "TITLE_PLAY"),
        ("TITLE_PLAY", "FULL_FRESH_RESET"),
        ("FULL_FRESH_RESET", "OPENING_CUTSCENE"),
        ("OPENING_CUTSCENE", "AUTHORIZATION_PUZZLE"),
        ("AUTHORIZATION_PUZZLE", "CASE_WORLD_AND_TERMINAL"),
        ("CASE_WORLD_AND_TERMINAL", "PROOF_COMPLETE"),
        ("PROOF_COMPLETE", "CLOSE_CASE_CONFIRMATION"),
        ("CLOSE_CASE_CONFIRMATION", "ENDING_COMMITTED"),
        ("ENDING_COMMITTED", "FINAL_COMPLETION_SCREEN"),
        ("BOOT", "TARKA_TITLE_SCREEN"),
        ("TITLE_CREDITS", "TARKA_CREDITS"),
        ("TARKA_CREDITS", "TARKA_TITLE_SCREEN"),
        ("ENDING_MAIN_MENU", "TARKA_TITLE_SCREEN"),
        ("ENDING_PLAY_AGAIN", "FULL_FRESH_RESET"),
        ("FORM_AVAILABLE", "FORM_TAKEN"),
        ("FORM_TAKEN", "PEN_AVAILABLE/TAKEN"),
        ("PEN_AVAILABLE/TAKEN", "FORM_COMPLETED"),
        ("FORM_COMPLETED", "BARELY_LEGIBLE_SIGNED_FORM + POORLY_MISHANDLED_BROKEN_PEN"),
        ("BARELY_LEGIBLE_SIGNED_FORM + POORLY_MISHANDLED_BROKEN_PEN", "ARTHUR_REVIEW"),
        ("ARTHUR_REVIEW", "STAMP_RETURN_CONTACT"),
        ("STAMP_RETURN_CONTACT", "AUTHORIZED"),
        ("PREBRIEF_NO_EULER_FILE", "Q1"),
        ("Q1", "Q2"),
        ("Q2", "Q3_EXACT_RECEIPT"),
        ("Q3_EXACT_RECEIPT", "PROOF_ASSEMBLY"),
        ("PROOF_ASSEMBLY", "PROOF_COMPLETE"),
        ("PROOF_COMPLETE", "CLOSE_CASE"),
    }
    actual_state_edges = {(nodes[edge["source"]]["text"], nodes[edge["target"]]["text"]) for edge in edges if edge["kind"] == "STATE_MACHINE"}
    if actual_state_edges != expected_state_edges or registry["graph"]["stateMachine"] != {"authoredOccurrences": 30, "uniqueEdges": 27}:
        raise SystemExit(f"state edge mismatch authored={registry['graph']['stateMachine']} actual={len(actual_state_edges)}")
    for false_edge in (("OPENING_CUTSCENE", "TITLE_CREDITS"), ("TARKA_TITLE_SCREEN", "ENDING_MAIN_MENU"), ("TARKA_TITLE_SCREEN", "ENDING_PLAY_AGAIN")):
        if false_edge in actual_state_edges:
            raise SystemExit(f"false cross-line edge {false_edge}")
    choices = [node for node in nodes.values() if node["kind"] == "choice"]
    if len(choices) != 11:
        raise SystemExit(f"exact menu choice count {len(choices)}")
    for (path, anchor), options in MENU_SPECS.items():
        actual = {node["text"] for node in choices if node["source"]["path"] == path and norm_heading(node["anchor"]) == anchor}
        if actual != set(options):
            raise SystemExit(f"menu mismatch {path} {anchor}")
    interactions = {entry["displayText"] for entry in ledger.values() if entry.get("semanticClass") == "INTERACTION_ACTION"}
    if not INTERACTION_ACTION_LABELS.issubset(interactions):
        raise SystemExit("interaction action misclassification")
    by_path: dict[str, list] = {}
    for entry in registry["sourceLedger"]:
        if entry.get("classification") == "EXECUTABLE_STORY_SOURCE" and entry.get("semanticClass") != "ARCHIVE_MEMBER":
            by_path.setdefault(entry["path"], []).append(entry)
    for path, entries in by_path.items():
        ordered = sorted(entries, key=lambda item: (item["byteStart"], item["byteEnd"]))
        cursor = 0
        reconstructed = []
        source = files[PREFIX + path]
        for entry in ordered:
            raw = entry["rawText"].encode()
            if entry["byteStart"] != cursor or len(raw) != entry["byteEnd"] - entry["byteStart"] or sha256_bytes(raw) != entry["rawSha256"]:
                raise SystemExit(f"raw ledger mismatch {path} {entry['id']}")
            reconstructed.append(raw)
            cursor = entry["byteEnd"]
        rebuilt = b"".join(reconstructed)
        if cursor != len(source) or rebuilt != source or sha256_bytes(rebuilt) != registry["sourceMembers"][path]["sha256"]:
            raise SystemExit(f"source reconstruction mismatch {path}")
    for node in nodes.values():
        for cue in node.get("cues", []):
            if cue["manifestBlob"] != registry["catalog"]["manifestBlob"] or cue["manifestSha256"] != registry["catalog"]["manifestSha256"] or cue["selectionBlob"] != registry["catalog"]["selectionBlob"] or cue["selectionSha256"] != registry["catalog"]["selectionSha256"]:
                raise SystemExit("per-cue catalog mismatch")


def performance_map(registry: dict) -> dict:
    rows = []
    seen = set()
    for node in registry["graph"]["nodes"]:
        for cue in node.get("cues", []):
            key = (cue["actor"], cue["intent"], cue.get("selectedClip"))
            if key in seen:
                continue
            seen.add(key)
            rows.append({k: cue[k] for k in ("actor", "intent", "preferredClip", "selectedClip", "manifestPath", "manifestBlob", "manifestSha256", "selectionBlob", "selectionSha256", "membership", "fallback", "fallbackReason", "changesStoryMeaning")})
    rows.sort(key=lambda row: (row["actor"], row["intent"], row["selectedClip"] or ""))
    return {"schemaVersion": "s12-p3-r4-performance-map.v1", "activation": ACTIVATION, "catalog": registry["catalog"], "mappings": rows}


def coverage(registry: dict) -> dict:
    executable_paths = sorted({entry["path"] for entry in registry["sourceLedger"] if entry.get("classification") == "EXECUTABLE_STORY_SOURCE" and entry.get("semanticClass") != "ARCHIVE_MEMBER"})
    partitions = []
    for path in executable_paths:
        entries = [entry for entry in registry["sourceLedger"] if entry["path"] == path and entry.get("semanticClass") != "ARCHIVE_MEMBER"]
        ordered = sorted(entries, key=lambda item: item["byteStart"])
        cursor = 0
        overlap = 0
        out_of_range = 0
        end = registry["sourceMembers"][path]["bytes"]
        reconstructed = []
        discontinuities = 0
        raw_mismatches = 0
        for entry in ordered:
            raw = entry["rawText"].encode()
            if entry["byteStart"] != cursor:
                discontinuities += 1
            if entry["byteStart"] < cursor:
                overlap += cursor - entry["byteStart"]
            if entry["byteEnd"] > end:
                out_of_range += 1
            if len(raw) != entry["byteEnd"] - entry["byteStart"] or sha256_bytes(raw) != entry["rawSha256"]:
                raw_mismatches += 1
            reconstructed.append(raw)
            cursor = max(cursor, entry["byteEnd"])
        rebuilt = b"".join(reconstructed)
        exact = cursor == end and discontinuities == 0 and overlap == 0 and out_of_range == 0 and raw_mismatches == 0 and sha256_bytes(rebuilt) == registry["sourceMembers"][path]["sha256"]
        partitions.append({"path": path, "memberBytes": end, "memberSha256": registry["sourceMembers"][path]["sha256"], "spanCount": len(ordered), "uncoveredBytes": max(0, end - cursor), "overlappingBytes": overlap, "outOfRangeSpans": out_of_range, "discontinuities": discontinuities, "rawMismatchCount": raw_mismatches, "reconstructedBytes": len(rebuilt), "reconstructedSha256": sha256_bytes(rebuilt), "exactReconstruction": exact})
    return {"executableMembers": len(partitions), "partitions": partitions, "uncoveredBytes": sum(item["uncoveredBytes"] for item in partitions), "overlappingBytes": sum(item["overlappingBytes"] for item in partitions), "rawMismatchCount": sum(item["rawMismatchCount"] for item in partitions), "exactReconstructions": sum(1 for item in partitions if item["exactReconstruction"]), "graphNodes": len(registry["graph"]["nodes"]), "graphEdges": len(registry["graph"]["edges"]), "entrypoints": len(registry["graph"]["entrypoints"])}


def dumps(document: dict) -> str:
    return json.dumps(document, indent=2, ensure_ascii=False) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--catalog-ref")
    parser.add_argument("--insertion-fixture", action="store_true")
    args = parser.parse_args()
    files = read_archive(Path(args.archive))
    if args.insertion_fixture:
        key = PREFIX + "FULL_TEXT/03_A2_A4_WORLD_PUZZLE_CANON_FULL.md"
        text = files[key].decode()
        files[key] = text.replace("# A2.2 — Optional Arthur reminder", "UNRELATED NONEXECUTABLE NOTE\n\n# A2.2 — Optional Arthur reminder", 1).encode()
    registry = build(files, Path(args.repo), args.catalog_ref)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    ledger_doc = {"schemaVersion": "s12-p3-r3-source-ledger.v1", "entries": registry["sourceLedger"], "coverage": coverage(registry)}
    registry_text = dumps(registry)
    mapping_text = dumps(performance_map(registry))
    ledger_text = dumps(ledger_doc)
    provenance = {"schemaVersion": "s12-p3-r3-provenance.v1", "activation": ACTIVATION, "archiveSha256": ARCHIVE_SHA, "a1Sha256": A1_SHA, "hotspotRegisterSha256": HOTSPOT_SHA, "inventoryRegisterSha256": INVENTORY_SHA, "manifestBlob": registry["catalog"]["manifestBlob"], "manifestSha256": registry["catalog"]["manifestSha256"], "selectionBlob": registry["catalog"]["selectionBlob"], "selectionSha256": registry["catalog"]["selectionSha256"], "registrySha256": sha256_bytes(registry_text.encode()), "performanceMapSha256": sha256_bytes(mapping_text.encode()), "sourceLedgerSha256": sha256_bytes(ledger_text.encode()), "rawMismatchCount": ledger_doc["coverage"]["rawMismatchCount"], "exactReconstructions": ledger_doc["coverage"]["exactReconstructions"], "graphNodes": len(registry["graph"]["nodes"]), "graphEdges": len(registry["graph"]["edges"]), "stateMachineAuthoredOccurrences": registry["graph"]["stateMachine"]["authoredOccurrences"], "stateMachineUniqueEdges": registry["graph"]["stateMachine"]["uniqueEdges"], "insertionFixture": args.insertion_fixture}
    (out / "r55-registry.json").write_text(registry_text, encoding="utf-8", newline="\n")
    (out / "r55-performance-map.json").write_text(mapping_text, encoding="utf-8", newline="\n")
    (out / "r55-source-ledger.json").write_text(ledger_text, encoding="utf-8", newline="\n")
    (out / "r55-provenance.json").write_text(dumps(provenance), encoding="utf-8", newline="\n")
    print(f"nodes={provenance['graphNodes']} edges={provenance['graphEdges']} uncovered={ledger_doc['coverage']['uncoveredBytes']}")


if __name__ == "__main__":
    main()
