#!/usr/bin/env python3
"""Compile the MAIN-accepted public S13 inputs into one static browser payload."""

from __future__ import annotations

import argparse
import hashlib
import json
from decimal import Decimal
from pathlib import Path

EXPECTED = {
    "MAIN_ACCEPTANCE/TRACE_ESCAPE_MAIN_E03_R2_PER_CALL_ACCEPTANCE_REGISTER_v1.0.0_2026-09-21.json": "404b9c96e103b1a989a8dfcddb51361d23a0812780b4dda42f4bd9916bc1be86",
    "MAIN_ACCEPTANCE/e03_acceptance_binding_final.json": "09b2f76066c72a2be34a769a84b220d19888897468e051fe3be9f9103273fa27",
    "PUBLIC/brcg_required_launch_integration_final.json": "c09bdd40eabe621bc58595f4f0f30378bd1374dff8b04c9dc1bf7666673a8319",
    "PUBLIC/call_atlas_final_accepted.json": "e4884c9f4d850618a8eade95a4cf81c5f7b7fc030f91373f9ad94878d4cfaa25",
    "PUBLIC/case_corpus_final_accepted.json": "d77b12603d30c45e47fdd1fafaf052eb4dd165f68b4de61556478c0f5caf25f7",
    "PUBLIC/corpus_metrics_final_accepted.json": "c14a7fcb6eb625de5b81a746ef210bc69699c2f7b2117dd7e34c5d62cd40a581",
    "PUBLIC/evidence_delta_sequence_final_accepted.json": "8589cf9922902896b24154ddb30adc23475151cded250d6bdb0073c7aaa82adf",
    "PUBLIC/gameplay_integration_contract_final_accepted.json": "23f5fe9856a58d4481a1827052539a508278d8d0f1d20df0221a3a6d5f954fd4",
    "PUBLIC/post_case_filter_predicates.json": "caf5c9bd59b5bdcef028604c9b995f71b47262d756d6318b5ed76aa5871959fd",
    "PUBLIC/prebrief_overview_contract_final.json": "518820586791d9b3d219ab6689005a38d57af05ba735c8f74e902233a1502cf7",
    "PUBLIC/public_projection_policy.json": "538fd3eb0d12af40aa5d9f4b56e35e79f3b851ee338659cdb2cd56e3610333b4",
}
PROOF_SLOTS = ["AMOUNT", "RECEIVER", "LINK"]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(root: Path, rel: str):
    path = root / rel
    if not path.is_file() or digest(path) != EXPECTED.get(rel):
        raise SystemExit(f"S13_INPUT_HASH_STOP {rel}")
    return json.loads(path.read_text(encoding="utf-8"))


def evaluate(predicate: dict, record: dict) -> bool:
    op = predicate["op"]
    if op == "true": return True
    if op == "and": return all(evaluate(item, record) for item in predicate["args"])
    if op == "or": return any(evaluate(item, record) for item in predicate["args"])
    if op == "not": return not evaluate(predicate["arg"], record)
    if op == "eq": return record.get(predicate["field"]) == predicate["value"]
    if op == "in": return record.get(predicate["field"]) in predicate["values"]
    if op == "time_between":
        value = record.get(predicate["field"])
        return value is not None and predicate["start"] <= value <= predicate["end"]
    if op == "amount_between":
        value = record.get(predicate["field"])
        return value is not None and Decimal(str(predicate["min"])) <= Decimal(str(value)) <= Decimal(str(predicate["max"]))
    raise SystemExit(f"S13_PREDICATE_STOP {op}")


