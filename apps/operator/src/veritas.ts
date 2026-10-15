// SPDX-License-Identifier: Apache-2.0
export type ReasonAssessment={aiLikelihood:number;rewritten:string;claims:string[];opinions:string[]};
export interface ReasonModel { assess(text:string):Promise<unknown>;embed(texts:readonly string[]):Promise<number[][]>; }
export type Screening={status:"screened"|"model-unavailable";D:number;A:number|null;DRS:number|null;rewritten:string|null;claims:string[];opinions:string[];flags:string[];informationalOnly:true};
const validScore=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=1;
export function combinedRisk(duplicate:number,ai:number):number {
  if(!validScore(duplicate)||!validScore(ai))throw Error("Invalid screening score");return 1-(1-duplicate)*(1-ai);
}
export function redactIdentifiers(text:string):string {
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[contact removed]")
    .replace(/https?:\/\/[^\s]+/gi,"[link removed]").replace(/\b0x[a-f0-9]{40,64}\b/gi,"[address removed]")
    .replace(/\bmn_addr_[a-z0-9_]+\b/gi,"[address removed]").replace(/(^|\s)@[a-z0-9_]{2,}/gi,"$1[handle removed]");
}
function shingles(text:string):Set<string> {
  const words=text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu)??[],size=Math.min(5,words.length),result=new Set<string>();
  if(!size)return result;for(let i=0;i<=words.length-size;i++)result.add(words.slice(i,i+size).join(" "));return result;
}
function lexicalSimilarity(a:string,b:string):number {
  const left=shingles(a),right=shingles(b),union=new Set([...left,...right]);if(!union.size)return 0;
  return [...left].filter(value=>right.has(value)).length/union.size;
}
function cosine(a:readonly number[],b:readonly number[]):number {
  if(!a.length||a.length!==b.length||a.some(x=>!Number.isFinite(x))||b.some(x=>!Number.isFinite(x)))throw Error("Invalid reason embeddings");
  const left=Math.hypot(...a),right=Math.hypot(...b);
  if(!left||!right||!Number.isFinite(left)||!Number.isFinite(right))throw Error("Invalid reason embedding norm");
  const dot=a.reduce((sum,x,i)=>sum+(x/left)*(b[i]/right),0);return Math.max(0,Math.min(1,dot));
}
function assessment(value:unknown):ReasonAssessment {
  if(!value||typeof value!=="object")throw Error("Invalid model assessment");const result=value as Record<string,unknown>;
  const list=(items:unknown):items is string[]=>Array.isArray(items)&&items.length<=16&&items.every(x=>typeof x==="string"&&x.length<=1000);
  if(!validScore(result.aiLikelihood)||typeof result.rewritten!=="string"||!result.rewritten.trim()||result.rewritten.length>6000||!list(result.claims)||!list(result.opinions))throw Error("Invalid model assessment");
  return {aiLikelihood:result.aiLikelihood,rewritten:result.rewritten,claims:result.claims,opinions:result.opinions};
}
/** Rewritten from the approved Veritas mechanism, without copying Solana code.
 * Scores are uncertain model/duplication indicators, never a slash decision. */
export async function screenReason(text:string,previous:readonly string[],model?:ReasonModel):Promise<Screening> {
  if(!text.trim()||text.length>6000||previous.length>64||previous.some(x=>x.length>6000))throw Error("Reason input exceeds screening limits");
  const clean=redactIdentifiers(text),corpus=previous.map(redactIdentifiers);
  let D=corpus.reduce((best,item)=>Math.max(best,lexicalSimilarity(clean,item)),0);
  try {
    if(!model)throw Error("No reason model configured");
    const [raw,vectors]=await Promise.all([model.assess(clean),corpus.length?model.embed([clean,...corpus]):Promise.resolve([])]);
    if(corpus.length){if(vectors.length!==corpus.length+1)throw Error("Embedding count mismatch");for(let i=1;i<vectors.length;i++)D=Math.max(D,cosine(vectors[0],vectors[i]));}
    const result=assessment(raw),A=result.aiLikelihood,flags:string[]=[];
    if(D>=0.8)flags.push("similar_to_another_reason");if(A>=0.75)flags.push("high_model_ai_likelihood");
    return {status:"screened",D,A,DRS:combinedRisk(D,A),rewritten:redactIdentifiers(result.rewritten),claims:result.claims.map(redactIdentifiers),opinions:result.opinions.map(redactIdentifiers),flags,informationalOnly:true};
  } catch {
    // Fail closed on model outages/malformed output. Never release the raw reason
    // as a purported privacy-preserving rewrite, and never invent an AI score.
    return {status:"model-unavailable",D,A:null,DRS:null,rewritten:null,claims:[],opinions:[],flags:["screening_requires_retry"],informationalOnly:true};
  }
}
