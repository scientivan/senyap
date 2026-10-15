// SPDX-License-Identifier: Apache-2.0
import {setImmediate} from "node:timers/promises";
import {afterEach} from "vitest";

// Generated circuits run synchronously. A suite can exceed Vitest's 60-second
// worker RPC deadline while each test stays below its own 30-second deadline.
// Yield to I/O between scenarios so pending reporter acknowledgements can drain.
// Keep all assertions, worker counts and timeout limits unchanged.
afterEach(async()=>{await setImmediate();});
