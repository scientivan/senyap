// SPDX-License-Identifier: Apache-2.0
// Compatibility entry point for existing service hosts. Browser and services use
// the same deployment, finalized-block and freshness checks.
export {createSnapshotReader,type SnapshotConfig,type ProductSnapshot} from "../../../packages/sdk/src/snapshot";
