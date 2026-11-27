# @synergy-js/signals

### A lightweight, zero-dependency fine-grained reactivity system for TypeScript and JavaScript

---

## Features

- **Zero external dependencies** — built entirely on standard JavaScript primitives (`Set`, `Map`, `WeakMap`, `Proxy`, `Symbol`).
- **Fine-grained tracking** — automatic dependency tracking via `Object.is` equality checks.
- **Batched updates** — coalesce multiple state mutations into a single flush cycle with `batch`.
- **Deep reactive stores** — Proxy-based nested object and array reactivity with recipe-style mutations (`createStore`).
- **Async data fetching** — race-condition-safe resource primitive with reactive `loading` and `error` signals (`createResource`).
- **Lifecycle & Context management** — hierarchical ownership trees (`runWithOwner`, `onCleanup`) and typed context injection (`createBaseContext`, `useContext`).

---

## Installation

```bash
pnpm add @synergy-js/signals
```

---

## Quick Start

```ts
import { createSignal, createMemo, createEffect, batch } from "@synergy-js/signals"

const [count, setCount] = createSignal(1)
const doubled = createMemo(() => count() * 2)

createEffect(() => {
	console.log(`Count: ${count()}, Doubled: ${doubled()}`)
})
// Logs: "Count: 1, Doubled: 2"

batch(() => {
	setCount(2)
	setCount(3)
})
// Logs once: "Count: 3, Doubled: 6"
```

---

## API Reference

### Signals & Derivations

#### `createSignal<T>(initial: T): [Accessor<T>, Setter<T>]`

Creates a reactive state cell returning a `[read, write]` tuple.

- `read()` returns the current value and subscribes the active listener (effect or memo).
- `write(next)` accepts either a new value or an updater function `(prev: T) => T`. Updates are skipped if `Object.is(prev, next)` is `true`.

```ts
const [name, setName] = createSignal("Ada")
name() // "Ada"
setName((prev) => `${prev} Lovelace`)
```

#### `createMemo<T>(fn: () => T): Accessor<T>`

Creates a cached, read-only derived signal that re-evaluates only when its dependencies change and notifies downstream subscribers only when the computed result changes (`!Object.is(prev, next)`).

```ts
const [price, setPrice] = createSignal(10)
const [tax, setTax] = createSignal(0.2)
const total = createMemo(() => price() * (1 + tax()))
```

#### `createEffect(fn: () => void): void`

Runs `fn` immediately, tracks any signals or store properties read during execution, and re-runs whenever those dependencies update. Automatically cleans up previous subscriptions and inner `onCleanup` hooks before each re-run and when its parent `Owner` disposes.

```ts
createEffect(() => {
	const id = setInterval(() => console.log(count()), 1000)
	onCleanup(() => clearInterval(id))
})
```

---

### Batching & Untracking

#### `batch<T>(fn: () => T): T`

Defers running scheduled listeners until `fn` completes. Supports nested `batch` calls and flushes deduplicated listeners once the outermost batch exits.

```ts
batch(() => {
	setFirstName("Grace")
	setLastName("Hopper")
})
```

#### `untrack<T>(fn: () => T): T`

Executes `fn` without registering any signal or store reads as dependencies of the currently running effect or memo.

```ts
createEffect(() => {
	const current = count()
	const silent = untrack(() => otherSignal())
})
```

---

### Reactive Stores

#### `createStore<T extends object>(initial: T): [T, StoreSetter<T>]`

Wraps an object or array in a deep, lazily-cached `Proxy` that tracks property reads, property writes, deletions, and array length changes at the individual property level.

- Mutations are performed via `setStore(draft => { ... })`, which automatically wraps updates in `batch`.

```ts
const [state, setState] = createStore({
	user: {name: "Linus", active: true},
	todos: ["Build runtime"],
})

createEffect(() => {
	console.log("User:", state.user.name)
})

setState((draft) => {
	draft.user.name = "Torvalds"
	draft.todos.push("Ship v1")
})
```

---

### Async Resources

#### `createResource<T, S>(source?, fetcher): [Resource<T>, ResourceActions<T>]`

Manages asynchronous data fetching with automatic race-condition protection (stale in-flight requests are ignored when newer requests start).

- **Signatures:**
    - `createResource(fetcher)` — fetches immediately on creation.
    - `createResource(source, fetcher)` — re-fetches whenever `source()` changes, skipping fetches when `source()` returns `undefined`, `null`, or `false`.
- **Return tuple:**
    - `resource()` — returns the resolved data (`T | undefined`).
    - `resource.loading` — `Accessor<boolean>` indicating an active request.
    - `resource.error` — `Accessor<unknown>` holding any thrown error from the latest request.
    - `actions.mutate` — `Setter<T | undefined>` to manually update cached data.
    - `actions.refetch()` — re-invokes `fetcher` with the current `source()`.

```ts
const [userId, setUserId] = createSignal<string | null>("42")

const [user, {refetch, mutate}] = createResource(userId, async (id) => {
	const res = await fetch(`/api/users/${id}`)
	return res.json()
})

createEffect(() => {
	if(user.loading()) console.log("Loading...")
	else if(user.error()) console.error(user.error())
	else console.log("Loaded:", user())
})
```

---

### Ownership & Context

#### `runWithOwner<T>(fn: () => T, contextEntry?: { id: symbol; value: unknown }): { result: T; dispose: () => void }`

Creates an execution scope (`Owner`) that collects `onCleanup` callbacks and optionally attaches a context value. Calling `dispose()` runs all registered cleanups in reverse (LIFO) order.

#### `onCleanup(fn: () => void): void`

Registers a teardown callback on the current `Owner` (such as inside `createEffect` or `runWithOwner`).

#### `createBaseContext<T>(defaultValue: T): BaseContext<T>` & `useContext<T>(context: BaseContext<T>): T`

Creates a typed context token and resolves its nearest ancestor value up the `Owner` parent chain, falling back to `defaultValue` if none is provided.

```ts
const ThemeContext = createBaseContext<"light" | "dark">("light")

const {dispose} = runWithOwner(
	() => {
		const theme = useContext(ThemeContext) // "dark"
		onCleanup(() => console.log("Scope disposed"))
	},
	{id: ThemeContext.id, value: "dark"},
)

dispose()
```

---

## Exported Types

| Type | Definition |
| :--- | :--- |
| `Accessor<T>` | `() => T` |
| `Setter<T>` | `(next: T \| ((prev: T) => T)) => T` |
| `StoreSetter<T>` | `(recipe: (draft: T) => void) => void` |
| `Listener` | `(() => void) & { deps?: Set<Set<Listener>> }` |
| `Owner` | `{ parent: Owner \| null; cleanups: Array<() => void>; contexts: Map<symbol, unknown> }` |
| `BaseContext<T>` | `{ readonly id: symbol; readonly defaultValue: T }` |
| `Resource<T>` | `(() => T \| undefined) & { readonly loading: Accessor<boolean>; readonly error: Accessor<unknown> }` |
| `ResourceActions<T>` | `{ mutate: Setter<T \| undefined>; refetch: () => Promise<T \| undefined> }` |

---

## Acknowledgments

The reactive primitives and API design in this library (`createSignal`, `createMemo`, `createEffect`, `createStore`, `createResource`, and ownership/context trees) are heavily inspired by [SolidJS](https://solidjs.com) and the fine-grained reactivity work of [Ryan Carniato](https://github.com/ryansolid).