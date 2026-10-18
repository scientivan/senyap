# Senyap on Midnight Preprod: transaction evidence

Contract `a79019329f23d638ea7c690bf4fc8c9da6e60b6f7b3951cbf35ead11b8267ff9` on Midnight Preprod. Every row is a finalized call read from the Blockfrost Midnight indexer (`contract(address).actions`), exported 2026-10-18T17:14:23.092Z. Total 77 contract calls.

The demo dUSD token contract is `e5ac20e387eb75b7357f19a309e8826e2849f60e1d63208d4514a8f3d716681e` (deploy and mint transactions are in [the deploy journal](P9.7-preprod-deploy-journal.json)).

**Limits.** One person holds every operator seat and committee share, and the scouts and buyer are synthetic identities held by the operator relay. The rules are enforced on chain; independence is not shown yet.

## Deploy and verifier install (8)

Contract deploy, six staged verifier batches, authority handoff.

| Call | Transaction hash | Block | Time (UTC) |
| --- | --- | --- | --- |
| deploy | `661a3c641a84851498fa49540231da9f31b4e53c8e88be33c96e4fa4b3f625b2` | 3032137 | 2026-10-18 08:04:18 |
| maintenance update | `e035a33061e00f6801d2ae56a6590005d599af4d912d8768916a210b12f7f843` | 3032142 | 2026-10-18 08:04:48 |
| maintenance update | `8cb761d2a50c4cb2660bc5047178fe2741978dec9c1b39708912544e89bb352e` | 3032150 | 2026-10-18 08:05:36 |
| maintenance update | `35b8d0c953e797298faf2708d81b59bed784cc2eb5ede1e9bac0a0428556cf4e` | 3032155 | 2026-10-18 08:06:06 |
| maintenance update | `705d8ad275b2b179c295269bba5c7434a97a31fe6c6ce004b890ff54baadfe29` | 3032161 | 2026-10-18 08:06:42 |
| maintenance update | `800a11299c2c4100c95f15b0bb8c56df059e1c8656d649ac6f8a390f0a8a032d` | 3032169 | 2026-10-18 08:07:30 |
| maintenance update | `808a371833f2279c5cf0981d15ac0931f1720ae66651a09cf576690bbfbb4942` | 3032207 | 2026-10-18 08:11:18 |
| maintenance update | `0b329cb9844e527e69cdd3a2c6c23acec0284583a69f2525a1d6933cc17bdc50` | 3032227 | 2026-10-18 08:13:18 |

## Stakes (8)

Operators and committee members lock 500 dUSD each.

| Call | Transaction hash | Block | Time (UTC) |
| --- | --- | --- | --- |
| stakeOperator | `5b78757b56ac063427e38226457977c02ee71525c7660c400a7b196ba5ead165` | 3032322 | 2026-10-18 08:22:48 |
| stakeOperator | `618345ab6b3fdc420c1708c068b1930f6563e7101acd2c4adbe8dd620bac41a7` | 3032366 | 2026-10-18 08:27:12 |
| stakeOperator | `9cfbf2ebca34106abe3a2e62bd67dbff511140b393ed61d7962c8ad2609add47` | 3032379 | 2026-10-18 08:28:30 |
| stakeCommittee | `1677317024456092e7f15453c2d8f3c72e9dd04c3e2659eac3cc592987dd32cb` | 3032392 | 2026-10-18 08:29:48 |
| stakeCommittee | `715c553fa3d6c4d994671d8c1359bb252727668cf90fce3a67f5e52a2d6bc68e` | 3032405 | 2026-10-18 08:31:06 |
| stakeCommittee | `3bb1ccf1dee03a93896d2240126fb2e386b529036e7684afbe2ef346b7797aac` | 3032421 | 2026-10-18 08:32:42 |
| stakeCommittee | `15e6d184a9f67d1544d33293cbd331850b1fb037d28873056efef398f227ecab` | 3032434 | 2026-10-18 08:34:00 |
| stakeCommittee | `96e3f28c93d857db339d5f197968f2de85abae0aeaf7441b8c3b8ebeada35344` | 3032450 | 2026-10-18 08:35:36 |

## Operator approvals (30)

