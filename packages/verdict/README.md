# Verdict

**Rust-inspired `Ok` / `Err` / `Result` primitives, fluent pipelines, and resilient async execution.**

---

## Why Verdict over `neverthrow`?

| Feature | Verdict | `neverthrow` |
| :--- | :--- | :--- |
| **Structured `AppError` out of the box** | ✅ Built-in `{ code, message, status, context }` | ❌ Manual `fromThrowable` wrappers everywhere |
| **Built-in async retries & backoff** | ✅ `attempts`, `delayMs`, `backoffFactor`, `withJitter` | ❌ Requires external retry libraries |
| **`AbortSignal` cancellation** | ✅ Native in `tryAsync` & retry sleep loops | ❌ Not supported |
| **Sync & Async Pipelines** | ✅ `pipeSync` & `pipeAsync` / `ResultAsync` | ⚠️ `ResultAsync` only |
| **Escape hatches (`toTuple`, `toNullable`)** | ✅ First-class interop with Go-style/nullable code | ❌ Refused by design |
| **Tuple-preserving `result.all`** | ✅ Strict heterogeneous tuple inference | ✅ `Result.combine` |

---

## Installation

```bash
bun add @synergy-js/verdict
# or
pnpm add @synergy-js/verdict
# or
npm install @synergy-js/verdict
```

---

## Quick Start

### 1. Wrapping Synchronous Operations (`trySync`)

```ts
import { trySync } from "@synergy-js/verdict"

interface Config {
	port: number
}

const parsed = trySync<Config>(
	() => JSON.parse(rawJson),
	"INVALID_CONFIG_JSON",
)

if(parsed.isErr()) {
	// Typed as AppError: { code, message, status?, context?, cause? }
	console.error(`[${parsed.error.code}] ${parsed.error.message}`)
}
else {
	console.log("Running on port:", parsed.value.port)
}

// Or handle both cases exhaustively:
const message = parsed.match({
	Ok: (config) => `Running on port ${config.port}`,
	Err: (error) => `Configuration failed: ${error.message}`,
})
```

### 2. Resilient Async Operations with Retries (`tryAsync`)

```ts
import { tryAsync } from "@synergy-js/verdict"

const controller = new AbortController()

const user = await tryAsync(
	async () => {
		const res = await fetch("https://example.com", {
			signal: controller.signal,
		})
		if(!res.ok) throw new Error(`HTTP ${res.status}`)
		return res.json() as Promise<{id: string; name: string}>
	},
	{
		attempts: 4,
		delayMs: 250,
		backoffFactor: 2,
		withJitter: true,
		signal: controller.signal,
		shouldRetry: (err) => !(err instanceof Error && err.message.includes("404")),
	},
	"FETCH_USER_FAILED",
)
	.map((u) => u.name)
	.unwrapOr("Guest")

// `user` is a string here: ResultAsync.unwrapOr() resolves to the value or fallback.
```

`attempts` counts total calls, not retries. The optional `signal` stops future calls and interrupts retry delays. Pass the same signal to the underlying operation (as with `fetch` above) to cancel in-flight work.

Awaiting a `ResultAsync` directly returns a `Result`, which can be narrowed or matched:

```ts
const result = await tryAsync(() => loadProfile(), "PROFILE_LOAD_FAILED")
const profile = result.match({
	Ok: (value) => value,
	Err: (error) => {
		console.error(error.code, error.message)
		return null
	},
})
```

### 3. Chaining Pipelines (`pipeSync` & `pipeAsync`)

```ts
import { Err, Ok, pipeAsync, tryAsync } from "@synergy-js/verdict"

const result = await pipeAsync(tryAsync(() => fetchOrder(orderId), "ORDER_FETCH_ERR"))
	.filter(
		(order) => order.items.length > 0,
		() => ({code: "EMPTY_ORDER", message: "Order has no items"}),
	)
	.andThen((order) => tryAsync(() => chargeCard(order), "PAYMENT_FAILED"))
	.orElse((err) => {
		console.warn("Primary payment failed, queuing fallback:", err.code)
		return new Ok({status: "QUEUED"})
	})
	.match({
		Ok: (receipt) => `Success: ${receipt.status}`,
		Err: (err) => `Failed: ${err.message}`,
	})
```

### 4. Combining Multiple Results (`result.all`)

```ts
import { Ok, Err, result } from "@synergy-js/verdict"

const combined = result.all([
	new Ok("admin" as const),
	new Ok(200),
	new Ok(true),
] as const)

if(combined.isOk()) {
	// Strictly inferred as ["admin", number, boolean]
	const [role, status, active] = combined.value
}
```

### 5. Escape Hatches (`toTuple`, `toNullable`, `fromNullable`)

```ts
import { Err, fromNullable, Ok } from "@synergy-js/verdict"

// Convert nullable values into Results
const tokenResult = fromNullable(process.env.API_TOKEN, () => ({
	code: "MISSING_TOKEN",
	message: "API_TOKEN is required",
}))

// Convert a Result to a Go-style [error, data] tuple at an integration boundary.
const [parseError, parsed] = new Ok(JSON.parse(input)).toTuple()
if(parseError) console.error(parseError.message)

const [failure, value] = new Err(new Error("Unavailable")).toTuple()
// failure is Error; value is null.
```

`tryExecute` is not part of this package's public API; use `trySync` or `tryAsync` to capture thrown errors.

### 6. Structured errors

Define stable error codes at application boundaries and preserve the original cause:

```ts
import { trySync, type AppError } from "@synergy-js/verdict"

const parseUser = (input: string) =>
	trySync<User, AppError>(
		() => JSON.parse(input) as User,
		"INVALID_USER_JSON",
	).mapErr((error) => ({
		...error,
		status: 400,
		context: {source: "request body"},
	}))
```

### 7. Async cancellation and error mapping

```ts
import { tryAsync } from "@synergy-js/verdict"

const controller = new AbortController()
const result = await tryAsync(
	() => fetch("/api/report", {signal: controller.signal}).then((response) => {
		if(!response.ok) throw new Error(`HTTP ${response.status}`)
		return response.json() as Promise<Report>
	}),
	{
		attempts: 3,
		delayMs: 100,
		backoffFactor: 2,
		signal: controller.signal,
		mapError: (cause) => ({
			code: controller.signal.aborted ? "CANCELLED" : "REPORT_FAILED",
			message: cause instanceof Error ? cause.message : String(cause),
			cause,
		}),
	},
)
```

---

## API Reference

### Core Types

* **`Ok<T>` / `Err<E>`** — Discriminated result classes with `isOk()` / `isErr()`, `match()`, `map()` / `mapErr()`, `andThen()` / `orElse()`, `filter()`, side-effect inspection, unwrapping, and tuple/nullable conversion.
* **`ResultAsync<T, E>`** — Thenable (`PromiseLike<Result<T, E>>`); `await` resolves to an `Ok` or `Err`, not the raw value. Supports async `map`, `mapErr`, `andThen`, `orElse`, `filter`, `match`, and conversions.
* **`AppError`** — `{ code: string; message: string; status?: number; context?: Record<string, unknown>; cause?: unknown }`
* **Type Helpers** — `InferOk<R>`, `InferErr<R>`, `ResultTuple<T, E>`
* **Factories and helpers** — `ok`, `err`, `trySync`, `tryAsync`, `pipeSync`, `pipeAsync`, `fromNullable`, `result.all` / `all`, `isAppError`

`result.all([...])` returns the first `Err`, or an `Ok` containing the positionally typed values when all entries succeed.
