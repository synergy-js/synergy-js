# @synergy-js/fusion

Build-time server functions for Rsbuild and Vite. Write normal exported functions in `*.server.ts` files, import them into client code, and Fusion replaces them with typed-in-practice `fetch` stubs while keeping the real implementation on the server.

## Features

- Separate plugins: `@synergy-js/fusion/rsbuild` and `@synergy-js/fusion/vite`
- `*.server.ts` files are transformed into client-side `fetch(...)` calls to `/fusion/rpc`
- Named exported functions and variables are discovered with `oxc-parser` (no annotations required)
- Development middleware evaluates server modules in-process
- Production builds emit a server entry (`dist/index.js`) from a runtime preset template
- Verbose/debug logging of function IDs and RPC endpoints via `logLevel`

## Installation

```bash
pnpm add @synergy-js/fusion
```

## Server functions

```ts
// src/getHomeDir.server.ts
import { homedir } from "node:os"

export const getHomeDir = () => homedir()
```

```tsx
// src/app.tsx — client code
import { getHomeDir } from "./getHomeDir.server"

const dir = await getHomeDir()
// -> fetch("/fusion/rpc?id=...&method=getHomeDir", {method: "POST", ...})
```

Server-only code never enters the client bundle: the loader replaces the named exports with stubs that POST the argument array and unwrap `result` from the JSON response. Only named exports are detected.

## Rsbuild / Rstack

```ts
import { define } from "rstack"
import { fusionPlugin } from "@synergy-js/fusion/rsbuild"

define.app({
  plugins: [
    fusionPlugin({
      preset: "bun",       // "bun" | "node" | "cloudflare-workers" | "generic"
      logLevel: "verbose", // "normal" | "debug" | "verbose"
    }),
  ],
})
```

The plugin registers a loader for `*.server.ts`, a server-entry generator plugin, and middleware at `/fusion/rpc` on the dev server. In production it writes a server entry from the template matching `preset`.

## Vite

```ts
import { fusionPlugin } from "@synergy-js/fusion/vite"

export default defineConfig({
  plugins: [fusionPlugin()],
})
```

The Vite plugin configures a `server` build environment (SSR output in `dist/server`), builds client and server environments, transforms `.server.ts` imports, and handles `/fusion/rpc` requests in dev using Vite's server module runner.

## License

MIT
