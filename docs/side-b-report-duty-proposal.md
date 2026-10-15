# Side B reporting duty (approved 15 October 2026)

Dien approved the shared-duty rule below on 15 October 2026. Implementation may
proceed; deployment and network transactions still require separate permission.

## Existing behavior

Side B has one shared reward pool, one success mask and an unlimited number of
paid buyers. A qualified buyer or the operator can record the shared objective
outcome. The first accepted report closes further purchases. The specification
requires buyers to report, but does not define whether this duty is shared or
individual when the outcome itself is shared.

## Recommended rule: shared duty

One valid shared outcome report by a paid buyer or the operator, recorded before
`outcomeUntil`, satisfies the reporting duty for every buyer of that market.
A valid report that records no successful options also satisfies the duty;
the existing committee default selects from the union of purchased options.

If no valid report exists at the deadline, anyone can mark the market's shared
report as missed and request the existing committee default once. Each paid buyer
can then be marked as missing that report using its market pseudonym. Revealing
and removing that buyer's good standing still requires three matching committee
attestations followed by the operator action, as on Side A. No wallet identity is
inferred directly from the public pseudonym. Funds and paid access remain intact.

Defaulting and buyer sanctions must be separate so unlimited buyers cannot block
settlement through a large loop. Buyer sanctions must remain possible after the
shared default and market settlement. Markets cancelled for no purchases have
no buyer reporting sanctions. A timely shared report prevents sanctions, even if
the outcome had no successful options; the committee default is not a buyer report.

## Alternative: individual duty

Every paid buyer submits a separate report receipt. The shared outcome still
needs a rule for reconciling conflicting reports. This adds per-buyer evidence,
new conflict handling and extra transactions despite one shared pool. Choose this
only if individual accountability is intended as a product requirement.

## Implementation and acceptance after approval

Extend missed-report storage/circuits and the keeper with one shared default
transition plus independent buyer marking. Preserve Side A rules and existing
threshold revocation. Check timely buyer/operator reports, no-success reports,
unpaid pseudonyms, exact deadline, repeated marking, post-default sanctions,
late settlement, full cancelled refunds and preservation of other buyers' standing.
Compile and run affected simulator/keeper regressions before regenerating keys.

Owner decision is required by AGENTS.md rule 5 because this defines a buyer's
reporting obligation and penalty, rather than merely filling in implementation.
