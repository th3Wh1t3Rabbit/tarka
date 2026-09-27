# The endpoint families

| Family | Research use | What becomes readable in Tarka |
|---|---|---|
| `POST /api/v1/tgm/transfers` | Ask about a token’s transfers, direction, amount, and historical coverage | Token movements with exact fields and useful comparisons |
| `POST /api/v1/profiler/address/transactions` | Inspect activity involving a specified address | Subject-centred context and transaction participation |
| `POST /api/v1/profiler/address/counterparties` | Examine bounded interaction relationships | Address-pair summaries, not inferred human identities |

These are the three families documented in the 101-entry Euler request catalog. The endpoint names do not imply that every current API capability was called. Original request parameters, returned optional values, and source membership govern what each record can say.

The public presentation excludes account details, credentials, private headers, incidental entity labels, and unrestricted raw-response dumps. It retains the facts relevant to the investigation and their source fingerprints.

The optional BRCG chapter explains the Token God Mode market-context feature set separately. Its exact per-endpoint request mapping is a distinct audit item, not guessed from these three Euler families.

[Request catalog](request-log.md) · [Collection method](method.md) · [BRCG — spoilers](../spoilers/brcg.md)
