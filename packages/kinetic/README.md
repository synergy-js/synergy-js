# @synergy-js/kinetic

Fine-grained reactive DOM JSX, signals, testing helpers, and a client-side router. Components run once as setup functions; updates are driven by signal-backed DOM effects rather than a virtual DOM.

## Features

- Automatic/development JSX runtimes with `mount()` and owner-aware disposal
- Reactive attributes, children and event handlers on native elements
- Control-flow components: `Show`, `For`, `Switch`/`Match`
- Typed context with `createContext(defaultValue)` and `<Context.Provider>`
- `mergeProps()` and `splitProps()` that preserve reactive getters
- Router with nested routes, `Outlet`, `A` links, params and route loaders
- Signals, stores, async resources, and test helpers are available from package subpaths

For compiled JSX, pair this package with [`@synergy-js/rsbuild-plugin-kinetic`](../rsbuild-plugin-kinetic), which rewrites dynamic expressions into reactive thunks.

## Installation

```bash
pnpm add @synergy-js/kinetic
# plus the build plugin when using JSX/TSX
pnpm add -D @synergy-js/rsbuild-plugin-kinetic
```

## Quick start

```tsx
import { mount } from "@synergy-js/kinetic/web"
import { createSignal } from "@synergy-js/kinetic/signals"

const Counter = () => {
	const [count, setCount] = createSignal(0)
	
	return (
		<button onClick={() => setCount((n) => n + 1)}>
			Count: {count()}
		</button>
	)
}

const dispose = mount(() => <Counter />, "#root")
// dispose() unmounts and cleans up effects
```

Control flow:

```tsx
import { For, Match, Show, Switch } from "@synergy-js/kinetic/web"

<Show when={user()} fallback={<p>Loading…</p>}>
	{(value) => <h1>{value.name}</h1>}
</Show>

<For each={todos()} fallback={<p>No todos</p>}>
	{(todo, index) => <li>{index() + 1}: {todo.title}</li>}
</For>

<Switch fallback={<p>Not found</p>}>
	<Match when={isLoading()}><p>Loading…</p></Match>
	<Match when={user()}>{(value) => <p>{value.name}</p>}</Match>
</Switch>
```

## Router

```tsx
import { A, Outlet, Router, useParams } from "@synergy-js/kinetic/router"
import { mount } from "@synergy-js/kinetic/web"

const Profile = () => <p>User: {useParams().id}</p>

const routes = [
	{path: "/", component: () => <A href="/users/42">Open profile</A>},
	{
		path: "/users",
		component: () => <section><Outlet /></section>,
		children: [{path: ":id", component: Profile}],
	},
]

mount(() => <Router routes={routes} />, "#root")
```

A route loader receives `{params, signal}` and may return data or a promise. Read its reactive result with `useRouteData()` (`data()`, `loading()`, and `error()`); the signal is aborted when that route is replaced or unmounted. Static routes take precedence over dynamic parameters, and nested routes render through `Outlet`.

`useParams()` exposes the active route params reactively. `useLocation()` returns the current pathname, query string, and hash. `navigateTo(path)` performs same-origin client navigation, while `A` preserves normal browser behavior for external, modified, targeted, and download links.

## Signals

Import signal primitives from `@synergy-js/kinetic/signals`:

```ts
import {
	batch,
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	runWithOwner,
} from "@synergy-js/kinetic/signals"

const [count, setCount] = createSignal(0)
const doubled = createMemo(() => count() * 2)
const owner = runWithOwner(() => {
	createEffect(() => {
		console.log(doubled())
		onCleanup(() => console.log("effect rerun or disposed"))
	})
})

batch(() => {
	setCount(1)
	setCount(2)
})
owner.dispose()
```

`createEffect` runs immediately and reruns when a value it reads changes. Register teardown with `onCleanup` inside the effect. Use `createStore(initial)` for property-level reactive objects and `createResource(source, fetcher)` for source-driven async data.

## Testing

The `@synergy-js/kinetic/testing` entry point provides DOM rendering and queries. Use it with a DOM environment such as happy-dom or jsdom:

```tsx
import { cleanup, render } from "@synergy-js/kinetic/testing"

const view = render(() => <button data-testid="save">Save</button>)
expect(view.getByText("Save")).toBeTruthy()
view.unmount()
cleanup() // unmount any other trees still registered by render()
```

The returned `unmount()` disposes the mounted reactive owner. `getByText` and `getByTestId` throw when there is no match; their `queryBy...` counterparts return `null`.

## Server rendering

`renderToString()` from `@synergy-js/kinetic/web` serializes basic JSX synchronously. It does not hydrate markup, and DOM-dependent control-flow components require a browser DOM.

## Entry points

| Import | Contents |
| --- | --- |
| `@synergy-js/kinetic` | Web runtime + router |
| `@synergy-js/kinetic/web` | `mount`, JSX runtimes, `Show`, `For`, `Switch`, `Match`, `createContext`, `mergeProps`, `splitProps` |
| `@synergy-js/kinetic/router` | `Router`, `Outlet`, `A`, hooks and route types |
| `@synergy-js/kinetic/signals` | signals, effects, memos, stores, resources, batching and ownership |
| `@synergy-js/kinetic/testing` | `render`, `cleanup`, and DOM query helpers |

## License

MIT
