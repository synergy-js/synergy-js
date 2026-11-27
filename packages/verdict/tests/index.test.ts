import { describe, expect, test } from "rstack/test"
import { err, fromNullable, isAppError, ok, pipeAsync, pipeSync, result, ResultAsync, tryAsync, trySync } from "../src"

describe("Ok and Err Primitives", () => {
	test("Ok methods transform, filter, and unwrap values", () => {
		const val = ok(10)
			.map((n) => n * 2)
			.andThen((n) => (n > 15 ? ok(n + 5) : err("too small")))
			.filter(
				(n) => n === 25,
				() => "wrong number",
			)
		
		expect(val.isOk()).toBe(true)
		expect(val.isErr()).toBe(false)
		expect(val.unwrap()).toBe(25)
		expect(val.unwrapOr(0)).toBe(25)
		expect(val.toNullable()).toBe(25)
		expect(val.toTuple()).toEqual([null, 25])
	})
	
	test("Err methods short-circuit and recover via orElse", () => {
		let mapCalled = false
		const failure = err("INITIAL_ERR")
			.map(() => {
				mapCalled = true
				return "never"
			})
			.mapErr((e) => `${e}_MAPPED`)
		
		expect(mapCalled).toBe(false)
		expect(failure.isErr()).toBe(true)
		expect(failure.unwrapOr("fallback")).toBe("fallback")
		expect(failure.toNullable()).toBeNull()
		expect(failure.toTuple()).toEqual(["INITIAL_ERR_MAPPED", null])
		
		const recovered = failure.orElse((e) => ok(`recovered from ${e}`))
		expect(recovered.unwrap()).toBe("recovered from INITIAL_ERR_MAPPED")
	})
	
	test("match() exhaustively handles Ok and Err", () => {
		const okMsg = ok(42).match({
			Ok: (n) => `value:${n}`,
			Err: () => "err",
		})
		const errMsg = err("boom").match({
			Ok: () => "ok",
			Err: (e) => `err:${e}`,
		})
		
		expect(okMsg).toBe("value:42")
		expect(errMsg).toBe("err:boom")
	})
})

describe("Synchronous Helpers (trySync & pipeSync)", () => {
	test("trySync captures thrown errors into AppError", () => {
		const good = trySync(() => JSON.parse("{\"a\":1}"), "PARSE_ERR")
		expect(good.unwrap()).toEqual({a: 1})
		
		const bad = trySync(() => JSON.parse("{bad"), "PARSE_ERR")
		expect(bad.isErr()).toBe(true)
		if(bad.isErr()) {
			expect(bad.error.code).toBe("PARSE_ERR")
			expect(typeof bad.error.message).toBe("string")
		}
	})
	
	test("trySync preserves thrown AppError objects as-is", () => {
		const customAppErr = {code: "CUSTOM_CODE", message: "Custom failure", status: 422}
		const res = trySync(() => {
			throw customAppErr
		}, "FALLBACK_CODE")
		
		expect(res.isErr()).toBe(true)
		if(res.isErr()) {
			expect(res.error).toEqual(customAppErr)
		}
	})
	
	test("pipeSync chains operations and short-circuits on Err", () => {
		const res = pipeSync(trySync(() => "  hello  ", "TRIM_ERR"))
			.map((s) => s.trim())
			.andThen((s) => (s.length > 0 ? ok(s.toUpperCase()) : err({code: "EMPTY", message: "Empty"})))
			.unwrap()
		
		expect(res.unwrap()).toBe("HELLO")
	})
})

describe("Asynchronous Helpers (tryAsync, pipeAsync, ResultAsync)", () => {
	test("tryAsync resolves Ok and supports direct chaining", async () => {
		const chained = await tryAsync(async () => ({message: "IT WORKED!"}), "NET_ERR")
			.map((data) => data.message)
			.unwrapOr("fallback")
		
		expect(chained).toBe("IT WORKED!")
	})
	
	test("tryAsync retries transient failures and succeeds", async () => {
		let attempts = 0
		
		const res = await tryAsync(
			async () => {
				attempts++
				if(attempts < 3) {
					throw new Error("Temporary glitch")
				}
				return "recovered"
			},
			{attempts: 4, delayMs: 5},
			"RETRY_EXHAUSTED",
		)
		
		expect(attempts).toBe(3)
		expect(res.unwrap()).toBe("recovered")
	})
	
	test("tryAsync stops retrying when shouldRetry returns false", async () => {
		let attempts = 0
		
		const res = await tryAsync(
			async () => {
				attempts++
				throw new Error("Fatal 404")
			},
			{
				attempts: 5,
				delayMs: 5,
				shouldRetry: (e) => !(e instanceof Error && e.message.includes("404")),
			},
			"NOT_FOUND",
		)
		
		expect(attempts).toBe(1)
		expect(res.isErr()).toBe(true)
	})
	
	test("tryAsync aborts immediately when AbortSignal is triggered", async () => {
		const controller = new AbortController()
		controller.abort()
		
		const res = await tryAsync(
			async () => "should not run",
			{signal: controller.signal},
			"ERR",
		)
		
		expect(res.isErr()).toBe(true)
		if(res.isErr()) {
			expect(res.error.code).toBe("ABORTED")
		}
	})
	
	test("pipeAsync chains async steps and recovers with orElse", async () => {
		const out = await pipeAsync(tryAsync(async () => 5, "ERR"))
			.map(async (n) => n * 2)
			.andThen(async (n) => (n > 20 ? ok(n) : err({code: "TOO_LOW", message: "Low"})))
			.orElse(async (e) => ok(`fallback:${e.code}`))
			.unwrap()
		
		expect(out.unwrap()).toBe("fallback:TOO_LOW")
	})
	
	test("ResultAsync static constructors work cleanly", async () => {
		const fromSafe = await ResultAsync.fromSafePromise(Promise.resolve("safe")).unwrap()
		expect(fromSafe.unwrap()).toBe("safe")
		
		const fromRejected = await ResultAsync.fromPromise(
			Promise.reject(new Error("fail")),
			() => "MAPPED_ERR",
		).unwrap()
		expect(fromRejected.isErr()).toBe(true)
		if(fromRejected.isErr()) {
			expect(fromRejected.error).toBe("MAPPED_ERR")
		}
	})
})

describe("Utility Helpers (result.all, fromNullable, tryExecute, isAppError)", () => {
	test("result.all combines heterogeneous tuples and short-circuits on Err", () => {
		const success = result.all([ok("session" as const), ok(200), ok(true)] as const)
		expect(success.unwrap()).toEqual(["session", 200, true])
		
		const failure = result.all([ok("a"), err("FIRST_ERR"), err("SECOND_ERR")])
		expect(failure.isErr()).toBe(true)
		if(failure.isErr()) {
			expect(failure.error).toBe("FIRST_ERR")
		}
	})
	
	test("fromNullable converts null/undefined to Err and values to Ok", () => {
		expect(fromNullable("present", () => "NULL_ERR").unwrap()).toBe("present")
		expect(fromNullable(null, () => "NULL_ERR").isErr()).toBe(true)
		expect(fromNullable(undefined, () => "UNDEF_ERR").isErr()).toBe(true)
	})
	
	
	test("isAppError validates shape strictly", () => {
		expect(isAppError({code: "ERR", message: "msg"})).toBe(true)
		expect(isAppError({code: 123, message: "msg"})).toBe(false)
		expect(isAppError(new Error("standard error"))).toBe(false)
		expect(isAppError(null)).toBe(false)
	})
})
