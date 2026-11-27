# SynergyJS

TypeScript libraries for building web applications: fine-grained reactivity, dependency injection, RPC, HTTP, validation, logging, styling, and the build tooling that ties them together. Packages are published under the `@synergy-js/*` scope.

## Packages

### `@synergy-js/env-guard` — `packages/env-guard`

Type-safe validation of `process.env` through a small, composable schema API. `createEnv` returns a proxied object that parses values on access, so invalid configuration fails fast with clear errors.

- `e.string()`, `e.number()`, `e.boolean()`, `e.enum()` and `e.array()` builders
- Immutable refinements with `.refine()`, `.default()`, `.optional()` and `.error()`
- Lazy validation by default, or `eager: true` to validate at creation
- `validateAll()` aggregates every missing/invalid variable into one `EnvValidationError`

### `@synergy-js/fusion` — `packages/fusion`

Build-time server-function support for full-stack apps, available as separate Rsbuild and Vite plugins (`@synergy-js/fusion/rsbuild`, `@synergy-js/fusion/vite`). It turns `*.server.ts` modules into callable RPC functions while keeping server code out of the client bundle.

- Loader that discovers exported server functions and generates a server entry
- Client-side calls proxied through the `/fusion/rpc` dev middleware
- Runtime presets for `bun`, `node`, `cloudflare-workers` and generic targets
- Depends on `@synergy-js/scribe` and `@synergy-js/verdict`

### `@synergy-js/httpx` — `packages/httpx`

A thin, typed wrapper around `fetch` that removes the repetitive parts of HTTP client code.

- Typed responses via generics (`httpClient.get<User>(url)`)
- HTTP status codes (404, 500, …) throw catchable `HttpError` instances with response context
- Per-instance request, response and error interceptors
- Automatic JSON serialization of object bodies and safe handling of empty (204) responses

### `@synergy-js/infusion` — `packages/infusion`

A lightweight, type-safe dependency injection container for TypeScript and JavaScript with no `reflect-metadata` requirement.

- `@Service()` class decorators and functional `inject()` resolution
- Hierarchical scopes: `Singleton`, `Request` and `Transient`
- Typed `InjectionToken<T>` with defaults and container overrides
- Class/value/factory providers, multi-providers and `onDestroy()` cleanup
- Circular-dependency detection and pluggable context resolvers (e.g. `AsyncLocalStorage`)

### `@synergy-js/kinetic` — `packages/kinetic`

A fine-grained DOM JSX runtime and client-side router built on `@synergy-js/signals`. Components are setup functions that run once; DOM updates are driven by reactive effects rather than re-rendering.

- Automatic and development JSX runtimes with `mount()` and owner-aware disposal
- Reactive attribute/child handling, context, and control-flow components (`Show`, `For`, `Switch`, `Match`)
- Router with `Router`, `Outlet`, `A`, route loaders, params and location hooks
- Subpath exports: `.`, `./web`, `./router`, `./jsx-runtime`, `./jsx-dev-runtime`

### `@synergy-js/nexus` — `packages/nexus`

A small fetch-based RPC framework: declare routes with decorators on controller classes, bootstrap a server with an adapter, and call it from a typed client.

- `@Route`, `@Get`, `@Post`, `@Patch` and `@Delete` decorators with a route table
- Adapters for Node, Bun and Web-standard `fetch` handlers (`./adapters`)
- Interceptors and generated client via `createClient` (`./client`)
- Uses `@synergy-js/infusion` for service resolution

### `@synergy-js/prism` — `packages/prism`

An atomic CSS-in-JS engine with runtime theming and variant support.

- True atomic deduplication: each declaration is written to the stylesheet once as a `syn-*` class
- Constructable stylesheets (`adoptedStyleSheets`) instead of `<style>` tag mutations
- `cx()` with deterministic last-wins slot resolution for conflicting classes
- `defineTokens()` emits native CSS custom properties; `createVariants()` provides CVA-style recipes
- Full `csstype`-based autocomplete for properties, values and pseudo-selectors

### `@synergy-js/rsbuild-plugin-kinetic` — `packages/rsbuild-plugin-kinetic`

The Rsbuild/Rspack companion for Kinetic: configures the automatic JSX runtime and adds a pre-loader that rewrites `.tsx` files into fine-grained reactive DOM updates.

- Exports `jsxrPlugin()`
- Wires SWC's automatic runtime to Kinetic's JSX entry points
- Rewrites JSX props/children into getter thunks so reactivity survives compilation
- Also exposes `./jsx-runtime` and `./jsx-dev-runtime` type/runtime entry points

### `@synergy-js/scribe` — `packages/scribe`

A structured logger with named child contexts and pluggable transports.

- `trace`/`debug`/`info`/`warn`/`error` levels and `Scribe.child()` context scopes
- Console, file and remote-storage transports, plus level filtering with `withFilter`
- Color helpers and live-line output utilities
- Typed `LogPayload` / `LogTransport` interfaces for custom transports

### `@synergy-js/signals` — `packages/signals`

A zero-dependency, fine-grained reactivity system for TypeScript and JavaScript.

- `createSignal`, `createMemo`, `createEffect` with automatic dependency tracking and `batch()`
- Proxy-based deep stores via `createStore` and race-safe `createResource` for async data
- Ownership/cleanup (`runWithOwner`, `onCleanup`) and typed context (`createBaseContext`, `useContext`)
- Built entirely on standard JS primitives (`Set`, `Map`, `WeakMap`, `Proxy`, `Symbol`)

### `@synergy-js/tap` — `packages/tap`

Runtime-neutral async lifecycle hooks and plugin infrastructure for libraries and apps.

- Typed hook maps and a shared, typed context object
- Sequential `callHook` and parallel `callParallel` dispatch
- `definePlugin()` helper with full autocomplete over hooks and context
- Per-hook `beforeEach`/`afterEach` profiling with no runtime dependencies

### `@synergy-js/verdict` — `packages/verdict`

Rust-inspired `Ok`/`Err` result handling with batteries included for resilient async code.

- `trySync`/`tryAsync` with a structured `AppError` (`code`, `message`, `status`, `context`, `cause`)
- Built-in retries with exponential backoff, jitter and `AbortSignal` cancellation
- Sync and async pipelines (`pipeSync`, `pipeAsync`, `ResultAsync`), tuple-preserving `result.all`
- Escape hatches: `toTuple()`, `toNullable()`, `filter()` and other ergonomic helpers

## Contributing

1. Fork or branch from `main`.
2. Ensure tests and builds pass for affected packages.
3. Follow [Conventional Commits](https://conventionalcommits.org) (`feat(kinetic): ...`, `fix(verdict): ...`).

## License

[MIT](./LICENSE.md)

## Acknowledgements

[Rstack](https://rstack.rs) (`rsbuild, rstest, rslib`)

[Wireit](https://github.com/google/wireit)