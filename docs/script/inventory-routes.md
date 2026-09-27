# Inventory interactions and item combinations

> **Full story and puzzle spoilers.** Every inventory verb route and every ordered USE pairing is listed. The documentation search excludes Script Explorer pages unless **Include evidence / spoilers** is enabled.

[Script Explorer](index.md) · [Reading guide](how-to-read.md) · [Story](story.md) · [World routes](world-routes.md) · [Inventory](inventory-routes.md) · [Arthur dialogue](dialogue-routes.md) · [Actions & endings](actions-and-endings.md) · [Coverage](coverage.md)


The shipped inventory defines **15 item IDs** and **345 inventory routes**, including state/repeat fallbacks represented by the effective runtime owner.

<a id="inventory-blank-terminal-authorization-form"></a>
## undefined

Runtime ID: `blank-terminal-authorization-form`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-blank-terminal-authorization-form"></a>`inventory.GIVE.blank-terminal-authorization-form` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-blank-terminal-authorization-form"></a>`inventory.PICK_UP.blank-terminal-authorization-form` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form"></a>`inventory.USE.blank-terminal-authorization-form` | `inventorySpeechForState` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-open-blank-terminal-authorization-form"></a>`inventory.OPEN.blank-terminal-authorization-form` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-blank-terminal-authorization-form"></a>`inventory.LOOK_AT.blank-terminal-authorization-form` | `inventorySpeechForState` | ROOK: Seems relatively boilerplate.<br>ROOK: Name. Role. Reason for access. Signature.<br>ROOK: Very official. These guys don’t mess around. | rook:BODY:UNRESOLVED |
| <a id="route-inventory-push-blank-terminal-authorization-form"></a>`inventory.PUSH.blank-terminal-authorization-form` | `inventorySpeechForState` | ROOK: If I could, I’d turn this into an origami swan...<br>ROOK: but I still need it for the case. | — |
| <a id="route-inventory-close-blank-terminal-authorization-form"></a>`inventory.CLOSE.blank-terminal-authorization-form` | `inventorySpeechForState` | ROOK: There’s nothing to close. | — |
| <a id="route-inventory-talk-to-blank-terminal-authorization-form"></a>`inventory.TALK_TO.blank-terminal-authorization-form` | `inventorySpeechForState` | ROOK: I should be focusing on the case... instead of making small talk with inanimate objects. | — |
| <a id="route-inventory-pull-blank-terminal-authorization-form"></a>`inventory.PULL.blank-terminal-authorization-form` | `inventorySpeechForState` | ROOK: If I could, I’d turn this into an origami swan...<br>ROOK: but I still need it for the case. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-loose-feather-pen"></a>`inventory.USE.blank-terminal-authorization-form.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.blank-terminal-authorization-form.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-broken-feather-pen"></a>`inventory.USE.blank-terminal-authorization-form.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.blank-terminal-authorization-form.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-euler-case-file"></a>`inventory.USE.blank-terminal-authorization-form.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-rubber-band"></a>`inventory.USE.blank-terminal-authorization-form.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-rubiks-cube"></a>`inventory.USE.blank-terminal-authorization-form.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-sharknado-2-vhs"></a>`inventory.USE.blank-terminal-authorization-form.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-piggy-bank-intact"></a>`inventory.USE.blank-terminal-authorization-form.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-small-toolbox-closed"></a>`inventory.USE.blank-terminal-authorization-form.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-small-toolbox-open-empty"></a>`inventory.USE.blank-terminal-authorization-form.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-hammer"></a>`inventory.USE.blank-terminal-authorization-form.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-nails"></a>`inventory.USE.blank-terminal-authorization-form.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-fictional-token-note"></a>`inventory.USE.blank-terminal-authorization-form.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-loose-feather-pen-with-blank-terminal-authorization-form"></a>`inventory.USE.loose-feather-pen.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-blank-terminal-authorization-form"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-broken-feather-pen-with-blank-terminal-authorization-form"></a>`inventory.USE.broken-feather-pen.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-blank-terminal-authorization-form"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-euler-case-file-with-blank-terminal-authorization-form"></a>`inventory.USE.euler-case-file.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubber-band-with-blank-terminal-authorization-form"></a>`inventory.USE.rubber-band.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubiks-cube-with-blank-terminal-authorization-form"></a>`inventory.USE.rubiks-cube.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-blank-terminal-authorization-form"></a>`inventory.USE.sharknado-2-vhs.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-blank-terminal-authorization-form"></a>`inventory.USE.piggy-bank-intact.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-blank-terminal-authorization-form"></a>`inventory.USE.small-toolbox-closed.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-blank-terminal-authorization-form"></a>`inventory.USE.small-toolbox-open-empty.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-hammer-with-blank-terminal-authorization-form"></a>`inventory.USE.hammer.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-nails-with-blank-terminal-authorization-form"></a>`inventory.USE.nails.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-fictional-token-note-with-blank-terminal-authorization-form"></a>`inventory.USE.fictional-token-note.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |

<a id="inventory-loose-feather-pen"></a>
## undefined

Runtime ID: `loose-feather-pen`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-loose-feather-pen"></a>`inventory.GIVE.loose-feather-pen` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-loose-feather-pen"></a>`inventory.PICK_UP.loose-feather-pen` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-loose-feather-pen"></a>`inventory.USE.loose-feather-pen` | `inventorySpeechForState` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-open-loose-feather-pen"></a>`inventory.OPEN.loose-feather-pen` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-loose-feather-pen"></a>`inventory.LOOK_AT.loose-feather-pen` | `inventorySpeechForState` | ROOK: Fancy feather. Sharp, inked-up, little nib. | — |
| <a id="route-inventory-push-loose-feather-pen"></a>`inventory.PUSH.loose-feather-pen` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-loose-feather-pen"></a>`inventory.CLOSE.loose-feather-pen` | `inventorySpeechForState` | ROOK: There’s nothing to close. | — |
| <a id="route-inventory-talk-to-loose-feather-pen"></a>`inventory.TALK_TO.loose-feather-pen` | `inventorySpeechForState` | ROOK: I should be focusing on the case... instead of making small talk with inanimate objects. | — |
| <a id="route-inventory-pull-loose-feather-pen"></a>`inventory.PULL.loose-feather-pen` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-loose-feather-pen"></a>`inventory.USE.blank-terminal-authorization-form.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-loose-feather-pen-with-blank-terminal-authorization-form"></a>`inventory.USE.loose-feather-pen.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-loose-feather-pen-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.loose-feather-pen.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-loose-feather-pen-with-broken-feather-pen"></a>`inventory.USE.loose-feather-pen.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-loose-feather-pen-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.loose-feather-pen.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-loose-feather-pen-with-euler-case-file"></a>`inventory.USE.loose-feather-pen.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-loose-feather-pen-with-rubber-band"></a>`inventory.USE.loose-feather-pen.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-loose-feather-pen-with-rubiks-cube"></a>`inventory.USE.loose-feather-pen.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-loose-feather-pen-with-sharknado-2-vhs"></a>`inventory.USE.loose-feather-pen.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-loose-feather-pen-with-piggy-bank-intact"></a>`inventory.USE.loose-feather-pen.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-loose-feather-pen-with-small-toolbox-closed"></a>`inventory.USE.loose-feather-pen.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-loose-feather-pen-with-small-toolbox-open-empty"></a>`inventory.USE.loose-feather-pen.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-loose-feather-pen-with-hammer"></a>`inventory.USE.loose-feather-pen.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-loose-feather-pen-with-nails"></a>`inventory.USE.loose-feather-pen.with.nails` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-loose-feather-pen-with-fictional-token-note"></a>`inventory.USE.loose-feather-pen.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-loose-feather-pen"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-broken-feather-pen-with-loose-feather-pen"></a>`inventory.USE.broken-feather-pen.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-loose-feather-pen"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-euler-case-file-with-loose-feather-pen"></a>`inventory.USE.euler-case-file.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubber-band-with-loose-feather-pen"></a>`inventory.USE.rubber-band.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubiks-cube-with-loose-feather-pen"></a>`inventory.USE.rubiks-cube.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-loose-feather-pen"></a>`inventory.USE.sharknado-2-vhs.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-loose-feather-pen"></a>`inventory.USE.piggy-bank-intact.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-loose-feather-pen"></a>`inventory.USE.small-toolbox-closed.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-loose-feather-pen"></a>`inventory.USE.small-toolbox-open-empty.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-hammer-with-loose-feather-pen"></a>`inventory.USE.hammer.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-nails-with-loose-feather-pen"></a>`inventory.USE.nails.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-fictional-token-note-with-loose-feather-pen"></a>`inventory.USE.fictional-token-note.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |

<a id="inventory-signed-terminal-authorization-form-with-doodles"></a>
## undefined

Runtime ID: `signed-terminal-authorization-form-with-doodles`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-signed-terminal-authorization-form-with-doodles"></a>`inventory.GIVE.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-signed-terminal-authorization-form-with-doodles"></a>`inventory.PICK_UP.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-open-signed-terminal-authorization-form-with-doodles"></a>`inventory.OPEN.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-signed-terminal-authorization-form-with-doodles"></a>`inventory.LOOK_AT.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState` | ROOK: Signed and ready for Mr. A. | — |
| <a id="route-inventory-push-signed-terminal-authorization-form-with-doodles"></a>`inventory.PUSH.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-signed-terminal-authorization-form-with-doodles"></a>`inventory.CLOSE.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState` | ROOK: There’s nothing to close. | — |
| <a id="route-inventory-talk-to-signed-terminal-authorization-form-with-doodles"></a>`inventory.TALK_TO.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState` | ROOK: We’re not on speaking terms. | — |
| <a id="route-inventory-pull-signed-terminal-authorization-form-with-doodles"></a>`inventory.PULL.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.blank-terminal-authorization-form.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-loose-feather-pen-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.loose-feather-pen.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-blank-terminal-authorization-form"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-loose-feather-pen"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-broken-feather-pen"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-euler-case-file"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-rubber-band"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-rubiks-cube"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-sharknado-2-vhs"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-piggy-bank-intact"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-small-toolbox-closed"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-small-toolbox-open-empty"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-hammer"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-nails"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.nails` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-fictional-token-note"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-broken-feather-pen-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.broken-feather-pen.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-euler-case-file-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.euler-case-file.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-rubber-band-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.rubber-band.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubiks-cube-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.rubiks-cube.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.sharknado-2-vhs.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.piggy-bank-intact.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.small-toolbox-closed.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.small-toolbox-open-empty.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-hammer-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.hammer.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-nails-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.nails.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-fictional-token-note-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.fictional-token-note.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |

<a id="inventory-broken-feather-pen"></a>
## undefined

Runtime ID: `broken-feather-pen`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-broken-feather-pen"></a>`inventory.GIVE.broken-feather-pen` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-broken-feather-pen"></a>`inventory.PICK_UP.broken-feather-pen` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-broken-feather-pen"></a>`inventory.USE.broken-feather-pen` | `inventorySpeechForState` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-open-broken-feather-pen"></a>`inventory.OPEN.broken-feather-pen` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-broken-feather-pen"></a>`inventory.LOOK_AT.broken-feather-pen` | `inventorySpeechForState` | ROOK: The nib is cracked. The feather is bent.<br>ROOK: It gave everything it had to corporate authorization. | — |
| <a id="route-inventory-push-broken-feather-pen"></a>`inventory.PUSH.broken-feather-pen` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-broken-feather-pen"></a>`inventory.CLOSE.broken-feather-pen` | `inventorySpeechForState` | ROOK: There’s nothing to close. | — |
| <a id="route-inventory-talk-to-broken-feather-pen"></a>`inventory.TALK_TO.broken-feather-pen` | `inventorySpeechForState` | ROOK: I have a feeling it doesn’t want to hear what I have to say. | — |
| <a id="route-inventory-pull-broken-feather-pen"></a>`inventory.PULL.broken-feather-pen` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-broken-feather-pen"></a>`inventory.USE.blank-terminal-authorization-form.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-loose-feather-pen-with-broken-feather-pen"></a>`inventory.USE.loose-feather-pen.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-broken-feather-pen"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-broken-feather-pen-with-blank-terminal-authorization-form"></a>`inventory.USE.broken-feather-pen.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-broken-feather-pen-with-loose-feather-pen"></a>`inventory.USE.broken-feather-pen.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-broken-feather-pen-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.broken-feather-pen.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-broken-feather-pen-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.broken-feather-pen.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-broken-feather-pen-with-euler-case-file"></a>`inventory.USE.broken-feather-pen.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-broken-feather-pen-with-rubber-band"></a>`inventory.USE.broken-feather-pen.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-broken-feather-pen-with-rubiks-cube"></a>`inventory.USE.broken-feather-pen.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-broken-feather-pen-with-sharknado-2-vhs"></a>`inventory.USE.broken-feather-pen.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-broken-feather-pen-with-piggy-bank-intact"></a>`inventory.USE.broken-feather-pen.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-broken-feather-pen-with-small-toolbox-closed"></a>`inventory.USE.broken-feather-pen.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-broken-feather-pen-with-small-toolbox-open-empty"></a>`inventory.USE.broken-feather-pen.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-broken-feather-pen-with-hammer"></a>`inventory.USE.broken-feather-pen.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-broken-feather-pen-with-nails"></a>`inventory.USE.broken-feather-pen.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-broken-feather-pen-with-fictional-token-note"></a>`inventory.USE.broken-feather-pen.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-broken-feather-pen"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-euler-case-file-with-broken-feather-pen"></a>`inventory.USE.euler-case-file.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubber-band-with-broken-feather-pen"></a>`inventory.USE.rubber-band.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubiks-cube-with-broken-feather-pen"></a>`inventory.USE.rubiks-cube.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-broken-feather-pen"></a>`inventory.USE.sharknado-2-vhs.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-broken-feather-pen"></a>`inventory.USE.piggy-bank-intact.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-broken-feather-pen"></a>`inventory.USE.small-toolbox-closed.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-broken-feather-pen"></a>`inventory.USE.small-toolbox-open-empty.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-hammer-with-broken-feather-pen"></a>`inventory.USE.hammer.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-nails-with-broken-feather-pen"></a>`inventory.USE.nails.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-fictional-token-note-with-broken-feather-pen"></a>`inventory.USE.fictional-token-note.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |

<a id="inventory-approved-stamped-terminal-authorization-form"></a>
## undefined

Runtime ID: `approved-stamped-terminal-authorization-form`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-approved-stamped-terminal-authorization-form"></a>`inventory.GIVE.approved-stamped-terminal-authorization-form` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-approved-stamped-terminal-authorization-form"></a>`inventory.PICK_UP.approved-stamped-terminal-authorization-form` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form"></a>`inventory.USE.approved-stamped-terminal-authorization-form` | `inventorySpeechForState` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-open-approved-stamped-terminal-authorization-form"></a>`inventory.OPEN.approved-stamped-terminal-authorization-form` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-approved-stamped-terminal-authorization-form"></a>`inventory.LOOK_AT.approved-stamped-terminal-authorization-form` | `inventorySpeechForState` | ROOK: Approved. Stamped. Fully authorized.<br>ROOK: And apparently, the dinosaurs were acceptable for the signature field. | — |
| <a id="route-inventory-push-approved-stamped-terminal-authorization-form"></a>`inventory.PUSH.approved-stamped-terminal-authorization-form` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-approved-stamped-terminal-authorization-form"></a>`inventory.CLOSE.approved-stamped-terminal-authorization-form` | `inventorySpeechForState` | ROOK: There’s nothing to close. | — |
| <a id="route-inventory-talk-to-approved-stamped-terminal-authorization-form"></a>`inventory.TALK_TO.approved-stamped-terminal-authorization-form` | `inventorySpeechForState` | ROOK: I should be focusing on the case... instead of making small talk with inanimate objects. | — |
| <a id="route-inventory-pull-approved-stamped-terminal-authorization-form"></a>`inventory.PULL.approved-stamped-terminal-authorization-form` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.blank-terminal-authorization-form.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-loose-feather-pen-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.loose-feather-pen.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-broken-feather-pen-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.broken-feather-pen.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-blank-terminal-authorization-form"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-loose-feather-pen"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-broken-feather-pen"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-euler-case-file"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-rubber-band"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-rubiks-cube"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-sharknado-2-vhs"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-piggy-bank-intact"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-small-toolbox-closed"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-small-toolbox-open-empty"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-hammer"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-nails"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.nails` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-fictional-token-note"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-euler-case-file-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.euler-case-file.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubber-band-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.rubber-band.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubiks-cube-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.rubiks-cube.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.sharknado-2-vhs.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.piggy-bank-intact.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.small-toolbox-closed.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.small-toolbox-open-empty.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-hammer-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.hammer.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-nails-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.nails.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-fictional-token-note-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.fictional-token-note.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |

