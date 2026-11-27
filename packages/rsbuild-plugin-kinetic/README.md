# @synergy-js/rsbuild-plugin-kinetic

Rsbuild/Rspack plugin that compiles TSX for [`@synergy-js/kinetic`](../kinetic)'s fine-grained DOM runtime. It configures the automatic JSX runtime and adds a pre-loader that turns reactive reads into lazy thunks, so components do not need a virtual DOM.

## Features

- `jsxrPlugin()` — one line of configuration for Rstack/Rsbuild apps
- Automatic JSX runtime via SWC, with development and production runtime entry points
- Pre-loader applied to `.tsx` files (excluding `node_modules`)
- Dynamic DOM attributes and children are wrapped as `() => expression`, enabling `{count()}` without manual closures
- Dynamic component props become `__getters` and children become lazy `__children`, preserving reactivity across component boundaries
- Render props such as `<For>{(item) => ...}</For>` are left intact
- Source maps generated with `MagicString`/`oxc-parser`

## Installation

```bash
pnpm add -D @synergy-js/rsbuild-plugin-kinetic
pnpm add @synergy-js/kinetic @synergy-js/signals
```

## Usage

```ts
// rstack.config.ts
import { define } from "rstack"
import { jsxrPlugin } from "@synergy-js/rsbuild-plugin-kinetic"

define.app({
  plugins: [jsxrPlugin()],
})
```

Then write TSX normally and mount with Kinetic:

```tsx
import { mount } from "@synergy-js/kinetic/web"
import { createSignal } from "@synergy-js/signals"

const App = () => {
  const [count, setCount] = createSignal(0)
  return <button onClick={() => setCount((n) => n + 1)}>{count()}</button>
}

mount(() => <App />, "#root")
```

## Entry points

- `@synergy-js/rsbuild-plugin-kinetic` — `jsxrPlugin()`
- `@synergy-js/rsbuild-plugin-kinetic/jsx-runtime` and `.../jsx-dev-runtime` — JSX runtime entry points

## License

MIT
