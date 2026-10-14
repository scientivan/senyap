import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [react(), wasm()],
  build: { target: "esnext" },
  optimizeDeps: {
    include: [
      "@midnight-ntwrk/compact-runtime",
      "@midnight-ntwrk/midnight-js-protocol/compact-js",
      "@midnight-ntwrk/midnight-js-protocol/ledger",
      "@midnight-ntwrk/midnight-js-protocol/compact-runtime",
      "@midnight-ntwrk/midnight-js-contracts",
      "@midnight-ntwrk/midnight-js-fetch-zk-config-provider",
      "@midnight-ntwrk/midnight-js-indexer-public-data-provider",
      "@midnight-ntwrk/midnight-js-network-id",
    ],
    esbuildOptions: { target: "esnext" },
  },
  server: { port: 5174 },
});
