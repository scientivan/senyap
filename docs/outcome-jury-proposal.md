# Outcome jury proposal (pending owner approval)

The specification requires anonymous commit/reveal juries for subjective and
contested outcomes. The implemented hoax jury decides whether a scout's stake
should be slashed. It does not yet decide market success masks. This proposal
defines that missing integration; it does not authorize deployment or transactions.

## Alternatives

1. **Recommended: one binary case per option.** Each verdict answers whether that
   option succeeded. The existing binary jury incentives remain well-defined.
   An eight-option report can require eight cases and separate collateral.
2. **One jury for the full mask.** Fewer transactions/collateral, but requiring an
   identical majority mask can leave the pool undecided when jurors agree on most
   options. Bitwise majorities also need new rules for rewarding jurors whose
   complete mask differs from the combined result.

## Proposed rules

- Add an immutable outcome mode to market configuration: objective or subjective,
  chosen at creation. A subjective market cannot use the direct objective-report
  path. This changes the undeployed contract interface and its fixtures.
- A subjective report submits its proposed success mask and evidence hash within
  the normal reporting window, authenticated exactly like an objective report.
  It opens one binary case for each eligible option: that buyer pool's purchased
  options on Side A, all configured options for the shared Side B pool (matching
  the existing objective mask scope). Unused options must remain false.
- The reporter deposits **50 dUSD per case**, at most 400 dUSD for eight options,
  with an immutable refund address. This is an explicit proposal to extend the
  existing reporter-bond amount to outcome cases, not an already approved rule.
- The timely report receipt fulfills the buyer duty while voting continues. On
  Side B it fulfills the shared duty for every buyer. A missing report still uses
  the already approved missed-report/default rules.
- Anyone can challenge one bit of a recorded objective outcome before
  `outcomeUntil`, proposing the opposite bit with evidence and a 50 dUSD bond.
  Allow at most one jury case per market/pool/option to prevent repeated reopening.
  An initial subjective case already occupies this slot.
- Each case uses the first seven anonymous verifier commitments, at least five
  reveals, and a strict binary majority. A verifier locks **100 dUSD separately
  for every case**, so eight concurrent cases require 800 dUSD for that verifier.
  Commit/reveal windows reuse 300 seconds each for demo and 24 hours each for
  production, measured from a checked timestamp with the approved 60-second
  tolerance. Commitments bind deployment, case, secret, vote and salt.
- On a valid verdict, minority loses 50%, non-reveal loses 100%, and penalties go
  to the majority. If the verdict matches the reporter's proposed bit, refund its
  bond; otherwise give its bond to the majority. Keep rounding dust separate from
  scout rewards. These mirror binary hoax-case accounting without slashing scouts.
- Fewer than five reveals or a tie is inconclusive: refund all bonds, apply no
  penalties. A challenged objective bit retains its original value. An unresolved
  subjective bit does not count as proven success. Other conclusive subjective
  successes still count. If no success remains, use the existing D-05 default.
  This fallback is a proposed product rule and needs explicit owner approval.
- Hit issuance, reward denominators, claims and market finalization wait for all
  hoax and outcome cases to resolve and for the reporting window to end. When
  the last late case resolves, preserve a full hit-registration window. An
  outcome jury alone never slashes scout principal or opens a membership card.

## Verification before claiming completion

Keep separate case domains and nullifiers from hoax juries. Test both market
sides, direct-report bypass, option eligibility, independent collateral, exact
deadlines, quorum/ties, opposite verdicts, bond/dust conservation, late settlement,
shared reporting duty, duplicate challenges and continued hoax isolation. Extend
keeper and typed SDK actions, compile, run simulator regressions and source-bound
local proof checks. Frontend controls need a separate preview/approval if their
design changes; a network run still requires explicit transaction authorization.

AGENTS.md rule 5 requires Dien's decision because option-level cases, reporter
collateral and inconclusive-outcome fallback are not fully specified yet.
