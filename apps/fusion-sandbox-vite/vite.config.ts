import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { fusionPlugin } from "@synergy-js/fusion/vite";

export default defineConfig({
  optimizeDeps: {
    noDiscovery: true,
  },
  plugins: [solidPlugin(), fusionPlugin(), tailwindcss()],

  server: {
    // Layer 2: Tell the browser never to cache assets or virtual modules locally
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
    hmr: {
      overlay: false,
    },
    fs: {
      //allow: ["../../../"],
      strict: false,
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
});
