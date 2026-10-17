// SPDX-License-Identifier: Apache-2.0
import type {KeeperAction} from "./transitions";
/** Maps a planned action to its permissionless circuit and arguments. Pure. */
export function keeperCall(action:KeeperAction):{circuit:string;args:unknown[]}{
  switch(action.kind){
    case "close":case "finalizeMarket":case "cancelMarket":case "skipSelection":return {circuit:action.kind,args:[action.market]};
    case "settleBid":case "markMissedSharedBuyer":return {circuit:action.kind,args:[action.market,action.buyer]};
    case "markMissedReport":return {circuit:action.kind,args:[action.market,action.pool]};
    case "resolveDispute":return {circuit:action.kind,args:[action.dispute]};
    case "returnCancelledSubsidy":return {circuit:action.kind,args:[action.source,action.market]};
  }
}
