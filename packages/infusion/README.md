# Infusion

A lightweight, type-safe Dependency Injection (DI) container for TypeScript.

Built around standard ES class decorators (`@Service`), hierarchical container scopes, and functional `inject()` resolution without requiring `reflect-metadata`.

## Features

- **Zero `reflect-metadata` overhead**: Uses standard TypeScript/ES class decorators (`@Service`,) and functional `inject()` inside active container contexts or constructors.
- **Hierarchical Scoping**: Supports `"Singleton"` (cached on the root container across children), `"Request"` (isolated per child container), and `"Transient"` (fresh instance per resolution).
- **Injection Tokens with Fallbacks**: Type-safe `InjectionToken<T>` supporting default `factory` initializers as well as container-level overrides.
- **Flexible Providers**: Register classes directly, or use `{ provide, useClass }`, `{ provide, useValue }`, `{ provide, useFactory }`, and `multi: true` arrays.
- **Lifecycle Cleanup**: Automatically invokes `onDestroy()` (sync or async) on scoped instances when `await container.destroy()` is called.
- **Async & UI Context Hooks**: Plug in external context resolvers (such as `AsyncLocalStorage` or reactive UI trees) via `setContextResolver`.
- **Circular Dependency Detection**: Detects circular resolution chains and throws descriptive errors.

---

## Quick Start

### 1. Define Services & Inject Dependencies

Decorate classes with `@Service()` (which defaults to `scope: "Singleton"` and `autoProvided: true`) and resolve dependencies using `inject()`.

```ts
import { Service, inject } from "infusion"

@Service()
export class Logger {
	log(message: string) {
		console.log(`[LOG]: ${message}`)
	}
}

@Service()
export class UserService {
	private logger = inject(Logger)
	
	getUser(id: number) {
		this.logger.log(`Fetching user ${id}`)
		return {id, name: "Alice", role: "Admin"}
	}
}
```

### 2. Run Inside a Container Scope

Create an `Infusion` container and execute code inside `container.start()` so `inject()` resolves against that active container:

```ts
import { Infusion, inject } from "infusion"

const container = new Infusion()

container.start(() => {
	const userService = inject(UserService)
	console.log(userService.getUser(1))
})

// Clean up scoped instances implementing OnDestroy
await container.destroy()
```

---

## Decorators & Scopes

| Decorator | Default Metadata | Options |
| :--- | :--- | :--- |
| `@Service(options?)` | `{ scope: "Singleton", autoProvided: true, factory: undefined }` | `scope`, `autoProvided`, `factory` || `scope` |

### Scope Behavior

- **`"Singleton"`** *(default)*: Instantiated once and cached on the root container—the exact same instance is shared across the root container and all child containers.
- **`"Request"`**: Cached within the container where it is resolved, isolating instances across sibling child containers.
- **`"Transient"`**: Creates a fresh instance on every `get()` or `inject()` call.

```ts
import { Infusion, Service, inject } from "infusion"

@Service({scope: "Singleton"})
class SingletonSvc {
}

@Service({scope: "Request"})
class ScopedSvc {
}

@Service({scope: "Transient"})
class TransientSvc {
}

const root = new Infusion()
const childA = root.createChild()
const childB = root.createChild()

// Singletons are shared across root and children
const s1 = childA.start(() => inject(SingletonSvc))
const s2 = childB.start(() => inject(SingletonSvc))
// s1 === s2 && s1 === root.get(SingletonSvc)

// Request services are cached per child, isolated between siblings
const rA1 = childA.start(() => inject(ScopedSvc))
const rA2 = childA.start(() => inject(ScopedSvc))
const rB1 = childB.start(() => inject(ScopedSvc))
// rA1 === rA2 && rA1 !== rB1

// Transients always return a new instance
// root.get(TransientSvc) !== root.get(TransientSvc)
```

### Requiring Explicit Registration (`autoProvided: false`)

When `autoProvided: false` is set, attempting to resolve the service without registering it throws a `No provider found` error:

```ts
@Service({autoProvided: false})
class ExplicitSvc {
}

const root = new Infusion()
// root.get(ExplicitSvc) -> throws Error: [Dependency Injection] No provider found for ExplicitSvc.

const child = root.createChild([ExplicitSvc])
const instance = child.get(ExplicitSvc) // ExplicitSvc instance
```

---

## Injection Tokens

Use `InjectionToken<T>` for configuration objects, interfaces, or non-class values. You can provide an optional default `factory` function that resolves automatically when no explicit override is registered:

```ts
import { Infusion, InjectionToken, inject } from "infusion"

export interface User {
	id: number
	name: string
	role: string
}

export interface TestConfig {
	url?: string
	users: User[]
}

export const CONFIG_TOKEN = new InjectionToken<TestConfig>("CustomToken", {
	factory: () => ({
		users: [
			{id: 1, name: "Alice", role: "Admin"},
			{id: 2, name: "Bob", role: "Developer"},
		],
	}),
})

const container = new Infusion()

container.start(() => {
	const config = inject(CONFIG_TOKEN)
	console.log(config.users[0].name) // "Alice"
})
```

---

## Custom & Multi-Providers

Override tokens or register implementations using `container.register()` or `root.createChild(providers)`:

```ts
const API_URL = new InjectionToken<string>("API_URL")
const PLUGINS = new InjectionToken<Plugin>("PLUGINS")

container.register([
	{provide: API_URL, useValue: "https://example.com"},
	{provide: Logger, useClass: CustomLogger},
	{provide: UserService, useFactory: () => new UserService()},
	{provide: PLUGINS, useClass: AuthPlugin, multi: true},
	{provide: PLUGINS, useClass: MetricsPlugin, multi: true},
])

const plugins = container.get<Plugin[]>(PLUGINS)
```

---

## Lifecycle Management (`OnDestroy`)

Any cached service implementing `OnDestroy` will have its `onDestroy()` method awaited when `await container.destroy()` is called:

```ts
import { Infusion, Service, type OnDestroy } from "infusion"

@Service({scope: "Request"})
export class DatabaseConnection implements OnDestroy {
	async onDestroy() {
		// Close connections or release resources
	}
}

const root = new Infusion()
const child = root.createChild()

child.start(() => {
	inject(DatabaseConnection)
})

await child.destroy()
```

---

## Resolution Modifiers & External Contexts

### Resolution Options

Pass `InjectOptions` as the second argument to `inject()` or `container.get()`:

```ts
// Return null instead of throwing if unregistered
const optionalSvc = inject(OptionalService, {optional: true})

// Resolve only from the current container (do not walk up to parent)
const localSvc = inject(LocalService, {self: true})

// Skip the current container and resolve starting from the parent
const parentSvc = inject(ParentService, {skipSelf: true})
```

### External Context Resolver

For async server workflows (such as Node's `AsyncLocalStorage`) or UI component trees, register a fallback resolver when `container.start()` isn't on the call stack:

```ts
import { AsyncLocalStorage } from "node:async_hooks"
import { Infusion, setContextResolver } from "infusion"

const als = new AsyncLocalStorage<Infusion>()
setContextResolver(() => als.getStore())
```