Three of five operators approve each gated action.

| Call | Transaction hash | Block | Time (UTC) |
| --- | --- | --- | --- |
| voteOperatorAction | `248d51c173e0fc3e3a990a0f259e82bd0fe0e93348866ec0950f5024f1bff133` | 3033001 | 2026-10-18 09:30:42 |
| voteOperatorAction | `e4402b29edfd36962d9c8aee6413a160bb244ac6a66f814b53697f598ab13619` | 3033014 | 2026-10-18 09:32:00 |
| voteOperatorAction | `b99376990a42a59c6cdbf1f4b309ef8ebaf7e16fd19dd235fd7bcdffd6380c28` | 3033024 | 2026-10-18 09:33:00 |
| voteOperatorAction | `9a0b604f72814e7299831243f42d9bfdf422bc4e75aa74cce3b65d2bd7c71c48` | 3033714 | 2026-10-18 10:42:00 |
| voteOperatorAction | `277b3ccb78aa614d9b51faf5a75498671db6b3d79ba8cd94b3dc5644a30613f1` | 3033721 | 2026-10-18 10:42:42 |
| voteOperatorAction | `99b38c8bc26ba605459921f7d97f460871bbe92736a7a3b4acb1b2130dc5b1e6` | 3033732 | 2026-10-18 10:43:48 |
| voteOperatorAction | `b8af7068d5d66905c97bbe9c517699f515cad4507c4502cebbba4ee259771c33` | 3033903 | 2026-10-18 11:00:54 |
| voteOperatorAction | `3fcbe4d6b42401f34b9e01911a1e346acbe1f097bf19038c6a2ab67446510e35` | 3033914 | 2026-10-18 11:02:00 |
| voteOperatorAction | `797a0782df4e7840e642b74e216a3529ed34f339e5256b2ff7d8a621870d5f24` | 3033955 | 2026-10-18 11:06:06 |
| voteOperatorAction | `0bbcc4761d35065d3cd5f8c90edcf903195027d32c09c85586b4ab0be9ee7cbe` | 3033973 | 2026-10-18 11:07:54 |
| voteOperatorAction | `c55f68e51ca1a29434bf1f17435c53a35b27d729ac31925898cf6ca0c056b779` | 3033986 | 2026-10-18 11:09:12 |
| voteOperatorAction | `92066f4d27da8784eb61794fc39a80759988f35a18d80ba8bdc1a6f6c62177a4` | 3033995 | 2026-10-18 11:10:06 |
| voteOperatorAction | `040748c4eb3e89e96f00f24aacd68b683b796e85e05231743b8baebfc5408de3` | 3034018 | 2026-10-18 11:12:24 |
| voteOperatorAction | `75b220ad74181ac9e57cde19d853414c00011551c9ad4dd68f10a93650c1cbfc` | 3034028 | 2026-10-18 11:13:24 |
| voteOperatorAction | `74a0fcf795d3b09915f1d9780dbd95fb3c8bf35c999b7be7d155bc782c79dc64` | 3034041 | 2026-10-18 11:14:42 |
| voteOperatorAction | `daf5410e3de14597f191c102587d45d9a78a22f66daa9be218ea0c4ec2997cc1` | 3034063 | 2026-10-18 11:16:54 |
| voteOperatorAction | `79b3f665b0d765e0e05d2c8e2412fda133620dd73962c3d75641ed41eaa57724` | 3034127 | 2026-10-18 11:23:18 |
| voteOperatorAction | `da4898ba5fbf44bb04a6c34caaa40a4cfcc96295af2a179099006a9ec4240876` | 3034209 | 2026-10-18 11:31:30 |
| voteOperatorAction | `ed21e72fd175d5fdea5fef3feb2adef6273df6ee6d75bd7b1dfe1ed9fb848ba6` | 3034221 | 2026-10-18 11:32:42 |
| voteOperatorAction | `a53996065a82ac6166fe9cd8b5eb7f737e680908cda3a8dcca11c5a3314fa337` | 3034242 | 2026-10-18 11:34:48 |
| voteOperatorAction | `b371eb747a579f62b9dba38ac25f34413237c14597fdcbb1e86fc1df2f243c19` | 3034248 | 2026-10-18 11:35:24 |
| voteOperatorAction | `99206ff6fd375a8013682a43d9fabcbdda1a0cc75ce4ecb89b5b45411f9995a9` | 3034264 | 2026-10-18 11:37:00 |
| voteOperatorAction | `01366a9a07849e3449f7a38a33849e57d74744f25fd1d8a16a9ab41f743ee293` | 3034271 | 2026-10-18 11:37:42 |
| voteOperatorAction | `c074f7f91dda04997bd560cd8f225a0790a5c5967bb2aec46c31540e00161cb1` | 3034286 | 2026-10-18 11:39:12 |
| voteOperatorAction | `9d68cc2df0487fd8a3e963dfe8304cca8d3857184ebff2282ed0888b0c62398e` | 3034580 | 2026-10-18 12:08:36 |
| voteOperatorAction | `1c18ef19127a8e8f80111866c2b112fb1203e5afd06b578393c164bff11c1df7` | 3034591 | 2026-10-18 12:09:42 |
| voteOperatorAction | `bb6ec0b83e1cd1926831b6d4c9457e0337b06c6082edf32d0829a404dbdf9110` | 3034599 | 2026-10-18 12:10:30 |
| voteOperatorAction | `e964c5a09c98899d508a3b8d1ecb4917acf81d68db3dc7a82289e92b5aed636c` | 3037114 | 2026-10-18 16:22:00 |
| voteOperatorAction | `ee91d6046676f617188e89e683cc4fdc29804b9814d4dd7143dd19a8e02c26e1` | 3037121 | 2026-10-18 16:22:42 |
| voteOperatorAction | `0af56340b738ee9167633b1e2851702089949a5a636f3f479a13a6e519c2b547` | 3037129 | 2026-10-18 16:23:30 |

