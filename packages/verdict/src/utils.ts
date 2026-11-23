import { Ok } from "./ok.js"
import { Err } from "./err.js"
import type { AppError, Result, ResultTuple } from "./types"

/**
 * Type guard to check if any unknown caught object conforms to AppError contract.
 * @param err
 * @returns {err is AppError}
 */
export const isAppError = (err: unknown): err is AppError => {
	return (
		typeof err === "object" && err !== null && "code" in err && "message" in err
	)
}

/**
 *
 * @example
 * ```ts
 * const validateUsername = (name: string): Result<string, string> => {...}
 * const validateEmail = (email: string): Result<string, string> => {...}
 * const validateAge = (age: number): Result<number, string> => {...}
 *
 * function handleFormSubmit() {
 *   const formResults = [
 *     validateUsername("dev_123"),
 *     validateEmail("invalid-email"), // ❌ Will fail
 *     validateAge(25)
 *   ]
 *
 *   // Combines them into a single Result
 *   const combined = Result.all(formResults)
 *
 *   if (combined.isErr()) {
 *     console.error("Form validation failed on first error:", combined.error)
 *     return
 *   }
 *
 *   // If successful, 'combined.value' is typed as an array: [string, string, number]
 *   const [username, email, age] = combined.value
 *   saveUser(username, email, age)
 * }
 * ```
 *
 * @example
 * ```ts
 * const tupleResults = [
 *   new Ok("SessionActive" as const),
 *   new Ok(404),
 *   new Ok(true)
 * ] as const
 *
 * const combined = Result.all(tupleResults)
 *
 * if (combined.isOk()) {
 *   const [status, code, isVip] = combined.value
 *   // TypeScript strictly infers
 *   // status: "SessionActive"
 *   // code: number
 *   // isVip: boolean
 * }
 * ```
 */
export const result = {
	all: <const T extends readonly unknown[], E extends readonly unknown[]>(
		results: readonly [...{ [K in keyof T]: Result<T[K], E[number]> }],
	): Result<{ -readonly [K in keyof T]: T[K] }, E[number]> => {
		// 1. Flat runtime array matching the input size
		const values = new Array(results.length)
		
		for(let i = 0; i < results.length; i++) {
			const res = results[i]
			
			// 2. Short-circuit instantly if any element is an error
			if(res.isErr()) {
				return res as unknown as Result<
					{ -readonly [K in keyof T]: T[K] },
					E[number]
				>
			}
			
			// 3. Map indices strictly by numerical assignment rather than array pushing
			values[i] = res.value
		}
		
		return new Ok(values as { -readonly [K in keyof T]: T[K] })
	},
}

export function tryExecute<T>(fn: () => T): ResultTuple<T, Error> {
	try {
		return [null, fn()]
	}
	catch(err) {
		return [err instanceof Error ? err : new Error(String(err)), null]
	}
}

export const ok = <T>(value: T): Ok<T> => new Ok(value)

export const err = <E>(error: E): Err<E> => new Err(error)

export const trySync = <T, E = unknown>(
	fn: () => T,
	onError: (cause: unknown) => E = (cause) => cause as E,
): Result<T, E> => {
	try {
		return new Ok(fn())
	}
	catch(cause) {
		return new Err(onError(cause))
	}
}

export const tryAsync = async <T, E = unknown>(
	fn: () => Promise<T>,
	onError: (cause: unknown) => E = (cause) => cause as E,
): Promise<Result<T, E>> => {
	try {
		return new Ok(await fn())
	}
	catch(cause) {
		return new Err(onError(cause))
	}
}

export const fromNullable = <T, E>(
	value: T | null | undefined,
	onNull: () => E,
): Result<T, E> => {
	return value != null ? new Ok(value) : new Err(onNull())
}

export type UnwrapOk<R> = R extends Ok<infer T> ? T : never
export type UnwrapErr<R> = R extends Err<infer E> ? E : never

export const all = <const TResults extends readonly Result<unknown, unknown>[]>(
	results: TResults,
): Result<
	{ -readonly [K in keyof TResults]: UnwrapOk<TResults[K]> },
	UnwrapErr<TResults[number]>
