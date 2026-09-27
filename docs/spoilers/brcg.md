# The piggy bank and a nine-digit fortune

> **Spoiler warning:** this page reveals the optional piggy-bank discovery and its payoff. It is not needed to solve the Euler case. [Return to the player guide](../controls.md).

## The joke opens another kind of question

Rook’s attempt at a modest piggy-bank repair is less modest in practice. Breaking it exposes a note. Reading it reveals **BRCG — Bitcoin Roller Coaster Guy**, with an impressive-looking quantity: **888,888,888**.

Nine digits feel rich. That is the setup, not the conclusion.

Arthur redirects the excitement toward questions a token balance cannot answer alone: what is one token worth, how much liquidity exists, who is buying or selling, and whether meaningful value is flowing in or out. The player is introduced to Nansen’s token-centred analysis through a conversation and an optional discovery rather than a technical tutorial.

## The frozen market context

The side investigation uses a separate snapshot recorded at **19 September 2026, 22:55:18 UTC**, not the Euler incident window.

| Retained snapshot field | Value |
|---|---:|
| Token | Bitcoin Roller Coaster Guy (BRCG) |
| Contract | `0xd4c4407f3afb48d7d4ad954572f155f9237ae335` |
| Quoted unit price | $0.00000000798334585596466 |
| Quantity written on the fictional note | 888,888,888 BRCG |
| Quantity × quoted price | $7.09630742042783479469808, approximately **$7.10** |
| Reported liquidity | $5,166.34 |
| Reported seven-day buyers / sellers | 0 / 22 |
| Reported seven-day volume | $13.16 |
| Reported netflow | $13.16 out |

These are historical snapshot values, not a current market quote or a recommendation to trade. The paper’s quantity is part of the fiction. It is not evidence that the balance exists, belongs to Rook, or can be sold at the quoted price.

## What Token God Mode adds to the joke

Token identity and price turn the large token count into a nominal quotation. Liquidity and buyer/seller activity add market context. Volume and flow prevent that quotation from being mistaken for guaranteed proceeds.

The point is not merely that a small quoted value is funny. It is that **quantity, price, liquidity, ownership, and realizability are different claims**. A useful token analysis asks which one it is actually trying to establish.

The branch also shows why a market-context view and an exact historical transfer view need different summaries. A single generic disclaimer would hide the lesson; a huge raw response would bury the joke.

## What the retained request audit actually proves

The accessible retained audit binds three later BRCG calls individually. They are separate from the 101-entry Euler catalog and from the earlier frozen story snapshot.

| Logical request | Endpoint | Window / selector | Result count | Receipt evidence |
|---|---|---|---:|---|
| `E02_BRCG_TOKEN_SCREENER_EXACT_ADDRESS` | `/api/v1/token-screener` | exact public contract, `7d`, evaluated at `2026-09-21T09:13:34Z` | 1 | body `d7010ac8…b280`; terminal `fd476168…075c` |
| `E02_BRCG_WHO_SOLD_7D` | `/api/v1/tgm/who-bought-sold` | 2026-09-14 through 2026-09-21 inclusive UTC days | 1 | body `93bd5fd5…423b`; terminal `6dfafc0f…6943` |
| `E02_BRCG_TRANSFERS_7D` | `/api/v1/tgm/transfers` | 2026-09-14 through 2026-09-21 inclusive UTC days | 5 | body `ff3d5515…ee24`; terminal `17e2c19a…3da6` |

Each row records a hashed provider request ID, byte-equal primary/mirror raw hashes, a normalized hash, one credit used, and an issue/completion timestamp. Raw provider IDs and raw payloads are not published. A fourth, separate Euler-window control at `/api/v1/profiler/address/transactions` returned zero rows and is classified only as **no match in the accepted corpus**, not global absence.

These four rows do not reconstruct the complete separately reported 13-request BRCG collection. The retained earlier frozen snapshot establishes the story values and timestamp, but its nine remaining per-call endpoint/body/receipt rows are not present in the admitted evidence slice. Metric names are therefore not reverse-engineered into fictional calls, and no 13-call total is added to the Euler inventory.

The nine remaining per-call execution rows were not retained in the admitted
public-safe evidence slice. They are not reconstructed, and no combined
13-request total is published. The exact retained snapshot values and the three
individually bound support calls above are the complete public claim.

## Optional, but part of the same teaching approach

The main quest teaches how to follow transactions. This detour teaches how to question a token balance. Both introduce Nansen’s usefulness through Rook’s assumptions and Arthur’s corrections, leaving room for newcomers to learn and experienced crypto players to recognise the joke.

The Euler report does not depend on completing this branch. Its contemporary market snapshot cannot change the historical case’s answer.

[Evidence limits](../data/evidence-limits.md) · [How the story teaches](../design/questions-first.md)
