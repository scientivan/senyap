// SPDX-License-Identifier: Apache-2.0
import { cp, mkdir, access } from "node:fs/promises";
const source="contracts/managed/spikes/s5-browser-counter";
await Promise.all([access(`${source}/keys/ping.prover`),access(`${source}/keys/ping.verifier`),access(`${source}/zkir/ping.zkir`)]);
await mkdir("apps/web/public/spikes/s5",{recursive:true});
for(const directory of ["keys","zkir"])await cp(`${source}/${directory}`,`apps/web/public/spikes/s5/${directory}`,{recursive:true});
console.log("Prepared public proving artifacts for the S5 fixture. No private state or wallet keys copied.");
