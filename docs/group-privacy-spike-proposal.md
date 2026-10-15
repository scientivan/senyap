# S11 proposal: hide the selected ecosystem group

Proposed refinement, awaiting Dien's approval. This document is not a claim that
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