def compile_runtime(root: Path) -> dict:
    atlas = load(root, "PUBLIC/call_atlas_final_accepted.json")
    corpus = load(root, "PUBLIC/case_corpus_final_accepted.json")
    metrics = load(root, "PUBLIC/corpus_metrics_final_accepted.json")
    delta = load(root, "PUBLIC/evidence_delta_sequence_final_accepted.json")
    predicates = load(root, "PUBLIC/post_case_filter_predicates.json")
    prebrief = load(root, "PUBLIC/prebrief_overview_contract_final.json")
    integration = load(root, "PUBLIC/gameplay_integration_contract_final_accepted.json")
    brcg = load(root, "PUBLIC/brcg_required_launch_integration_final.json")
    projection = load(root, "PUBLIC/public_projection_policy.json")
    register = load(root, "MAIN_ACCEPTANCE/TRACE_ESCAPE_MAIN_E03_R2_PER_CALL_ACCEPTANCE_REGISTER_v1.0.0_2026-09-21.json")
    binding = load(root, "MAIN_ACCEPTANCE/e03_acceptance_binding_final.json")

    receipts = atlas["receipts"]
    records = corpus["records"]
    if len(receipts) != 101 or len({row["publicCallId"] for row in receipts}) != 101: raise SystemExit("S13_RECEIPT_STOP")
    if len(records) != 227 or len({row["recordId"] for row in records}) != 227: raise SystemExit("S13_CORPUS_STOP")
    accepted = {row["publicCallId"]: row for row in register["rows"]}
    e03 = [row for row in receipts if row["sourceCampaign"] == "E03"]
    if len(e03) != 76 or set(accepted) != {row["publicCallId"] for row in e03}: raise SystemExit("S13_ACCEPTANCE_OVERLAY_STOP")
    curated = sum(row["curatedEvidenceAcceptanceStatus"] == "ACCEPTED_BY_CHATGPT_MAIN_LEAD" for row in accepted.values())
    receipt_only = sum(row["curatedEvidenceAcceptanceStatus"] == "NOT_APPLICABLE_CALL_ATLAS_RECEIPT_ONLY" for row in accepted.values())
    if (curated, receipt_only) != (45, 31): raise SystemExit("S13_CLASSIFICATION_STOP")
    receipt_only_ids = {row["publicCallId"] for row in e03 if accepted[row["publicCallId"]]["curatedEvidenceAcceptanceStatus"] == "NOT_APPLICABLE_CALL_ATLAS_RECEIPT_ONLY"}
    if any(record.get("sourcePublicCallId") in receipt_only_ids for record in records): raise SystemExit("S13_RECEIPT_ONLY_CORPUS_STOP")

    current = [record for record in records if evaluate(predicates["playerViewPool"], record)]
    computed = []
    for stage in predicates["stages"]:
        current = [record for record in current if evaluate(stage["predicate"], record)]
        computed.append(len(current))
    if computed != [98, 98, 74, 3, 2, 1] or [row["recordId"] for row in current] != ["HERO.EXACT_CONVERGENCE"]: raise SystemExit("S13_DELTA_STOP")
    exact = next(row for row in records if row["recordId"] == "HERO.EXACT_CONVERGENCE")
    contextual = next(row for row in records if row["recordId"] == delta["exactProofJoin"]["contextualCorroboratingView"])
    if exact.get("fillsProofSlots") != PROOF_SLOTS or exact.get("evidenceGradeCeiling") != "EXACT" or contextual.get("fillsProofSlots", []) or contextual.get("evidenceGradeCeiling") != "CONTEXTUAL": raise SystemExit("S13_PROOF_STOP")
    if any(prebrief[key] is not False for key in ("individualRecordsIncluded", "filterPredicatesIncluded", "exactSlotFieldsIncluded")): raise SystemExit("S13_PREBRIEF_STOP")
    if brcg["e02AdditionalRows"]["includedIn101Base"] is not False or brcg["cannotMutateEulerHero"] is not True: raise SystemExit("S13_BRCG_STOP")

    compiled_receipts = []
    for row in receipts:
        overlay = accepted.get(row["publicCallId"])
        compiled_receipts.append({
            "publicCallId": row["publicCallId"], "sequence": row["sequence"], "sourceCampaign": row["sourceCampaign"],
            "acceptanceStatus": overlay["callReceiptAcceptanceStatus"] if overlay else row["acceptanceStatus"],
            "curatedEvidenceAcceptanceStatus": overlay["curatedEvidenceAcceptanceStatus"] if overlay else "ACCEPTED_HISTORICAL_BASE",
            "endpointFamily": row["endpointFamily"], "boundedQuestion": row["boundedQuestion"], "lens": row["lens"], "purpose": row["purpose"],
            "coverage": row["coverage"], "evidenceGradeCeiling": row["evidenceGradeCeiling"], "namedConsumers": row["namedConsumers"],
            "claimBoundaries": row["claimBoundaries"], "attribution": row["attribution"], "requestBodySha256": row["requestBodySha256"],
            "responseSha256": row["responseSha256"], "normalizedSha256": row["normalizedSha256"], "caseCorpusRecordIds": row.get("caseCorpusRecordIds", []),
        })

    compiled_stages = [{key: stage[key] for key in ("semanticFilterId", "previousCount", "newCount", "includedReason", "sourceClueIds", "evidenceGradeCeiling", "survivingRecordIds", "firstExcludingPredicate", "whatTheStageMayEstablish", "whatItCannotEstablish") if key in stage} for stage in delta["stages"]]
    runtime = {
        "schemaVersion": "1.0.0", "compiler": "TRACE_ESCAPE_S13_STATIC_COMPILER@1.0.0",
        "sourceHashes": EXPECTED, "attribution": "Powered by Nansen API",
        "metrics": {"callAtlasReceipts": 101, "p2r1Receipts": 25, "e03Receipts": 76, "e03Curated": 45, "e03ReceiptOnly": 31, "semanticRecords": 227, "providerRows": 200, "credits": "112", "filterSequence": computed, "r55CountSlots": [98, 3, 2]},
        "prebrief": {key: value for key, value in prebrief.items() if key != "reservedStoryHook"},
        "caseFileGate": {"clueIds": integration["acceptedCaseFileClueIds"], "lockedUntil": predicates["lockedUntil"]},
        "callAtlas": compiled_receipts, "caseCorpus": records, "predicates": predicates,
        "evidenceDelta": {"sequence": delta["sequence"], "stages": compiled_stages, "exactProofJoin": delta["exactProofJoin"]},
        "proof": {"onlyExactHeroMayFill": PROOF_SLOTS, "exactRecord": exact, "contextualCorroboration": contextual, "conclusion": delta["exactProofJoin"]["acceptedConclusion"], "doesNotProve": delta["exactProofJoin"]["doesNotProve"]},
        "brcg": {"requiredForLaunch": True, "playerDiscoveryOptional": True, "snapshot": brcg["e01SnapshotImmutable"], "boundedNoMatch": brcg["e03BrcgEulerWindow"], "e02RowsIncluded": False},
        "publicProjection": {"attributionRequired": projection["attributionRequired"], "publicSafeFieldsOnly": True, "privateProviderAndAccountMaterialIncluded": False},
        "acceptance": {"status": "MAIN_ACCEPTED_FOR_S13_INTEGRATION", "bindingSha256": EXPECTED["MAIN_ACCEPTANCE/e03_acceptance_binding_final.json"], "acceptedCallAtlasReceipts": binding["acceptedCallAtlasReceipts"], "semanticRecords": binding["semanticRecords"]},
        "productionBoundary": {"runtimeProviderCalls": 0, "r55DialogueActive": False, "endingActive": False, "mission02Active": False},
    }
    encoded = json.dumps(runtime, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    lowered = encoded.lower()
    forbidden = ["todo.story", "providerrequestid", "provider_request_id", "rawbody", "raw_body", "remainingcredits", "accountfield", "credential", "from_address_label", "to_address_label", "counterparty_address_label", "e02_brcg_token_screener", "e02_brcg_who_sold", "e02_brcg_transfers"]
    found = [token for token in forbidden if token in lowered]
    if found: raise SystemExit("S13_PUBLIC_PROJECTION_STOP " + ",".join(found))
    return runtime


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    runtime = compile_runtime(args.input_root.resolve())
    data = (json.dumps(runtime, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(data)
    args.output.with_suffix(args.output.suffix + ".sha256").write_text(f"{hashlib.sha256(data).hexdigest()}  {args.output.name}\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "output": str(args.output), "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "receipts": 101, "records": 227, "sequence": [98, 98, 74, 3, 2, 1]}, sort_keys=True))


if __name__ == "__main__":
    main()