<a id="inventory-euler-case-file"></a>
## undefined

Runtime ID: `euler-case-file`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-euler-case-file"></a>`inventory.GIVE.euler-case-file` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-euler-case-file"></a>`inventory.PICK_UP.euler-case-file` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-euler-case-file"></a>`inventory.USE.euler-case-file` | `inventorySpeechForState` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-open-euler-case-file"></a>`inventory.OPEN.euler-case-file` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-euler-case-file"></a>`inventory.LOOK_AT.euler-case-file` | `inventorySpeechForState` | ROOK: Euler Finance. March 13, 2023.<br>ROOK: DAI. A stablecoin built to stay close to the dollar.<br>ROOK: The first DAI entry records just over 8,877,507 DAI...<br>ROOK: about $8.8 million at the time.<br>ROOK: The wider exploit reached roughly $197 million across several assets.<br>ROOK: Now I have:<br>ROOK: the exact token, the amount, and the contract address.<br>ROOK: Time to trace the transactions. | — |
| <a id="route-inventory-push-euler-case-file"></a>`inventory.PUSH.euler-case-file` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-euler-case-file"></a>`inventory.CLOSE.euler-case-file` | `inventorySpeechForState` | ROOK: There’s nothing to close. | — |
| <a id="route-inventory-talk-to-euler-case-file"></a>`inventory.TALK_TO.euler-case-file` | `inventorySpeechForState` | ROOK: I think this conversation would be a little one-sided. | — |
| <a id="route-inventory-pull-euler-case-file"></a>`inventory.PULL.euler-case-file` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-euler-case-file"></a>`inventory.USE.blank-terminal-authorization-form.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-loose-feather-pen-with-euler-case-file"></a>`inventory.USE.loose-feather-pen.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-euler-case-file"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-broken-feather-pen-with-euler-case-file"></a>`inventory.USE.broken-feather-pen.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-euler-case-file"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-euler-case-file-with-blank-terminal-authorization-form"></a>`inventory.USE.euler-case-file.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-euler-case-file-with-loose-feather-pen"></a>`inventory.USE.euler-case-file.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-euler-case-file-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.euler-case-file.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-euler-case-file-with-broken-feather-pen"></a>`inventory.USE.euler-case-file.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-euler-case-file-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.euler-case-file.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-euler-case-file-with-rubber-band"></a>`inventory.USE.euler-case-file.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-euler-case-file-with-rubiks-cube"></a>`inventory.USE.euler-case-file.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-euler-case-file-with-sharknado-2-vhs"></a>`inventory.USE.euler-case-file.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-euler-case-file-with-piggy-bank-intact"></a>`inventory.USE.euler-case-file.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-euler-case-file-with-small-toolbox-closed"></a>`inventory.USE.euler-case-file.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-euler-case-file-with-small-toolbox-open-empty"></a>`inventory.USE.euler-case-file.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-euler-case-file-with-hammer"></a>`inventory.USE.euler-case-file.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-euler-case-file-with-nails"></a>`inventory.USE.euler-case-file.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-euler-case-file-with-fictional-token-note"></a>`inventory.USE.euler-case-file.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-rubber-band-with-euler-case-file"></a>`inventory.USE.rubber-band.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-rubiks-cube-with-euler-case-file"></a>`inventory.USE.rubiks-cube.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-euler-case-file"></a>`inventory.USE.sharknado-2-vhs.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-euler-case-file"></a>`inventory.USE.piggy-bank-intact.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-euler-case-file"></a>`inventory.USE.small-toolbox-closed.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-euler-case-file"></a>`inventory.USE.small-toolbox-open-empty.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-hammer-with-euler-case-file"></a>`inventory.USE.hammer.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-nails-with-euler-case-file"></a>`inventory.USE.nails.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-fictional-token-note-with-euler-case-file"></a>`inventory.USE.fictional-token-note.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |

<a id="inventory-rubber-band"></a>
## undefined

