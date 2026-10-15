// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import { combinedRisk,screenReason,type ReasonModel } from "../../apps/operator/src/veritas";
import { geminiReasonModel } from "../../apps/operator/src/gemini";
const assessment={aiLikelihood:0.4,rewritten:"Milestones were paid after approval. Contact builder@example.invalid.",claims:["Approval preceded payment."],opinions:["Review felt consistent."]};
const model:ReasonModel={assess:async()=>assessment,embed:async texts=>texts.map((_text,i)=>i===0?[1,0]:[0,1])};
describe("P6.1 Veritas screening core",()=>{
  it("scores duplication and noisy-OR risk as informational flags, and redacts contacts before and after model processing",async()=>{
    const raw="I received milestone payment within ten days after review approval. Contact scout@example.invalid https://example.invalid/profile @scout_id";
    const sent:string[]=[];const spy:ReasonModel={...model,assess:async text=>{sent.push(text);return assessment;}};
    const result=await screenReason(raw,[raw],spy);
    expect(result.D).toBe(1);expect(result.A).toBe(0.4);expect(result.DRS).toBe(1);expect(result.informationalOnly).toBe(true);
    expect(result.flags).toContain("similar_to_another_reason");expect(sent[0]).not.toContain("scout@example.invalid");expect(sent[0]).not.toContain("@scout_id");
    expect(result.rewritten).not.toContain("builder@example.invalid");expect(result.claims).toEqual(assessment.claims);expect(combinedRisk(0.6,0.4)).toBeCloseTo(0.76);
    expect(()=>combinedRisk(0.5,Number.NaN)).toThrow(/Invalid/);
  });
  it("uses semantic duplication and withholds rewrites/scores on unavailable or malformed model output",async()=>{
    const semantic=await screenReason("Payments arrived shortly after reviews.",["Grant instalments followed approval."],{...model,embed:async()=>[[1,2],[2,4]]});
    expect(semantic.D).toBeCloseTo(1);expect(semantic.status).toBe("screened");
    for(const invalid of [undefined,{...model,assess:async()=>({...assessment,aiLikelihood:2})},{...model,embed:async()=>[[1],[1,2]]},{...model,embed:async()=>[[Number.MAX_VALUE,Number.MAX_VALUE],[Number.MAX_VALUE,Number.MAX_VALUE]]}]){
      const result=await screenReason("Payments arrived after reviews.",["Grant approval happened earlier."],invalid);
      expect(result.status).toBe("model-unavailable");expect(result.A).toBeNull();expect(result.DRS).toBeNull();expect(result.rewritten).toBeNull();expect(Number.isFinite(result.D)).toBe(true);
    }
    const result=await screenReason("Synthetic unpublished reason.",[],{...model,assess:async()=>{throw Error("Synthetic provider error body");}});
    expect(JSON.stringify(result)).not.toContain("unpublished reason");expect(JSON.stringify(result)).not.toContain("provider error body");
  });
  it("uses the documented Gemini REST shapes with server-only header auth and validates incomplete replies",async()=>{
    const requests:{url:string;body:any;headers:Headers}[]=[];
    const fetcher:typeof fetch=async(input,init)=>{
      const url=String(input),body=JSON.parse(String(init?.body));requests.push({url,body,headers:new Headers(init?.headers)});
      return new Response(JSON.stringify(url.endsWith(":batchEmbedContents")?{embeddings:body.requests.map(()=>({values:[1,0]}))}:{candidates:[{finishReason:"STOP",content:{parts:[{thought:true,text:"synthetic hidden reasoning"},{text:JSON.stringify(assessment)}]}}]}));
    };
    const adapter=geminiReasonModel({apiKey:"synthetic-api-key-never-deployed",generationModel:"gemini-synthetic-test",embeddingModel:"gemini-embedding-synthetic-test"},fetcher);
    const result=await screenReason("Payment followed approval.",["A grant was paid."],adapter);expect(result.status).toBe("screened");
    expect(requests.length).toBe(2);for(const request of requests){expect(request.url).not.toContain("synthetic-api-key");expect(request.headers.get("x-goog-api-key")).toBe("synthetic-api-key-never-deployed");}
    const generation=requests.find(r=>r.url.endsWith(":generateContent"))!;expect(generation.body.generationConfig.responseFormat.text.mimeType).toBe("application/json");expect(generation.body.tools).toBeUndefined();
    const failed=geminiReasonModel({apiKey:"synthetic-api-key",generationModel:"gemini-synthetic-test",embeddingModel:"gemini-embedding-synthetic-test"},async()=>new Response("synthetic-sensitive-error",{status:403}));
    await expect(failed.assess("synthetic")).rejects.toThrow(/^Reason model request failed$/);
    const truncated=geminiReasonModel({apiKey:"synthetic-api-key",generationModel:"gemini-synthetic-test",embeddingModel:"gemini-embedding-synthetic-test"},async()=>new Response(JSON.stringify({candidates:[{finishReason:"MAX_TOKENS"}]})));
    await expect(truncated.assess("synthetic")).rejects.toThrow(/incomplete/);
  });
});
