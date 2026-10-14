// SPDX-License-Identifier: Apache-2.0
import type { PrivateStateProvider } from "@midnight-ntwrk/midnight-js-types";
import type { SigningKey } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

// Spike-only storage. Refreshing the tab loses state and maintenance authority.
// Export/import deliberately fail rather than emitting unencrypted secrets.
export function ephemeralState<PS>():PrivateStateProvider<string,PS>{
  let scope:string|undefined;
  const states=new Map<string,Map<string,PS>>(), keys=new Map<string,SigningKey>();
  const current=()=>{
    if(!scope)throw new Error("Set a contract scope before accessing private state.");
    let values=states.get(scope);if(!values){values=new Map();states.set(scope,values);}return values;
  };
  const disabled=async():Promise<never>=>{throw new Error("Secret export/import is disabled for ephemeral spike storage.");};
  return {
    setContractAddress(address){scope=address;},
    async set(id,state){current().set(id,state);},
    async get(id){return current().get(id)??null;},
    async remove(id){current().delete(id);},
    async clear(){current().clear();},
    async setSigningKey(address,key){keys.set(address,key);},
    async getSigningKey(address){return keys.get(address)??null;},
    async removeSigningKey(address){keys.delete(address);},
    async clearSigningKeys(){keys.clear();},
    exportPrivateStates:disabled,importPrivateStates:disabled,
    exportSigningKeys:disabled,importSigningKeys:disabled,
  };
}