Runtime ID: `rubber-band`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-rubber-band"></a>`inventory.GIVE.rubber-band` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-rubber-band"></a>`inventory.PICK_UP.rubber-band` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-rubber-band"></a>`inventory.USE.rubber-band` | `inventorySpeechForState` | ROOK: I don’t think so. | — |
| <a id="route-inventory-open-rubber-band"></a>`inventory.OPEN.rubber-band` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-rubber-band"></a>`inventory.LOOK_AT.rubber-band` | `inventorySpeechForState` | ROOK: A rubber band. Currently performing its traditional role...<br>ROOK: taking up space until the exact moment someone throws it away...<br>ROOK: and immediately needs one. | — |
| <a id="route-inventory-push-rubber-band"></a>`inventory.PUSH.rubber-band` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-rubber-band"></a>`inventory.CLOSE.rubber-band` | `inventorySpeechForState` | ROOK: There’s nothing to close. | — |
| <a id="route-inventory-talk-to-rubber-band"></a>`inventory.TALK_TO.rubber-band` | `inventorySpeechForState` | ROOK: I should be focusing on the case... instead of making small talk with inanimate objects. | — |
| <a id="route-inventory-pull-rubber-band"></a>`inventory.PULL.rubber-band` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-rubber-band"></a>`inventory.USE.blank-terminal-authorization-form.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-loose-feather-pen-with-rubber-band"></a>`inventory.USE.loose-feather-pen.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-rubber-band"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-broken-feather-pen-with-rubber-band"></a>`inventory.USE.broken-feather-pen.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-rubber-band"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-euler-case-file-with-rubber-band"></a>`inventory.USE.euler-case-file.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-rubber-band-with-blank-terminal-authorization-form"></a>`inventory.USE.rubber-band.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubber-band-with-loose-feather-pen"></a>`inventory.USE.rubber-band.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubber-band-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.rubber-band.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubber-band-with-broken-feather-pen"></a>`inventory.USE.rubber-band.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubber-band-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.rubber-band.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubber-band-with-euler-case-file"></a>`inventory.USE.rubber-band.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-rubber-band-with-rubiks-cube"></a>`inventory.USE.rubber-band.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubber-band-with-sharknado-2-vhs"></a>`inventory.USE.rubber-band.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubber-band-with-piggy-bank-intact"></a>`inventory.USE.rubber-band.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-rubber-band-with-small-toolbox-closed"></a>`inventory.USE.rubber-band.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubber-band-with-small-toolbox-open-empty"></a>`inventory.USE.rubber-band.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubber-band-with-hammer"></a>`inventory.USE.rubber-band.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-rubber-band-with-nails"></a>`inventory.USE.rubber-band.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubber-band-with-fictional-token-note"></a>`inventory.USE.rubber-band.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubiks-cube-with-rubber-band"></a>`inventory.USE.rubiks-cube.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-rubber-band"></a>`inventory.USE.sharknado-2-vhs.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-rubber-band"></a>`inventory.USE.piggy-bank-intact.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-rubber-band"></a>`inventory.USE.small-toolbox-closed.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-rubber-band"></a>`inventory.USE.small-toolbox-open-empty.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-hammer-with-rubber-band"></a>`inventory.USE.hammer.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-nails-with-rubber-band"></a>`inventory.USE.nails.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-fictional-token-note-with-rubber-band"></a>`inventory.USE.fictional-token-note.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |

<a id="inventory-rubiks-cube"></a>
## undefined

Runtime ID: `rubiks-cube`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-rubiks-cube"></a>`inventory.GIVE.rubiks-cube` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-rubiks-cube"></a>`inventory.PICK_UP.rubiks-cube` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-rubiks-cube"></a>`inventory.USE.rubiks-cube` | `inventorySpeechForState` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-open-rubiks-cube"></a>`inventory.OPEN.rubiks-cube` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-rubiks-cube"></a>`inventory.LOOK_AT.rubiks-cube` | `inventorySpeechForState` | ROOK: Still scrambled. I could solve it...<br>ROOK: if I knew how and had several uninterrupted years. | — |
| <a id="route-inventory-push-rubiks-cube"></a>`inventory.PUSH.rubiks-cube` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-rubiks-cube"></a>`inventory.CLOSE.rubiks-cube` | `inventorySpeechForState` | ROOK: There’s nothing to close. | — |
| <a id="route-inventory-talk-to-rubiks-cube"></a>`inventory.TALK_TO.rubiks-cube` | `inventorySpeechForState` | ROOK: We’re not on speaking terms. | — |
| <a id="route-inventory-pull-rubiks-cube"></a>`inventory.PULL.rubiks-cube` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-rubiks-cube"></a>`inventory.USE.blank-terminal-authorization-form.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-loose-feather-pen-with-rubiks-cube"></a>`inventory.USE.loose-feather-pen.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-rubiks-cube"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-broken-feather-pen-with-rubiks-cube"></a>`inventory.USE.broken-feather-pen.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-rubiks-cube"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-euler-case-file-with-rubiks-cube"></a>`inventory.USE.euler-case-file.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubber-band-with-rubiks-cube"></a>`inventory.USE.rubber-band.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubiks-cube-with-blank-terminal-authorization-form"></a>`inventory.USE.rubiks-cube.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-rubiks-cube-with-loose-feather-pen"></a>`inventory.USE.rubiks-cube.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-rubiks-cube-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.rubiks-cube.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-rubiks-cube-with-broken-feather-pen"></a>`inventory.USE.rubiks-cube.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-rubiks-cube-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.rubiks-cube.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-rubiks-cube-with-euler-case-file"></a>`inventory.USE.rubiks-cube.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-rubiks-cube-with-rubber-band"></a>`inventory.USE.rubiks-cube.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-rubiks-cube-with-sharknado-2-vhs"></a>`inventory.USE.rubiks-cube.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubiks-cube-with-piggy-bank-intact"></a>`inventory.USE.rubiks-cube.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-rubiks-cube-with-small-toolbox-closed"></a>`inventory.USE.rubiks-cube.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-rubiks-cube-with-small-toolbox-open-empty"></a>`inventory.USE.rubiks-cube.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubiks-cube-with-hammer"></a>`inventory.USE.rubiks-cube.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-rubiks-cube-with-nails"></a>`inventory.USE.rubiks-cube.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubiks-cube-with-fictional-token-note"></a>`inventory.USE.rubiks-cube.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-rubiks-cube"></a>`inventory.USE.sharknado-2-vhs.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-rubiks-cube"></a>`inventory.USE.piggy-bank-intact.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-rubiks-cube"></a>`inventory.USE.small-toolbox-closed.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-rubiks-cube"></a>`inventory.USE.small-toolbox-open-empty.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-hammer-with-rubiks-cube"></a>`inventory.USE.hammer.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-nails-with-rubiks-cube"></a>`inventory.USE.nails.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-fictional-token-note-with-rubiks-cube"></a>`inventory.USE.fictional-token-note.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |

<a id="inventory-sharknado-2-vhs"></a>
## undefined

