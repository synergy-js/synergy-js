# @synergy-js/hookr

Zero-dependency, runtime-neutral async lifecycle hooks for modern JavaScript.

## Features

- **Zero dependencies**
- **Runs anywhere**: (`edge`, `server`,  `browser`)
- **Sequential & parallel execution** (`callHook` vs `callParallel`)
- **Typed shared context** with zero object mutation or property collisions
- **Zero-cost per-plugin profiling** via `beforeEach` / `afterEach`

## Installation

```bash
pnpm install @yourscope/hookr
```

## Quick Start

```ts
import { createHooks, definePlugin } from "@synergy-js/hookr"

// 1. Define your custom hooks & context types
type AppHooks = {
	"request": (req: Request) => void | Promise<void>
	"response": (res: Response) => void | Promise<void>
};

interface AppContext {
	env: string;
	db?: {close: () => Promise<void>}
}

// 2. Create the app instance
const app = createHooks<AppHooks, AppContext>({
	env: "production",
})

// 3. Bind a typed plugin helper
export const plugin = definePlugin<typeof app>()

// 4. Write plugins with full autocomplete on `context` and `hooks`
const dbPlugin = plugin(({context, hooks}) => {
	context.db = connectDatabase()
	
	hooks.hook("server:shutdown", async () => {
		await context.db?.close()
	})
})

await dbPlugin(app)

// 5. Trigger lifecycle hooks
await app.hooks.callHook("server:start", {port: 3000})
await app.hooks.callHook("request", new Request("https://example.com"))
```

## API

### `createHooks<CustomHooks, Context>(initialContext?)`

Returns `{ context, hooks }`. Built-in `SystemHooks` (`server:start`, `server:ready`, `server:shutdown`, `error`) are included automatically alongside your `CustomHooks`.

### `hook(name, fn, options?)`

Registers a listener and returns an unsubscribe function `() => void`.

- `options.name`: Optional plugin label used for profiling (defaults to `fn.name` or `"anonymous"`).

### `hookOnce(name, fn, options?)`

Registers a listener that automatically unsubscribes right before executing.

### `addHooks(config, options?)`

Bulk-registers a map of hooks (accepting single functions or arrays of functions) and returns a single unsubscribe function for the entire batch:

```ts
const unsub = app.hooks.addHooks(
	{
		"request": [logRequest, authGuard],
		"response": addHeaders,
	},
	{name: "core-middleware"}
);
```

### `callHook(name, ...args)`

Runs all registered listeners **sequentially** (`await` one after another). Ideal for request pipelines and mutating state.

### `callHookParallel(name, ...args)`

Runs all registered listeners **concurrently** (`Promise.all`). Ideal for telemetry, logging, and notifications.

### `removeAllHooks()`

Clears all registered hooks and trace listeners.

## Per-Plugin Profiling

Use `beforeEach` and `afterEach` to measure individual plugin execution times. When no trace listeners are attached, profiling has **zero runtime overhead**.

```ts
app.hooks.beforeEach((event) => {
	event.context.start = performance.now();
});

app.hooks.afterEach((event) => {
	const duration = (performance.now() - event.context.start).toFixed(2);
	console.log(`[${String(event.name)}] ${event.plugin}: ${duration}ms`);
});
```

## License

MIT
