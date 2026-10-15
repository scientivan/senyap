/**
 * Domain types. Shaped after SPEC.md §6 so the demo store can later be replaced by the
 * Midnight SDK (packages/sdk) without touching pages.
 */
export type Role = "ecosystem" | "builder" | "scout" | "operator";
export type Side = "A" | "B";
export type {ProductPhase as Phase} from "@senyap/sdk/read-model";
import type {ProductPhase as Phase} from "@senyap/sdk/read-model";

export type Option = {
  id: number;
  label: string; // team name (side A) or answer (side B)
};

export type Market = {
  id: number;
  side: Side;
  category: string;
  question: string;
  ecosystem: string; // pseudonymous for side A buyers, the subject ecosystem for side B
  phase: Phase;
  closesAt: number; // epoch ms
  options: Option[];
  sealedPicks: number;
  scouts: number;
  stakeTotal: number; // dUSD, public
  flatPrice: number; // dUSD
  reservePrice: number;
  auction: boolean;
  /** Option ids the current buyer has bought (revealed to them). */
  bought: number[];
  /** Option ids hidden by the auction winner. */
  heldByWinner: number[];
  myBid?: { amount: number; sealed: boolean };
  outcome?: { successIds: number[]; recordedBy: "buyer" | "operator" | "verifiers"; evidence: string };
};

export type Position = {
  nullifier: string;
  marketId: number;
  optionId: number; // known only on this device
  stake: number;
  slot: 1 | 2 | 3;
  status: "sealed" | "hit" | "miss" | "claimed";
  payout?: number;
};

export type QueueItem = {
  id: string;
  role: Role;
  title: string;
  detail: string;
  due?: number;
  href: string;
  action: string;
  tone: "urgent" | "normal" | "done";
};

export type Team = {
  id: string;
  name: string;
  focus: string;
  stage: string;
  chains: string;
  consent: boolean;
  registeredAt: number;
};
