# From a directed question to a playable record

## 1. Decide what would be useful to establish

Each research request begins with a purpose: inspect a subject’s activity, follow transfers in a direction, test a value band, compare a relationship, reconcile a known transaction, or check the scope of an apparent absence. Endpoint choice follows that question.

## 2. Make a bounded request

The archived collection uses token-transfer, address-transaction, and address-counterparty endpoint families. Subject, historical window, token, direction, and pagination are constrained according to the question. This documentation lists the retained question and fingerprints; the final execution appendix must use the original saved request body for exact wire parameters, not reconstruct them from returned fields.

## 3. Retain the response before interpreting it

The acquisition design saves original response bytes in two matching private locations before normalization. Request and response hashes provide durable references. Those original bytes are not copied wholesale into the game or this public library; only permitted, relevant fields are projected.

## 4. Normalize without rewriting the event

Different endpoint schemas are translated into consistent concepts. Amount strings keep their precision. An absent value remains absent rather than becoming zero. Sender and receiver retain direction. A timestamp’s classification is preserved rather than upgraded because a more precise story would be convenient.

For transfer views, the important fields include the token contract, amount, sender, receiver, transaction reference, and recorded event time. An address summary or counterparty aggregate is a different kind of record; it should not be forced to impersonate a transfer row.

## 5. Link views only on defensible identities

Token identity uses its network and contract, not just its ticker. A shared transaction hash can connect related views, but it does not mean every row describes the same transfer: a transaction may contain multiple events. Event-level identity, when available, and matching direction, token, and fields matter.

Likewise, two endpoint views can support an investigation without being independent proof. The compiler preserves that distinction. It never sums overlapping views into an invented extra payment or copies the exact-proof status of a different record.

## 6. Present the result around the inquiry

The game shows a concise summary, the impact of the search conditions, and an explanation of what a selected record supports. Detail remains accessible. The presentation may reorganize information; it may not change historical amounts, chronology, identity, or the conclusion.

The [worked transfer example](assembly.md#see-the-same-record-at-each-level) pairs the summary, source origin and retained fields for one selected record. The [connection analysis](../spoilers/euler-connection.md) follows the multi-view case result, with spoilers.

## 7. Make the final claim smaller than the story

The adventure supplies characters, jokes, and a reason to investigate. Those fictional elements do not establish historical facts. The case concludes only what its checked transactions establish; it does not infer wallet owners or motives.

[Single-request example](assembly.md) · [Multiple-view connection example — spoilers](../spoilers/euler-connection.md) · [Evidence limits](evidence-limits.md)
