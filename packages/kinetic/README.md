# @synergy-js/kinetic

Fine-grained reactive DOM JSX and a client-side router, built on [`@synergy-js/signals`](../signals). Components run once as setup functions; updates are driven by signal-backed DOM effects rather than a virtual DOM.

## Features

- Automatic/development JSX runtimes with `mount()` and owner-aware disposal
- Reactive attributes, children and event handlers on native elements
- Control-flow components: `Show`, `For`, `Switch`/`Match`
- Typed context with `createContext(defaultValue)` and `<Context.Provider>`
- `mergeProps()` and `splitProps()` that preserve reactive getters
- Router with nested routes, `Outlet`, `A` links, params and route loaders
- `@synergy-js/signals` is a required peer dependency

For compiled JSX, pair this package with [`@synergy-js/rsbuild-plugin-kinetic`](../rsbuild-plugin-kinetic), which rewrites dynamic expressions into reactive thunks.

## Installation

```bash
pnpm add @synergy-js/kinetic @synergy-js/signals
# plus the build plugin when using JSX/TSX
pnpm add -D @synergy-js/rsbuild-plugin-kinetic
```

## Quick start

```tsx
import { mount } from "@synergy-js/kinetic/web"
import { createSignal } from "@synergy-js/signals"

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
import { For, Show } from "@synergy-js/kinetic/web"

<
Show
when = {user()}
fallback = {
<p>Loading…</p>
}>
{
	(value) => <h1>{value.name}</h1>
}
</Show>

<For each={todos()} fallback={<p>No todos</p>}>
	{(todo, index) => <li>{index() + 1}: {todo.title}</li>}
</For>
```

## Router

```tsx
import { A, Outlet, Router, useParams } from "@synergy-js/kinetic/router"
import { mount } from "@synergy-js/kinetic/web"

const Profile = () => <p>User: {useParams().id}</p>

const routes = [
	{path: "/", component: () => <A href="/users/42">Open profile</A>},
	{
		path: "users",
		component: () => <section><Outlet /></section>,
		children: [{path: ":id", component: Profile}],
	},
]

mount(() => <Router routes={routes} />, "#root")
```

A route may also define `loader: ({params}) => data | Promise<data>`; read its reactive result with `useRouteData()` (`data()` / `loading()`). `useLocation()` exposes the current path and `navigateTo(path)` performs client-side navigation.

## Entry points

| Import | Contents |
| --- | --- |
| `@synergy-js/kinetic` | Web runtime + router |
| `@synergy-js/kinetic/web` | `mount`, JSX runtimes, `Show`, `For`, `Switch`, `Match`, `createContext`, `mergeProps`, `splitProps` |
| `@synergy-js/kinetic/router` | `Router`, `Outlet`, `A`, hooks and route types |

## License

MIT
