// SPDX-License-Identifier: Apache-2.0
// Plaintext totals stay inside the trusted committee workflow; only derived
// histograms/default indices are submitted through threshold approvals.
function validateTotals(totals:readonly bigint[]) {
  if(totals.length<1||totals.length>8||totals.some(x=>x<0n)||totals.reduce((a,b)=>a+b,0n)>=2n**40n)throw Error("Invalid market totals");
}
export function summarizeTotals(totals:readonly bigint[]) {
  validateTotals(totals);const highest=totals.reduce((a,b)=>a>b?a:b,0n);
  if(highest===0n)throw Error("No positive market support");
  const histogram={strong:0n,medium:0n,weak:0n};
  for(const weight of totals){if(weight*100n>=highest*50n)histogram.strong++;else if(weight*100n<highest*20n)histogram.weak++;else histogram.medium++;}
  return histogram;
}
export function chooseDefaultOption(totals:readonly bigint[],eligible:readonly boolean[]):number {
  validateTotals(totals);if(eligible.length!==totals.length)throw Error("Invalid default eligibility");
  let selected=-1;
  // Deterministic ties keep the lowest option index. No individual vote opens a total.
  for(let i=0;i<totals.length;i++)if(eligible[i]&&(selected<0||totals[i]>totals[selected]))selected=i;
  if(selected<0)throw Error("No purchased default option");return selected;
}
