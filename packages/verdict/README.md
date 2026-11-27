# Verdict

**Rust-inspired `Ok` / `Err` / `Result` driven primitives, pipelines, and resilient async execution.**

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
bun add verdict
# or
pnpm add verdict
# or
npm install verdict
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

### 5. Escape Hatches (`toTuple`, `toNullable`, `fromNullable`, `tryExecute`)

```ts
import { fromNullable, tryExecute } from "@synergy-js/verdict"

// Convert nullable values into Results
const tokenResult = fromNullable(process.env.API_TOKEN, () => ({
	code: "MISSING_TOKEN",
	message: "API_TOKEN is required",
}))

// Go-style [error, data] tuples when you don't want Result wrappers
const [err, parsed] = tryExecute(() => JSON.parse(input))
if(err) {
	console.error(err.message)
}
```

---

## API Reference

### Core Types

* **`Ok<T>` / `Err<E>`** — `isOk()`, `isErr()`, `map()`, `mapErr()`, `andThen()`, `orElse()`, `filter()`, `inspect()`, `inspectErr()`, `match()`, `unwrap()`, `expect()`, `unwrapOr()`, `unwrapOrElse()`, `toNullable()`, `toTuple()`
* **`ResultAsync<T, E>`** — Thenable (`PromiseLike<Result<T, E>>`) async wrapper supporting direct `await` and full async chaining.
* **`AppError`** — `{ code: string; message: string; status?: number; context?: Record<string, unknown>; cause?: unknown }`
* **Type Helpers** — `InferOk<R>`, `InferErr<R>`, `ResultTuple<T, E>`