Runtime ID: `sharknado-2-vhs`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-sharknado-2-vhs"></a>`inventory.GIVE.sharknado-2-vhs` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-sharknado-2-vhs"></a>`inventory.PICK_UP.sharknado-2-vhs` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-sharknado-2-vhs"></a>`inventory.USE.sharknado-2-vhs` | `inventorySpeechForState` | ROOK: It doesn’t look like that can play VHS tapes...<br>ROOK: which may be the first piece of good news today. | — |
| <a id="route-inventory-open-sharknado-2-vhs"></a>`inventory.OPEN.sharknado-2-vhs` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-sharknado-2-vhs"></a>`inventory.LOOK_AT.sharknado-2-vhs` | `inventorySpeechForState` | ROOK: Sharknado 2. On VHS. I’m surprised the first one got made.<br>ROOK: I’m even more surprised someone green-lit a sequel...<br>ROOK: and then preserved it on obsolete plastic.<br>ROOK: I heard a rumor the leading shark...<br>ROOK: was played by Bruce’s nephew.<br>ROOK: I’m watching this when I get home.<br>ROOK: Right after I find an antique store willing to admit it still sells VCRs. | rook:BODY:UNRESOLVED<br>rook:BODY:UNRESOLVED |
| <a id="route-inventory-push-sharknado-2-vhs"></a>`inventory.PUSH.sharknado-2-vhs` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-sharknado-2-vhs"></a>`inventory.CLOSE.sharknado-2-vhs` | `inventorySpeechForState` | ROOK: There’s nothing to close. | — |
| <a id="route-inventory-talk-to-sharknado-2-vhs"></a>`inventory.TALK_TO.sharknado-2-vhs` | `inventorySpeechForState` | ROOK: We’re not on speaking terms. | — |
| <a id="route-inventory-pull-sharknado-2-vhs"></a>`inventory.PULL.sharknado-2-vhs` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-sharknado-2-vhs"></a>`inventory.USE.blank-terminal-authorization-form.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-loose-feather-pen-with-sharknado-2-vhs"></a>`inventory.USE.loose-feather-pen.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-sharknado-2-vhs"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-broken-feather-pen-with-sharknado-2-vhs"></a>`inventory.USE.broken-feather-pen.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-sharknado-2-vhs"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-euler-case-file-with-sharknado-2-vhs"></a>`inventory.USE.euler-case-file.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-rubber-band-with-sharknado-2-vhs"></a>`inventory.USE.rubber-band.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubiks-cube-with-sharknado-2-vhs"></a>`inventory.USE.rubiks-cube.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-blank-terminal-authorization-form"></a>`inventory.USE.sharknado-2-vhs.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-loose-feather-pen"></a>`inventory.USE.sharknado-2-vhs.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.sharknado-2-vhs.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-broken-feather-pen"></a>`inventory.USE.sharknado-2-vhs.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.sharknado-2-vhs.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-euler-case-file"></a>`inventory.USE.sharknado-2-vhs.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-rubber-band"></a>`inventory.USE.sharknado-2-vhs.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-rubiks-cube"></a>`inventory.USE.sharknado-2-vhs.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-piggy-bank-intact"></a>`inventory.USE.sharknado-2-vhs.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-small-toolbox-closed"></a>`inventory.USE.sharknado-2-vhs.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-small-toolbox-open-empty"></a>`inventory.USE.sharknado-2-vhs.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-hammer"></a>`inventory.USE.sharknado-2-vhs.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-nails"></a>`inventory.USE.sharknado-2-vhs.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-fictional-token-note"></a>`inventory.USE.sharknado-2-vhs.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-sharknado-2-vhs"></a>`inventory.USE.piggy-bank-intact.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-sharknado-2-vhs"></a>`inventory.USE.small-toolbox-closed.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-sharknado-2-vhs"></a>`inventory.USE.small-toolbox-open-empty.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-hammer-with-sharknado-2-vhs"></a>`inventory.USE.hammer.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-nails-with-sharknado-2-vhs"></a>`inventory.USE.nails.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-fictional-token-note-with-sharknado-2-vhs"></a>`inventory.USE.fictional-token-note.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |

<a id="inventory-piggy-bank-intact"></a>
## undefined

Runtime ID: `piggy-bank-intact`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-piggy-bank-intact"></a>`inventory.GIVE.piggy-bank-intact` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-piggy-bank-intact"></a>`inventory.PICK_UP.piggy-bank-intact` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-piggy-bank-intact"></a>`inventory.USE.piggy-bank-intact` | `inventorySpeechForState` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-open-piggy-bank-intact"></a>`inventory.OPEN.piggy-bank-intact` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-piggy-bank-intact"></a>`inventory.LOOK_AT.piggy-bank-intact` | `inventorySpeechForState` | ROOK: No clinking. So there’s no change in there.<br>ROOK: But it isn’t empty.<br>ROOK: Something light is shuffling around in there.<br>ROOK: No rubber plug on the bottom.<br>ROOK: And the slot up top is too narrow to see inside...<br>ROOK: or pull anything back out.<br>ROOK: So this little pig is hiding something...<br>ROOK: or enforcing a very strict no-withdrawals policy. | rook:BODY:STAGE<br>rook:BODY:UNRESOLVED<br>rook:BODY:STAGE<br>rook:BODY:STAGE |
| <a id="route-inventory-push-piggy-bank-intact"></a>`inventory.PUSH.piggy-bank-intact` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-piggy-bank-intact"></a>`inventory.CLOSE.piggy-bank-intact` | `inventorySpeechForState` | ROOK: There’s nothing to close. | — |
| <a id="route-inventory-talk-to-piggy-bank-intact"></a>`inventory.TALK_TO.piggy-bank-intact` | `inventorySpeechForState` | ROOK: Alright, piggy. One financial question.<br>ROOK: Is Bitcoin about to pump... or dump?<br>ROOK: Oink?<br>ROOK: Oink oinkity oink oink?<br>ROOK: Fine. I have Nansen™ access anyways...<br>ROOK: Some help you were, piggy. | rook:BODY:UNRESOLVED \| UNRESOLVED<br>rook:BODY:UNRESOLVED<br>rook:BODY:UNRESOLVED |
| <a id="route-inventory-pull-piggy-bank-intact"></a>`inventory.PULL.piggy-bank-intact` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-piggy-bank-intact"></a>`inventory.USE.blank-terminal-authorization-form.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-loose-feather-pen-with-piggy-bank-intact"></a>`inventory.USE.loose-feather-pen.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-piggy-bank-intact"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-broken-feather-pen-with-piggy-bank-intact"></a>`inventory.USE.broken-feather-pen.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-piggy-bank-intact"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-euler-case-file-with-piggy-bank-intact"></a>`inventory.USE.euler-case-file.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubber-band-with-piggy-bank-intact"></a>`inventory.USE.rubber-band.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-rubiks-cube-with-piggy-bank-intact"></a>`inventory.USE.rubiks-cube.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-piggy-bank-intact"></a>`inventory.USE.sharknado-2-vhs.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-blank-terminal-authorization-form"></a>`inventory.USE.piggy-bank-intact.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-loose-feather-pen"></a>`inventory.USE.piggy-bank-intact.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.piggy-bank-intact.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-broken-feather-pen"></a>`inventory.USE.piggy-bank-intact.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.piggy-bank-intact.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-euler-case-file"></a>`inventory.USE.piggy-bank-intact.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-rubber-band"></a>`inventory.USE.piggy-bank-intact.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-rubiks-cube"></a>`inventory.USE.piggy-bank-intact.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-sharknado-2-vhs"></a>`inventory.USE.piggy-bank-intact.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-small-toolbox-closed"></a>`inventory.USE.piggy-bank-intact.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-small-toolbox-open-empty"></a>`inventory.USE.piggy-bank-intact.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-hammer"></a>`inventory.USE.piggy-bank-intact.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-nails"></a>`inventory.USE.piggy-bank-intact.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-fictional-token-note"></a>`inventory.USE.piggy-bank-intact.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-piggy-bank-intact"></a>`inventory.USE.small-toolbox-closed.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-piggy-bank-intact"></a>`inventory.USE.small-toolbox-open-empty.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-hammer-with-piggy-bank-intact"></a>`inventory.USE.hammer.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-nails-with-piggy-bank-intact"></a>`inventory.USE.nails.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-fictional-token-note-with-piggy-bank-intact"></a>`inventory.USE.fictional-token-note.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |

<a id="inventory-small-toolbox-closed"></a>
## undefined

Runtime ID: `small-toolbox-closed`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-small-toolbox-closed"></a>`inventory.GIVE.small-toolbox-closed` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-small-toolbox-closed"></a>`inventory.PICK_UP.small-toolbox-closed` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-small-toolbox-closed"></a>`inventory.USE.small-toolbox-closed` | `inventorySpeechForState` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-open-small-toolbox-closed"></a>`inventory.OPEN.small-toolbox-closed` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-small-toolbox-closed"></a>`inventory.LOOK_AT.small-toolbox-closed` | `inventorySpeechForState` | ROOK: Do-It-Herself. Small, pink, and radiating competence.<br>ROOK: This toolbox believes I can repair things without supervision.<br>ROOK: That makes one of us.<br>ROOK: Still... I admire its confidence in me. | — |
| <a id="route-inventory-push-small-toolbox-closed"></a>`inventory.PUSH.small-toolbox-closed` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-small-toolbox-closed"></a>`inventory.CLOSE.small-toolbox-closed` | `inventorySpeechForState` | ROOK: There’s nothing to close. | — |
| <a id="route-inventory-talk-to-small-toolbox-closed"></a>`inventory.TALK_TO.small-toolbox-closed` | `inventorySpeechForState` | ROOK: I should be focusing on the case... instead of making small talk with inanimate objects. | — |
| <a id="route-inventory-pull-small-toolbox-closed"></a>`inventory.PULL.small-toolbox-closed` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-small-toolbox-closed"></a>`inventory.USE.blank-terminal-authorization-form.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-loose-feather-pen-with-small-toolbox-closed"></a>`inventory.USE.loose-feather-pen.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-small-toolbox-closed"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-broken-feather-pen-with-small-toolbox-closed"></a>`inventory.USE.broken-feather-pen.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-small-toolbox-closed"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-euler-case-file-with-small-toolbox-closed"></a>`inventory.USE.euler-case-file.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubber-band-with-small-toolbox-closed"></a>`inventory.USE.rubber-band.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubiks-cube-with-small-toolbox-closed"></a>`inventory.USE.rubiks-cube.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-small-toolbox-closed"></a>`inventory.USE.sharknado-2-vhs.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-small-toolbox-closed"></a>`inventory.USE.piggy-bank-intact.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-blank-terminal-authorization-form"></a>`inventory.USE.small-toolbox-closed.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-loose-feather-pen"></a>`inventory.USE.small-toolbox-closed.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.small-toolbox-closed.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-broken-feather-pen"></a>`inventory.USE.small-toolbox-closed.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.small-toolbox-closed.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-euler-case-file"></a>`inventory.USE.small-toolbox-closed.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-rubber-band"></a>`inventory.USE.small-toolbox-closed.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-rubiks-cube"></a>`inventory.USE.small-toolbox-closed.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-sharknado-2-vhs"></a>`inventory.USE.small-toolbox-closed.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-piggy-bank-intact"></a>`inventory.USE.small-toolbox-closed.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-small-toolbox-open-empty"></a>`inventory.USE.small-toolbox-closed.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-hammer"></a>`inventory.USE.small-toolbox-closed.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-nails"></a>`inventory.USE.small-toolbox-closed.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-fictional-token-note"></a>`inventory.USE.small-toolbox-closed.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-small-toolbox-closed"></a>`inventory.USE.small-toolbox-open-empty.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-hammer-with-small-toolbox-closed"></a>`inventory.USE.hammer.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-nails-with-small-toolbox-closed"></a>`inventory.USE.nails.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-fictional-token-note-with-small-toolbox-closed"></a>`inventory.USE.fictional-token-note.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |

<a id="inventory-small-toolbox-open-empty"></a>
## undefined

Runtime ID: `small-toolbox-open-empty`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-small-toolbox-open-empty"></a>`inventory.GIVE.small-toolbox-open-empty` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-small-toolbox-open-empty"></a>`inventory.PICK_UP.small-toolbox-open-empty` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-small-toolbox-open-empty"></a>`inventory.USE.small-toolbox-open-empty` | `inventorySpeechForState` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-open-small-toolbox-open-empty"></a>`inventory.OPEN.small-toolbox-open-empty` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-small-toolbox-open-empty"></a>`inventory.LOOK_AT.small-toolbox-open-empty` | `inventorySpeechForState` | ROOK: Empty now. Still pink. Still empowering.<br>ROOK: And, by default, the most organized toolbox I’ve ever owned. | — |
| <a id="route-inventory-push-small-toolbox-open-empty"></a>`inventory.PUSH.small-toolbox-open-empty` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-small-toolbox-open-empty"></a>`inventory.CLOSE.small-toolbox-open-empty` | `inventorySpeechForState` | ROOK: Closed tight.<br>ROOK: The little pink plastic clips snapped right into place. | rook:BODY:UNRESOLVED |
| <a id="route-inventory-talk-to-small-toolbox-open-empty"></a>`inventory.TALK_TO.small-toolbox-open-empty` | `inventorySpeechForState` | ROOK: I should be focusing on the case... instead of making small talk with inanimate objects. | — |
| <a id="route-inventory-pull-small-toolbox-open-empty"></a>`inventory.PULL.small-toolbox-open-empty` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-small-toolbox-open-empty"></a>`inventory.USE.blank-terminal-authorization-form.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-loose-feather-pen-with-small-toolbox-open-empty"></a>`inventory.USE.loose-feather-pen.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-small-toolbox-open-empty"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-broken-feather-pen-with-small-toolbox-open-empty"></a>`inventory.USE.broken-feather-pen.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-small-toolbox-open-empty"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-euler-case-file-with-small-toolbox-open-empty"></a>`inventory.USE.euler-case-file.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubber-band-with-small-toolbox-open-empty"></a>`inventory.USE.rubber-band.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubiks-cube-with-small-toolbox-open-empty"></a>`inventory.USE.rubiks-cube.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-small-toolbox-open-empty"></a>`inventory.USE.sharknado-2-vhs.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-small-toolbox-open-empty"></a>`inventory.USE.piggy-bank-intact.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-small-toolbox-open-empty"></a>`inventory.USE.small-toolbox-closed.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-blank-terminal-authorization-form"></a>`inventory.USE.small-toolbox-open-empty.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-loose-feather-pen"></a>`inventory.USE.small-toolbox-open-empty.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.small-toolbox-open-empty.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-broken-feather-pen"></a>`inventory.USE.small-toolbox-open-empty.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.small-toolbox-open-empty.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-euler-case-file"></a>`inventory.USE.small-toolbox-open-empty.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-rubber-band"></a>`inventory.USE.small-toolbox-open-empty.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-rubiks-cube"></a>`inventory.USE.small-toolbox-open-empty.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-sharknado-2-vhs"></a>`inventory.USE.small-toolbox-open-empty.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-piggy-bank-intact"></a>`inventory.USE.small-toolbox-open-empty.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-small-toolbox-closed"></a>`inventory.USE.small-toolbox-open-empty.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-hammer"></a>`inventory.USE.small-toolbox-open-empty.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-nails"></a>`inventory.USE.small-toolbox-open-empty.with.nails` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-fictional-token-note"></a>`inventory.USE.small-toolbox-open-empty.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-hammer-with-small-toolbox-open-empty"></a>`inventory.USE.hammer.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-nails-with-small-toolbox-open-empty"></a>`inventory.USE.nails.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-fictional-token-note-with-small-toolbox-open-empty"></a>`inventory.USE.fictional-token-note.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |

