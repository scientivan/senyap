// SPDX-License-Identifier: Apache-2.0
// D18-5: the exact OpAction each operator-gated circuit consumes. Operators vote on
// actionId(opActionFor(...)); the circuit recomputes the same value from its
// arguments, so an approval cannot be reused for different parameters.
import { pureCircuits, type OpAction, type ScoutGroup, type Market } from "../../../contracts/managed/senyap/contract/index.js";

const zero = new Uint8Array(32);
const tag = (name: string) => { const t = new Uint8Array(32); t.set(new TextEncoder().encode(`op:${name}`)); return t; };
const act = (name: string, a = zero, b = zero, n: [bigint, bigint, bigint] = [0n, 0n, 0n]): OpAction => ({ tag: tag(name), a, b, n });

export type GatedCall =
  | { circuit: "configureScoutGroup"; group: Uint8Array; config: ScoutGroup }
  | { circuit: "admitScout"; group: Uint8Array; commitment: Uint8Array }
  | { circuit: "revokeMember"; group: Uint8Array; index: bigint }
  | { circuit: "admitBuyer" | "admitVerifier"; commitment: Uint8Array }
  | { circuit: "allocateSubsidy"; sourceId: bigint; targetId: bigint; amount: bigint }
  | { circuit: "revokeHoaxMember"; dispute: Uint8Array }
  | { circuit: "revokeMissedBuyer"; pseudonym: Uint8Array }
  | { circuit: "createSideBMarket"; id: bigint; config: Market }
  | { circuit: "recordOutcome"; id: bigint; pool: bigint; mask: boolean[]; evidence: Uint8Array }
  | { circuit: "registerPublicIntent"; id: Uint8Array; profileHash: Uint8Array; evidenceHash: Uint8Array }
  | { circuit: "optOutPublicIntent"; id: Uint8Array }
  | { circuit: "claimPublicIntent"; id: Uint8Array; ownerCommit: Uint8Array };

export function opActionFor(call: GatedCall): OpAction {
  switch (call.circuit) {
    case "configureScoutGroup": return act(call.circuit, call.group, pureCircuits.scoutGroupHash(call.config));
    case "admitScout": return act(call.circuit, call.group, call.commitment);
    case "revokeMember": return act(call.circuit, call.group, zero, [call.index, 0n, 0n]);
    case "admitBuyer": case "admitVerifier": return act(call.circuit, call.commitment);
    case "allocateSubsidy": return act(call.circuit, zero, zero, [call.sourceId, call.targetId, call.amount]);
    case "revokeHoaxMember": return act(call.circuit, call.dispute);
    case "revokeMissedBuyer": return act(call.circuit, call.pseudonym);
    case "createSideBMarket": return act(call.circuit, call.config.questionHash, pureCircuits.optionRefsHash(call.config.optionRefs), [call.id, call.config.openUntil, call.config.outcomeUntil]);
    case "recordOutcome": return act(call.circuit, call.evidence, pureCircuits.maskHash(call.mask), [call.id, call.pool, 0n]);
    case "registerPublicIntent": return act(call.circuit, call.id, pureCircuits.pairHash(call.profileHash, call.evidenceHash));
    case "optOutPublicIntent": return act(call.circuit, call.id);
    case "claimPublicIntent": return act(call.circuit, call.id, call.ownerCommit);
  }
}

export const opActionId = (call: GatedCall) => pureCircuits.actionId(opActionFor(call));
