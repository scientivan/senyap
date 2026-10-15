// SPDX-License-Identifier: Apache-2.0
// X25519 + HKDF-SHA256 + AES-256-GCM for committee responses to a bound buyer key.
export type BuyerEnvelope={version:1;ephemeralPublicKey:Uint8Array;salt:Uint8Array;iv:Uint8Array;ciphertext:Uint8Array};
const contextBytes=(binding:string)=>{
  const encoded=new TextEncoder().encode(binding);if(encoded.length===0||encoded.length>4096)throw Error("Invalid buyer-channel binding");
  const domain=new TextEncoder().encode("senyap:buyer-channel:v1"),output=new Uint8Array(domain.length+4+encoded.length);
  output.set(domain);new DataView(output.buffer).setUint32(domain.length,encoded.length);output.set(encoded,domain.length+4);return output;
};
const source=(bytes:Uint8Array)=>new Uint8Array(bytes).buffer;
export async function generateBuyerKey():Promise<{privateKey:CryptoKey;publicKey:Uint8Array}>{
  // Extractability supports subsequent encrypted private-state storage; never log/export in plaintext.
  const pair=await crypto.subtle.generateKey({name:"X25519"},true,["deriveBits"]) as CryptoKeyPair;
  return {privateKey:pair.privateKey,publicKey:new Uint8Array(await crypto.subtle.exportKey("raw",pair.publicKey))};
}
async function symmetricKey(privateKey:CryptoKey,publicKey:Uint8Array,salt:Uint8Array,info:Uint8Array){
  if(publicKey.length!==32||salt.length!==32)throw Error("Invalid buyer-channel key format");
  const pub=await crypto.subtle.importKey("raw",source(publicKey),{name:"X25519"},false,[]);
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:"X25519",public:pub},privateKey,256));
  try{
    const input=await crypto.subtle.importKey("raw",source(shared),"HKDF",false,["deriveKey"]);
    return await crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",salt:source(salt),info:source(info)},input,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  }finally{shared.fill(0);}
}
export async function encryptForBuyer(publicKey:Uint8Array,payload:Uint8Array,binding:string):Promise<BuyerEnvelope>{
  if(payload.length>65536)throw Error("Buyer response too large");
  const info=contextBytes(binding),ephemeral=await generateBuyerKey(),salt=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
  try{
    const key=await symmetricKey(ephemeral.privateKey,publicKey,salt,info);
    const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:source(iv),additionalData:source(info),tagLength:128},key,source(payload)));
    return {version:1,ephemeralPublicKey:ephemeral.publicKey,salt,iv,ciphertext};
  }catch{throw Error("Buyer response encryption failed");}
}
export async function decryptFromCommittee(privateKey:CryptoKey,envelope:BuyerEnvelope,binding:string):Promise<Uint8Array>{
  if(envelope.version!==1||envelope.iv.length!==12||envelope.ciphertext.length<16||envelope.ciphertext.length>65552)throw Error("Invalid buyer response format");
  try{
    const info=contextBytes(binding),key=await symmetricKey(privateKey,envelope.ephemeralPublicKey,envelope.salt,info);
    return new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv:source(envelope.iv),additionalData:source(info),tagLength:128},key,source(envelope.ciphertext)));
  }catch{throw Error("Buyer response authentication failed");}
}