<a id="inventory-hammer"></a>
## undefined

Runtime ID: `hammer`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-hammer"></a>`inventory.GIVE.hammer` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-hammer"></a>`inventory.PICK_UP.hammer` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-hammer"></a>`inventory.USE.hammer` | `inventorySpeechForState` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-open-hammer"></a>`inventory.OPEN.hammer` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-hammer"></a>`inventory.LOOK_AT.hammer` | `inventorySpeechForState` | ROOK: Wow. This thing has some weight to it. Properly heavy-duty.<br>ROOK: I might actually need to be careful with this.<br>ROOK: I feel like I could accidentally break something. | — |
| <a id="route-inventory-push-hammer"></a>`inventory.PUSH.hammer` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-hammer"></a>`inventory.CLOSE.hammer` | `inventorySpeechForState` | ROOK: There’s nothing to close. | — |
| <a id="route-inventory-talk-to-hammer"></a>`inventory.TALK_TO.hammer` | `inventorySpeechForState` | ROOK: We’re not on speaking terms. | — |
| <a id="route-inventory-pull-hammer"></a>`inventory.PULL.hammer` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-hammer"></a>`inventory.USE.blank-terminal-authorization-form.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-loose-feather-pen-with-hammer"></a>`inventory.USE.loose-feather-pen.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-hammer"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-broken-feather-pen-with-hammer"></a>`inventory.USE.broken-feather-pen.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-hammer"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-euler-case-file-with-hammer"></a>`inventory.USE.euler-case-file.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubber-band-with-hammer"></a>`inventory.USE.rubber-band.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-rubiks-cube-with-hammer"></a>`inventory.USE.rubiks-cube.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-hammer"></a>`inventory.USE.sharknado-2-vhs.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-hammer"></a>`inventory.USE.piggy-bank-intact.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-hammer"></a>`inventory.USE.small-toolbox-closed.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-hammer"></a>`inventory.USE.small-toolbox-open-empty.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-hammer-with-blank-terminal-authorization-form"></a>`inventory.USE.hammer.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-hammer-with-loose-feather-pen"></a>`inventory.USE.hammer.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-hammer-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.hammer.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-hammer-with-broken-feather-pen"></a>`inventory.USE.hammer.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-hammer-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.hammer.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-hammer-with-euler-case-file"></a>`inventory.USE.hammer.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-hammer-with-rubber-band"></a>`inventory.USE.hammer.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-hammer-with-rubiks-cube"></a>`inventory.USE.hammer.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-hammer-with-sharknado-2-vhs"></a>`inventory.USE.hammer.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-hammer-with-piggy-bank-intact"></a>`inventory.USE.hammer.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-hammer-with-small-toolbox-closed"></a>`inventory.USE.hammer.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-hammer-with-small-toolbox-open-empty"></a>`inventory.USE.hammer.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-hammer-with-nails"></a>`inventory.USE.hammer.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-hammer-with-fictional-token-note"></a>`inventory.USE.hammer.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-nails-with-hammer"></a>`inventory.USE.nails.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-fictional-token-note-with-hammer"></a>`inventory.USE.fictional-token-note.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |

<a id="inventory-nails"></a>
## undefined

Runtime ID: `nails`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-nails"></a>`inventory.GIVE.nails` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-nails"></a>`inventory.PICK_UP.nails` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-nails"></a>`inventory.USE.nails` | `inventorySpeechForState` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-open-nails"></a>`inventory.OPEN.nails` | `inventorySpeechForState` | ROOK: There’s nothing to open. | — |
| <a id="route-inventory-look-at-nails"></a>`inventory.LOOK_AT.nails` | `inventorySpeechForState` | ROOK: Small. Dainty. Very pointy. Perfect for hanging my keys by the door...<br>ROOK: or the calendar I’ve been meaning to put up all year.<br>ROOK: It’s already December, but better late than never.<br>ROOK: The possibilities are endless! | — |
| <a id="route-inventory-push-nails"></a>`inventory.PUSH.nails` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-nails"></a>`inventory.CLOSE.nails` | `inventorySpeechForState` | ROOK: There’s nothing to close. | — |
| <a id="route-inventory-talk-to-nails"></a>`inventory.TALK_TO.nails` | `inventorySpeechForState` | ROOK: I think this conversation would be a little one-sided. | — |
| <a id="route-inventory-pull-nails"></a>`inventory.PULL.nails` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-nails"></a>`inventory.USE.blank-terminal-authorization-form.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-loose-feather-pen-with-nails"></a>`inventory.USE.loose-feather-pen.with.nails` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-nails"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.nails` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-broken-feather-pen-with-nails"></a>`inventory.USE.broken-feather-pen.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-nails"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.nails` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-euler-case-file-with-nails"></a>`inventory.USE.euler-case-file.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubber-band-with-nails"></a>`inventory.USE.rubber-band.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-rubiks-cube-with-nails"></a>`inventory.USE.rubiks-cube.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-nails"></a>`inventory.USE.sharknado-2-vhs.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-nails"></a>`inventory.USE.piggy-bank-intact.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-nails"></a>`inventory.USE.small-toolbox-closed.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-nails"></a>`inventory.USE.small-toolbox-open-empty.with.nails` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-hammer-with-nails"></a>`inventory.USE.hammer.with.nails` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-nails-with-blank-terminal-authorization-form"></a>`inventory.USE.nails.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-nails-with-loose-feather-pen"></a>`inventory.USE.nails.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-nails-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.nails.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-nails-with-broken-feather-pen"></a>`inventory.USE.nails.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-nails-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.nails.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-nails-with-euler-case-file"></a>`inventory.USE.nails.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-nails-with-rubber-band"></a>`inventory.USE.nails.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-nails-with-rubiks-cube"></a>`inventory.USE.nails.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-nails-with-sharknado-2-vhs"></a>`inventory.USE.nails.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-nails-with-piggy-bank-intact"></a>`inventory.USE.nails.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-nails-with-small-toolbox-closed"></a>`inventory.USE.nails.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-nails-with-small-toolbox-open-empty"></a>`inventory.USE.nails.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-nails-with-hammer"></a>`inventory.USE.nails.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-nails-with-fictional-token-note"></a>`inventory.USE.nails.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-fictional-token-note-with-nails"></a>`inventory.USE.fictional-token-note.with.nails` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |

<a id="inventory-fictional-token-note"></a>
## undefined

Runtime ID: `fictional-token-note`

| Route / trigger | Owner | Player-visible delivery | Performance |
|---|---|---|---|
| <a id="route-inventory-give-fictional-token-note"></a>`inventory.GIVE.fictional-token-note` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-pick-up-fictional-token-note"></a>`inventory.PICK_UP.fictional-token-note` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-fictional-token-note"></a>`inventory.USE.fictional-token-note` | `inventorySpeechForState` | ROOK: I don’t think so. | — |
| <a id="route-inventory-open-fictional-token-note"></a>`inventory.OPEN.fictional-token-note` | `inventorySpeechForState` | ROOK: I don’t want to damage it. It might be worth something.<br>ROOK: I should check the terminal. | — |
| <a id="route-inventory-look-at-fictional-token-note"></a>`inventory.LOOK_AT.fictional-token-note` | `inventorySpeechForState` | ROOK: Bitcoin Roller Coaster Guy. 888,888,888 BRCG.<br>ROOK: There are still nine whole digits. That feels rich.<br>ROOK: I need to check this out for myself in the terminal. | rook:BODY:UNRESOLVED |
| <a id="route-inventory-push-fictional-token-note"></a>`inventory.PUSH.fictional-token-note` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-close-fictional-token-note"></a>`inventory.CLOSE.fictional-token-note` | `inventorySpeechForState` | ROOK: I don’t want to damage it. It might be worth something.<br>ROOK: I should check the terminal. | — |
| <a id="route-inventory-talk-to-fictional-token-note"></a>`inventory.TALK_TO.fictional-token-note` | `inventorySpeechForState` | ROOK: I should be focusing on the case...<br>ROOK: instead of making small talk with inanimate objects. | — |
| <a id="route-inventory-pull-fictional-token-note"></a>`inventory.PULL.fictional-token-note` | `inventorySpeechForState` | ROOK: That won’t help. | — |
| <a id="route-inventory-use-blank-terminal-authorization-form-with-fictional-token-note"></a>`inventory.USE.blank-terminal-authorization-form.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-loose-feather-pen-with-fictional-token-note"></a>`inventory.USE.loose-feather-pen.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-signed-terminal-authorization-form-with-doodles-with-fictional-token-note"></a>`inventory.USE.signed-terminal-authorization-form-with-doodles.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-broken-feather-pen-with-fictional-token-note"></a>`inventory.USE.broken-feather-pen.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-approved-stamped-terminal-authorization-form-with-fictional-token-note"></a>`inventory.USE.approved-stamped-terminal-authorization-form.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-euler-case-file-with-fictional-token-note"></a>`inventory.USE.euler-case-file.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-rubber-band-with-fictional-token-note"></a>`inventory.USE.rubber-band.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-rubiks-cube-with-fictional-token-note"></a>`inventory.USE.rubiks-cube.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-sharknado-2-vhs-with-fictional-token-note"></a>`inventory.USE.sharknado-2-vhs.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-piggy-bank-intact-with-fictional-token-note"></a>`inventory.USE.piggy-bank-intact.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-small-toolbox-closed-with-fictional-token-note"></a>`inventory.USE.small-toolbox-closed.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-small-toolbox-open-empty-with-fictional-token-note"></a>`inventory.USE.small-toolbox-open-empty.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-hammer-with-fictional-token-note"></a>`inventory.USE.hammer.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-nails-with-fictional-token-note"></a>`inventory.USE.nails.with.fictional-token-note` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-fictional-token-note-with-blank-terminal-authorization-form"></a>`inventory.USE.fictional-token-note.with.blank-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-fictional-token-note-with-loose-feather-pen"></a>`inventory.USE.fictional-token-note.with.loose-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-fictional-token-note-with-signed-terminal-authorization-form-with-doodles"></a>`inventory.USE.fictional-token-note.with.signed-terminal-authorization-form-with-doodles` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-fictional-token-note-with-broken-feather-pen"></a>`inventory.USE.fictional-token-note.with.broken-feather-pen` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-fictional-token-note-with-approved-stamped-terminal-authorization-form"></a>`inventory.USE.fictional-token-note.with.approved-stamped-terminal-authorization-form` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-fictional-token-note-with-euler-case-file"></a>`inventory.USE.fictional-token-note.with.euler-case-file` | `inventorySpeechForState:item-pair` | ROOK: I should probably keep those separate. | — |
| <a id="route-inventory-use-fictional-token-note-with-rubber-band"></a>`inventory.USE.fictional-token-note.with.rubber-band` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-fictional-token-note-with-rubiks-cube"></a>`inventory.USE.fictional-token-note.with.rubiks-cube` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-fictional-token-note-with-sharknado-2-vhs"></a>`inventory.USE.fictional-token-note.with.sharknado-2-vhs` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-fictional-token-note-with-piggy-bank-intact"></a>`inventory.USE.fictional-token-note.with.piggy-bank-intact` | `inventorySpeechForState:item-pair` | ROOK: I don’t see how that helps us with the case. | — |
| <a id="route-inventory-use-fictional-token-note-with-small-toolbox-closed"></a>`inventory.USE.fictional-token-note.with.small-toolbox-closed` | `inventorySpeechForState:item-pair` | ROOK: That feels like a bad idea. | — |
| <a id="route-inventory-use-fictional-token-note-with-small-toolbox-open-empty"></a>`inventory.USE.fictional-token-note.with.small-toolbox-open-empty` | `inventorySpeechForState:item-pair` | ROOK: I don’t think so. | — |
| <a id="route-inventory-use-fictional-token-note-with-hammer"></a>`inventory.USE.fictional-token-note.with.hammer` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |
| <a id="route-inventory-use-fictional-token-note-with-nails"></a>`inventory.USE.fictional-token-note.with.nails` | `inventorySpeechForState:item-pair` | ROOK: Those don’t really go together. | — |

[Back to Script Explorer](index.md)