> => {
	const values: unknown[] = []
	
	for(const res of results) {
		if(res.isErr()) {
			return res as Err<UnwrapErr<TResults[number]>>
		}
		values.push(res.value)
	}
	
	return new Ok(values) as Ok<{ -readonly [K in keyof TResults]: UnwrapOk<TResults[K]> }>
}

/**
 * @example
 * ```ts
 * const result = await ResultAsync.fromPromise(
 * 	fetch(`/api/users/${id}`),
 * 	() => ({ code: "NETWORK_ERROR" as const }),
 * )
 * 	.andThen((res) =>
 * 		res.ok ? ok(res) : err({ code: "HTTP_ERROR" as const, status: res.status }),
 * 	)
 * 	.map((res) => res.json() as Promise<User>)
 * 	.inspect((user) => console.log("Loaded user:", user.name))
 * ```
 */
export class ResultAsync<T, E> implements PromiseLike<Result<T, E>> {
	private readonly promise: Promise<Result<T, E>>
	
	constructor(promise: Promise<Result<T, E>>) {
		this.promise = promise
	}
	
	static fromPromise<T, E = unknown>(
		promise: Promise<T>,
		onError: (cause: unknown) => E = (cause) => cause as E,
	): ResultAsync<T, E> {
		return new ResultAsync(
			promise.then(
				(value) => new Ok(value),
				(cause) => new Err(onError(cause)),
			),
		)
	}
	
	static fromSafePromise<T>(promise: Promise<T>): ResultAsync<T, never> {
		return new ResultAsync(promise.then((value) => new Ok(value)))
	}
	
	static fromResult<T, E>(result: Result<T, E>): ResultAsync<T, E> {
		return new ResultAsync(Promise.resolve(result))
	}
	
	then<TResult1 = Result<T, E>, TResult2 = never>(
		onfulfilled?:
			
			| ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>)
			| null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): PromiseLike<TResult1 | TResult2> {
		return this.promise.then(onfulfilled, onrejected)
	}
	
	map<U>(fn: (val: T) => U | Promise<U>): ResultAsync<U, E> {
		return new ResultAsync(
			this.promise.then(async (res) =>
				res.isOk() ? new Ok(await fn(res.value)) : res,
			),
		)
	}
	
	mapErr<E2>(fn: (err: E) => E2 | Promise<E2>): ResultAsync<T, E2> {
		return new ResultAsync(
			this.promise.then(async (res) =>
				res.isErr() ? new Err(await fn(res.error)) : res,
			),
		)
	}
	
	andThen<U, E2>(
		fn: (val: T) => Result<U, E2> | Promise<Result<U, E2>> | ResultAsync<U, E2>,
	): ResultAsync<U, E | E2> {
		return new ResultAsync<U, E | E2>(
			this.promise.then(async (res): Promise<Result<U, E | E2>> =>
				res.isOk() ? await fn(res.value) : res,
			),
		)
	}
	
	orElse<T2, E2>(
		fn: (err: E) => Result<T2, E2> | Promise<Result<T2, E2>> | ResultAsync<T2, E2>,
	): ResultAsync<T | T2, E2> {
		return new ResultAsync<T | T2, E2>(
			this.promise.then(async (res): Promise<Result<T | T2, E2>> =>
				res.isErr() ? await fn(res.error) : res,
			),
		)
	}
	
	inspect(fn: (val: T) => void | Promise<void>): ResultAsync<T, E> {
		return new ResultAsync(
			this.promise.then(async (res) => {
				if(res.isOk()) await fn(res.value)
				return res
			}),
		)
	}
	
	inspectErr(fn: (err: E) => void | Promise<void>): ResultAsync<T, E> {
		return new ResultAsync(
			this.promise.then(async (res) => {
				if(res.isErr()) await fn(res.error)
				return res
			}),
		)
	}
	
	async unwrapOr<T2>(fallback: T2): Promise<T | T2> {
		const res = await this.promise
		return res.unwrapOr(fallback)
	}
	
	async match<R>(handlers: {
		Ok: (v: T) => R | Promise<R>
		Err: (e: E) => R | Promise<R>
	}): Promise<R> {
		const res = await this.promise
		return res.isOk() ? handlers.Ok(res.value) : handlers.Err(res.error)
	}
}