## Markets and groups (10)

Side B markets, daily scout group, scout and buyer admission.

| Call | Transaction hash | Block | Time (UTC) |
| --- | --- | --- | --- |
| createSideBMarket | `54451fd4089869b017c9d47df3fc0fdcab5c7afbe2976165564c692b83f3f032` | 3033035 | 2026-10-18 09:34:06 |
| createSideBMarket | `8f22936000ff2cbba1adfd2974155cedd4f3d69605257a3900f5af54e4677132` | 3033742 | 2026-10-18 10:44:48 |
| configureScoutGroup | `84ca9abcd16ac51cdf340d2ddd0d7c58382b84619fe61e936cb4f4498ab2cc57` | 3033964 | 2026-10-18 11:07:00 |
| admitScout | `951e85eb3a6177e7c59205dea0d20e1a99072ad7f652a2d4a93e9b87ee217ac1` | 3034008 | 2026-10-18 11:11:24 |
| admitScout | `356503f18d26ff062a893bd21e1f18e9cdede0fc6c37ed2c5fa090a5aaf03c58` | 3034053 | 2026-10-18 11:15:54 |
| admitScout | `49008ef481ea1b1a08d3d9f243c0d365d4920b18b430ea24cd730361707e31b4` | 3034215 | 2026-10-18 11:32:06 |
| admitScout | `9728607a96dafbc26d85dc173b7207a92074a3e0044c50ba45710710fe2459d2` | 3034256 | 2026-10-18 11:36:12 |
| admitScout | `053d7eab7272c29415ee3c4f952b5c62923f42176550068aeb46b9996ad867b5` | 3034303 | 2026-10-18 11:40:54 |
| admitBuyer | `02b6d6c24fa857dcde2910414037ef9f5575f9c3c4ac3aceb1136c6ef6708711` | 3034608 | 2026-10-18 12:11:24 |
| createSideBMarket | `ffaf69f44025696c7cf6843e11ea44b30ec3966f528cac2817907d914dca454d` | 3037138 | 2026-10-18 16:24:24 |

## Sealed picks (10)

Scouts stake on a private option.

