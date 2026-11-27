# @synergy-js/nexus

A small fetch-based RPC framework: declare routes with standard class decorators, bootstrap a server with a runtime adapter, and call it from a typed client.

## Features

- `@Route`, `@Get`, `@Post`, `@Patch`, `@Delete` decorators with `:param` path matching
- Route handlers receive path params, query strings, JSON bodies, `FormData`, or the raw `Request`
- Automatic response conversion: objects/arrays → JSON, strings → text, `null` → 204, `Response`/`BodyInit` passed through
- Interceptors at three tiers: global, controller (`@Route`) and method (`@Get` etc.)
- Runtime adapters for Node, Bun and Web-standard `fetch` handlers
- Typed proxy client generated from controller types via `createClient()`
- Route metadata supports providers/interceptors for integration with `@synergy-js/infusion`

## Note

Nexus uses TC39 stage 3 decorators, ensure your tsconfig.json contains the following:

```json
"compilerOptions": {
	"experimentalDecorators": false,
	"emitDecoratorMetadata": false
}
```

or simply omit these options as they are the default in TypeScript 5.8+

## Installation

```bash
pnpm add @synergy-js/nexus
```

## Quick start

```ts
// routes/users.ts
import { Get, Post, Route } from "@synergy-js/nexus"

@Route("users")
export class UsersController {
	@Get("/:id")
	byId(id: string) {
		return {id, name: "Ada"}
	}
	
	@Get("/")
	search(query: {q?: string}) {
		return {q: query.q ?? null}
	}
	
	@Post("/")
	create(body: {name: string}) {
		return {id: "1", ...body}
	}
}
```

```ts
// entry.ts
import { bootstrap, bunAdapter } from "@synergy-js/nexus"
import { UsersController } from "./routes/users"

await bootstrap({
	controllers: [UsersController],
	interceptors: [],
	adapter: bunAdapter({port: 3000}),
})
```

`GET /users/42` calls `byId("42")`; `GET /users?q=ada` calls `search({q: "ada"})`; a JSON `POST /users` passes the parsed body as the last argument.

## Interceptors

```ts
const logRequests = async (req: Request, next: (req?: Request) => Promise<unknown>) => {
	console.log(req.method, req.url)
	return next()
}

@Route("users", {interceptors: [logRequests]})
export class UsersController {
	@Get("/", {interceptors: [logRequests]})
	findAll() {
		return []
	}
}
```

Global interceptors are passed in `bootstrap({ interceptors: [...] })` and run before controller/method interceptors.

## Adapters

| Export | Runtime |
| --- | --- |
| `nodeAdapter({ port?, host?, ...serverOptions })` | `node:http`, listens on `0.0.0.0:3000` by default |
| `bunAdapter({ port?, hostname?, ...bunOptions })` | `Bun.serve` |
| `wcgAdapter(fetchHandler)` | Web-standard handler (Cloudflare Workers, edge runtimes, tests) |

Adapters are available from the root import and from `@synergy-js/nexus/adapters`. `bootstrap()` returns a `ServerInstance` with `fetch` and `stop()`.

## Typed client

```ts
import { createClient } from "@synergy-js/nexus/client"
import type { UsersController } from "./routes/users"

const api = createClient<{users: typeof UsersController}>({
	baseUrl: "",
	headers: () => ({Authorization: `Bearer ${token}`}),
	onError: (status, message) => console.error(status, message),
})

const user = await api.users.byId("42") // POST /_rpc/users/byId
```

The client POSTs JSON-encoded argument arrays to `/_rpc/<resource>/<method>`; expose matching routes on the server to use it. Arguments/results are inferred from the controller type.

## Entry points

- `@synergy-js/nexus` — decorators, `bootstrap` and adapters
- `@synergy-js/nexus/client` — `createClient` and client types
- `@synergy-js/nexus/adapters` — `nodeAdapter`, `bunAdapter`, `wcgAdapter`

## License

MIT
