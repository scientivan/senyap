// SPDX-License-Identifier: Apache-2.0
import { persistentState, packPrivateKey, restorePrivateKey } from "./private-state";

type Profile = { version: 1; scout: Uint8Array; buyer: Uint8Array; builder: Uint8Array; verifier: Uint8Array;
  signing: Uint8Array; receiving: Uint8Array; signingPublic: Uint8Array; receivingPublic: Uint8Array };
const marker = "senyap-workspace-v1";
const stateId = "profile";
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
const validId = (id: string | null): id is string => !!id && /^[a-f0-9]{32}$/.test(id);
export const workspaceExists = () => validId(localStorage.getItem(marker));
export function workspacePasswordValid(value: string): boolean {
  return value.length >= 16 && [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(value)).length >= 3;
}
async function provider(id: string, password: () => string) {
  // This is a local identity namespace, never a deployed contract address. Product
  // contract state must use its own persistentState instance with the real address.
  const scope = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("senyap:local-profile:v1"))));
  return persistentState<Profile>({ network: "local-profile", accountId: id, contractAddress: scope, password });
}
function validate(profile: Profile | null): asserts profile is Profile {
  if (!profile || profile.version !== 1 || [profile.scout, profile.buyer, profile.builder, profile.verifier,
    profile.signingPublic, profile.receivingPublic].some(b => !(b instanceof Uint8Array) || b.length !== 32)) throw Error("Invalid workspace");
}
async function validateKeys(profile: Profile) {
  const signing = await restorePrivateKey(profile.signing, "Ed25519");
  const receiving = await restorePrivateKey(profile.receiving, "X25519");
  const message = new TextEncoder().encode("senyap:workspace:key-check:v1");
  const pub = await crypto.subtle.importKey("raw", new Uint8Array(profile.signingPublic).buffer, "Ed25519", false, ["verify"]);
  const signature = await crypto.subtle.sign("Ed25519", signing, message);
  if (!await crypto.subtle.verify("Ed25519", pub, signature, message)) throw Error("Invalid workspace key");
  // PKCS8 embeds the public key only on some implementations. Validate X25519
  // against a fresh peer so backups cannot silently substitute a recipient key.
  const peer = await crypto.subtle.generateKey("X25519", false, ["deriveBits"]) as CryptoKeyPair;
  const recipient = await crypto.subtle.importKey("raw", new Uint8Array(profile.receivingPublic).buffer, "X25519", false, []);
  const a = new Uint8Array(await crypto.subtle.deriveBits({ name: "X25519", public: peer.publicKey }, receiving, 256));
  const b = new Uint8Array(await crypto.subtle.deriveBits({ name: "X25519", public: recipient }, peer.privateKey, 256));
  const same = a.every((n, i) => n === b[i]); a.fill(0); b.fill(0);
  if (!same) throw Error("Invalid workspace key");
}
export type WorkspaceSession = { backup: () => Promise<string>; lock: () => void };
export async function openWorkspace(mode: "create" | "unlock" | "restore", password: string, backup?: string): Promise<WorkspaceSession> {
  if (!navigator.locks) throw Error("This browser cannot safely open the workspace. Use a current browser on localhost or HTTPS.");
  return navigator.locks.request(marker, async () => {
    let secret = password;
    const existing = localStorage.getItem(marker);
    if (mode !== "unlock" && existing) throw Error("A workspace already exists here. Unlock it to keep its data.");
    if (mode === "unlock" && !validId(existing)) throw Error("No workspace was found. Create one or restore a backup.");
    const id = mode === "unlock" ? existing! : hex(crypto.getRandomValues(new Uint8Array(16)));
    const storage = await provider(id, () => secret);
    try {
      if (mode === "create") {
        if (!workspacePasswordValid(secret)) throw Error("Use at least 16 characters and three character types.");
        const signing = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]) as CryptoKeyPair;
        const receiving = await crypto.subtle.generateKey("X25519", true, ["deriveBits"]) as CryptoKeyPair;
        const random = () => crypto.getRandomValues(new Uint8Array(32));
        await storage.set(stateId, { version: 1, scout: random(), buyer: random(), builder: random(), verifier: random(),
          signing: await packPrivateKey(signing.privateKey), receiving: await packPrivateKey(receiving.privateKey),
          signingPublic: new Uint8Array(await crypto.subtle.exportKey("raw", signing.publicKey)),
          receivingPublic: new Uint8Array(await crypto.subtle.exportKey("raw", receiving.publicKey)) });
      }
      if (mode === "restore") {
        if (!backup || backup.length > 1_000_000) throw Error("Choose a Senyap encrypted backup smaller than 1 MB.");
        await storage.importPrivateStates(JSON.parse(backup), { maxStates: 1, conflictStrategy: "error" });
      }
      const profile = await storage.get(stateId); validate(profile); await validateKeys(profile);
      if (mode !== "unlock") localStorage.setItem(marker, id);
      return { backup: async () => {
        if (!secret) throw Error("Workspace is locked.");
        return JSON.stringify(await storage.exportPrivateStates({ maxStates: 1 }));
      }, lock: () => { secret = ""; } };
    } catch { secret = ""; throw Error(mode === "create"
      ? "Workspace could not be created. Use a strong password without repeated characters or sequences, and allow browser storage."
      : "Workspace could not be opened. Check the password and backup, then try again."); }
  });
}