| Call | Transaction hash | Block | Time (UTC) |
| --- | --- | --- | --- |
| stake | `b7cdea635701d2a0b7d90e7e68003e053b757d0e29a1e272f44ddeb611fa550f` | 3034325 | 2026-10-18 11:43:06 |
| stake | `0380788dab3934577d75bc92d2945233008dac76598a99cc834e3ace6c7fcf85` | 3034342 | 2026-10-18 11:44:48 |
| stake | `ff6e64d2e33f1f3923215d936caf8a2e888a1b5464d2ec6e3931497bedf84a6c` | 3034359 | 2026-10-18 11:46:30 |
| stake | `32e339a580e52741996f279a3f822e3273d498bd28f21c0b6ed485a309678427` | 3034390 | 2026-10-18 11:49:36 |
| stake | `9ae8c309c98cb85527ad8b0eaa3416bb1cad184ab09b1c94656b5625365404b4` | 3034420 | 2026-10-18 11:52:36 |
| stake | `8e4159069664ef8099fcf0e3dc4039fe9c4c6df1bf820ada5c7ff1a6df63b858` | 3037154 | 2026-10-18 16:26:00 |
| stake | `cf26a83989e0778b729196632cebff95f5094b65b50e12d63cb863164142ef00` | 3037169 | 2026-10-18 16:27:30 |
| stake | `e234a331cb9e5e3cfceb4a5a6b2b17b2921dd12dbee367ac8004bec59a0f8c7c` | 3037184 | 2026-10-18 16:29:00 |
| stake | `f5658d50e52ef633f7d4018a574dd3a068ba6de3060a40e7b25bef0f94185943` | 3037198 | 2026-10-18 16:30:24 |
| stake | `996c5f118609d272d88c35f2967f53a5c94674551855bbdf0583c49a87dcf1c1` | 3037213 | 2026-10-18 16:31:54 |

## Close and committee preview (4)

Keeper closes, three committee members post the histogram.

| Call | Transaction hash | Block | Time (UTC) |
| --- | --- | --- | --- |
| close | `83d20a649c827c8aea111098e5fc49aa41cf26cd669565153729b4e0ec5ce8c6` | 3037457 | 2026-10-18 16:56:18 |
| postPreview | `d246ad2a3ccd541ba59e3f88be2b149e290a81d315ce905ab73e012fc0ce218f` | 3037466 | 2026-10-18 16:57:12 |
| postPreview | `d101d420831a7ec367ecb4abc401be4a267075912147310e9a1cd70e7f16f4e6` | 3037475 | 2026-10-18 16:58:06 |
| postPreview | `9307ec4e8bfee18536e1828965ca51e873d2bbc6c6eb23c464006be6a86ee4f1` | 3037483 | 2026-10-18 16:58:54 |

## Purchase and outcome (2)

Buyer buys a signal and reports the outcome.

| Call | Transaction hash | Block | Time (UTC) |
| --- | --- | --- | --- |
| buyFlat | `af89b18c43a93a17f21e61662d2bc14aa012a675b21134478595e6554c2cc95e` | 3037495 | 2026-10-18 17:00:06 |
| recordOutcome | `e38d5b1a0719d883d51b79df6a199b936df5ed264a4ffda9aef42a55c339bcb4` | 3037504 | 2026-10-18 17:01:00 |

## Hits and claims (5)

Winning scouts prove a hit without revealing their pick, then claim.

| Call | Transaction hash | Block | Time (UTC) |
| --- | --- | --- | --- |
| proveHit | `10f50a79fd530e2b272ed13d92041ef0da029b516745fc57d3a0f1a19f7e485b` | 3037580 | 2026-10-18 17:08:36 |
| proveHit | `a8b5a74d1e8fbc4c2659e500dbfb12359ceb3acf7c8042b122f1ba7ca2db8798` | 3037588 | 2026-10-18 17:09:24 |
| proveHit | `78bc1b8ce3f033c8a19c5ff2eaeb62b721fe13841e4629b2a1b79077f436df8b` | 3037596 | 2026-10-18 17:10:12 |
| proveHit | `81ca431dd4bc028821e4a854fe06b3009a9bdcf68b063ae4ec03a389c082f8fb` | 3037604 | 2026-10-18 17:11:00 |
| proveHit | `99140ff886db6a1346d42cfdf57697d60a5f704ce07cc0fed355be1e7bedef9a` | 3037612 | 2026-10-18 17:11:48 |
