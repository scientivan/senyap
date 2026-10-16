// SPDX-License-Identifier: Apache-2.0
import {geminiReasonModel} from "../apps/operator/src/gemini";
import {screenReason} from "../apps/operator/src/veritas";

// Run with node --env-file=.env --import tsx scripts/probe-gemini.ts.
// Uses synthetic text only. No response text, vectors or credentials are logged.
const generationModel=process.env.GEMINI_GENERATION_MODEL;
const embeddingModel=process.env.GEMINI_EMBEDDING_MODEL;
if(!generationModel||!embeddingModel||!process.env.GEMINI_API_KEY){
  console.log(JSON.stringify({status:"configuration-missing",required:["GEMINI_API_KEY","GEMINI_GENERATION_MODEL","GEMINI_EMBEDDING_MODEL"]}));
  process.exitCode=1;
}else{
  const requests:{method:string;status:number}[]=[];
  try{
    const request:typeof fetch=async(input,init)=>{
      const response=await fetch(input,init);
      requests.push({method:String(input).split(":").at(-1)!,status:response.status});
      return response;
    };
    const model=geminiReasonModel({apiKey:process.env.GEMINI_API_KEY,generationModel,embeddingModel},request);
    const result=await screenReason("Synthetic fixture. A milestone payment arrived ten days after approval.",["Synthetic fixture. Review approval preceded a grant payment."],model);
    console.log(JSON.stringify({syntheticOnly:true,generationModel,embeddingModel,requests,status:result.status,hasRewrite:!!result.rewritten,claimCount:result.claims.length,opinionCount:result.opinions.length,informationalOnly:result.informationalOnly}));
    if(result.status!=="screened")process.exitCode=1;
  }catch{
    console.log(JSON.stringify({syntheticOnly:true,status:"probe-failed",requests}));process.exitCode=1;
  }
}
