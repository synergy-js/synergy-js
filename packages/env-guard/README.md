# @synergy-js/env-guard

Type-safe environment variable validation for  `process.env`. Define a schema once, then read typed values from a proxy that parses and validates on access.

## Features

- Small schema builders for strings, numbers, booleans, enums and comma-separated arrays
- Immutable chaining: `.default()`, `.optional()`, `.refine()` and `.error()`
- Lazy validation on property access, or eager validation at creation time
- Aggregated `EnvValidationError` with one issue per invalid variable
- No runtime dependencies; TypeScript infers the shape of the returned environment object

## Installation

```bash
pnpm add @synergy-js/env-guard
```

## Quick start

```ts
import { createEnv, e } from "@synergy-js/env-guard"

const env = createEnv({
	PORT: e.number().default(3000),
	NODE_ENV: e.enum(["development", "production", "test"] as const),
	API_URL: e.string().refine((url) => url.startsWith("https://"), "must be HTTPS"),
	TAGS: e.array(e.string()).optional(),
})

env.PORT          // number
env.NODE_ENV      // "development" | "production" | "test"
```

Missing required variables throw a `ReferenceError` with the variable name; values that fail parsing/refinement throw a `TypeError` (or the message passed to `.error()`).

To validate everything up front and collect all failures into a single error:

```ts
import { createEnv, e, validateAll } from "@synergy-js/env-guard"

const schema = {
	PORT: e.number(),
	NODE_ENV: e.enum(["development", "production"] as const),
}

const env = createEnv(schema, {eager: true})
// or, later: validateAll(createEnv(schema))

try {
	validateAll(env)
}
catch(error) {
	// error is EnvValidationError; error.issues: Array<{key, message}>
}
```

## API

| Export | Purpose |
| --- | --- |
| `e.string()`, `e.number()`, `e.boolean()`, `e.enum(values)`, `e.array(builder)` | Create a `Builder<T>` for a `process.env` value |
| `builder.default(value)` | Fall back to `value` when the variable is missing/empty |
| `builder.optional()` | Allow the variable to be missing |
| `builder.refine(fn, message)` | Add a custom assertion; builders are immutable |
| `builder.error(message)` | Replace the generated error message |
| `builder.parse(value, name?)` | Parse a raw value directly (useful in tests) |
| `createEnv(schema, {eager?})` | Build the proxied, typed environment object |
| `validateAll(env)` | Touch every key and throw one aggregated `EnvValidationError` |

## License

MIT
