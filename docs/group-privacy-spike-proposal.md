# S11 proposal: hide the selected ecosystem group

Refinement approved by Dien on 15 October 2026. Spike first, integration only after acceptance passes. This document is not a claim that
the existing contract protects Side B option privacy. No product deployment exists.

## Reproduced issue

In contracts/senyap.compact, stake discloses groupId and stores it in Position.group.
The public groupConfig maps that group to an ecosystem. The circuit requires a
Side B position's chosen option to reference that same ecosystem. Joining those
public fields therefore identifies the selected option. Encrypting the tally and
hiding option/salt does not remove this link. Side A's ecosystem-independent
scout groups do not create this particular link.

## Recommended representation

Retain the existing per-group membership trees and k>=5 requirements. Add one
shared authenticated registry of current authorized group roots/configuration.
Each registry leaf binds group ID, side, tier, epoch, ecosystem, group size and
membership-tree root. Public admission/configuration/renewal/revocation updates
that group's registry slot. Revocation replaces its entry and resets accepted
registry history so a removed membership cannot reuse an older group root.

A stake uses private witnesses for its group configuration, membership root/path
and registry path. The circuit proves membership inside a group whose metadata/root
belongs to the shared registry, checks side/epoch/tier and both k thresholds, and
checks ecosystem against the private chosen option. Public state access during
stake references the shared registry, never a chosen group's Map entry. Merely
moving groupId into a witness without removing observable group lookups is not a
fix.

Remove plaintext group from Position. Expand the existing hybrid locked membership
card to encrypt group ID as well as full member commitment and leaf index. Prove
all three match the same membership/registry proof. After a proven hoax, the
existing trusted 3-of-5 committee attestation includes the recovered group/index,
bound to the exact card, before operator revocation. This retains the current
committee trust boundary; it does not add an onchain threshold-decryption proof.

Client private state retains the owned group and builds both paths from the
trusted snapshot. It must refresh registry paths after root changes. Apply the
same proof representation to reputation renewal and scout pseudonym proofs so
those circuits do not reintroduce a public group lookup for private membership.
Buyer/verifier trees have no ecosystem-selection mapping and do not require this
change.

## Alternative considered

A single mixed-ecosystem membership group is simpler for hiding a chosen root,
but k>=5 over all members would weaken the existing per-ecosystem anonymity set.
Keeping the original per-ecosystem threshold would require another private
cohort-size proof. The shared root registry preserves the already approved group
semantics and is the recommended approach.

## Spike acceptance before integration

1. Two distinct ecosystem groups, each with five members, admit private stakes
   through the same public registry. Public positions/transcript operations have
   no selected group ID, ecosystem, root or member leaf/path.
2. Inspection of actual serialized public transcript rejects direct and derived
   option/group identifiers, rather than checking only function arguments.
3. Wrong ecosystem/option, tier/epoch, group root, path or group size fails.
4. Revoking a member invalidates old membership/registry proofs. Unaffected
   members can refresh paths and continue. Renewal preserves the same controls.
5. An expanded hybrid card round-trips group/256-bit commitment/index with three
   valid shares, rejects fewer or malformed shares, and stays bound to its stake.
6. Compile, simulator checks and real local /check + /prove pass before replacing
   the main contract representation. Then rerun its suite, key generation and
   selected proofs; revise source-hash evidence and documentation.

Do not claim the issue resolved until these checks and integration pass. This
proposal does not authorize a deployment or onchain transaction.


## Implementation checkpoint

The isolated S11 fixture compiles under Compact 0.31.1. Five simulator/crypto tests
pass, including direct inspection of public operations and a serialization of
public-only transcript data. Private input/witness transcripts are never saved in
evidence. The 72-byte v2 card round-trips group ID, all 256 member-commitment bits
and the 20-bit index under every three-share subset.

Compact's membership-tree root() method is runtime-only. Public administration
therefore obtains a root witness after mutation, resets that membership tree's
accepted history, and checks the witnessed root against the current root before
publishing its registry entry. It cannot select an older historical membership
root while claiming a newer group size. Registry history is reset on revocation.
Membership clients refresh from the trusted snapshot; previously authorized
registry snapshots survive only non-revoking additions.

The common active epoch is disclosed for the block-time bounds. Selected group,
member leaf/path, and selected membership root stay private. Market option names
are public for every option; their presence in a transcript is not a disclosure
of which one the scout selected. The prototype renewal tests private membership
only, with same-tier next-epoch enrollment; it is deliberately not a deployable
replacement for product renewal and does not waive its hit-credential rules.

Full local S11 /check and /prove passed for stake and membership-only renewal
(4860/4508 proof bytes; source hashes and public transcript checks in
[evidence](evidence/S11-proving.json)). Main integration is now authorized to
proceed; the main contract leak stays open until that integration is verified.


## Main integration verification

The approved design is integrated in `contracts/senyap.compact` and SDK witnesses.
Position no longer contains a plaintext group. Admission, hit-based renewal and
revocation update the shared registry; revocation invalidates accepted historic
registry roots, including proofs held by unaffected groups (fresh proofs work).
The main contract retains its hit ownership, distinctness and tier-count rules.
The renewal target enrollment and number of credentials remain public.

Integrated simulator regressions inspect serialized public-only stake operations
for both Side B ecosystems, reject forged authorization metadata and borrowed
paths, and test global revocation plus the unchanged k>=5 bound. Main stake and
three-hit renewal both passed local /check and /prove, with group/leaf/root checks
all true ([source-bound evidence](evidence/S11-main-proving.json)). This closes
the original deterministic public group-reference leak for the tested local
implementation. It is not a network verification or audit and does not address
funding-wallet, admission timing or small eligible-cohort correlations.
