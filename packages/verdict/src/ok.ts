import { Err } from "./err"

export type Result<T, E> = Ok<T> | Err<E>

export class Ok<T> {
	public readonly value: T
	
	constructor(value: T) {
		this.value = value
	}
	
	isOk(): this is Ok<T> {
		return true
	}
	
	isErr(): this is Err<never> {
		return false
	}
	
	match<R>(handlers: {Ok: (v: T) => R; Err: (e: never) => R}): R {
		return handlers.Ok(this.value)
	}
	
	andThen<U, E2>(fn: (val: T) => Result<U, E2>): Result<U, E2> {
		return fn(this.value)
	}
	
	async andThenAsync<U, E2>(
		fn: (val: T) => Promise<Result<U, E2>>,
	): Promise<Result<U, E2>> {
		return fn(this.value)
	}
	
	orElse<T2, E2>(_fn: (err: never) => Result<T2, E2>): Result<T, E2> {
		return this
	}
	
	map<U>(fn: (val: T) => U): Result<U, never> {
		return new Ok(fn(this.value))
	}
	
	async mapAsync<U>(fn: (val: T) => Promise<U>): Promise<Result<U, never>> {
		return new Ok(await fn(this.value))
	}
	
	mapErr<E2>(_fn: (err: never) => E2): Result<T, E2> {
		return this
	}
	
	filter<E2>(
		predicate: (val: T) => boolean,
		onFalse: (val: T) => E2,
	): Result<T, E2> {
		return predicate(this.value) ? this : new Err(onFalse(this.value))
	}
	
	inspect(fn: (val: T) => void): this {
		fn(this.value)
		return this
	}
	
	inspectErr(_fn: (err: never) => void): this {
		return this
	}
	
	unwrap(): T {
		return this.value
	}
	
	expect(_message: string): T {
		return this.value
	}
	
	unwrapOr<T2>(_fallback: T2): T | T2 {
		return this.value
	}
	
	unwrapOrElse(_fn: (err: never) => T): T {
		return this.value
	}
	
	toNullable(): T | null {
		return this.value
	}
	
	toTuple(): [null, T] {
		return [null, this.value]
	}
}


// export class Ok<T> {
// 	public readonly value: T
//
// 	constructor(value: T) {
// 		this.value = value
// 	}
//
// 	/**
// 	 * Type predicate tells TS: "If this returns true, 'this' is definitely Ok<T>"
// 	 * @template T
// 	 * @returns {this is Ok<T>}
// 	 */
// 	isOk(): this is Ok<T> {
// 		return true
// 	}
//
// 	/**
// 	 * @returns {this is Err<never>}
// 	 */
// 	isErr(): this is Err<never> {
// 		return false
// 	}
//
// 	/**
// 	 * @template T
// 	 * @template R
// 	 * @returns {R}
// 	 * @param handlers
// 	 * @example
// 	 * ```ts
// 	 * const pageText = result.match({
// 	 *   Ok: (data) => `Loaded: ${data}`,
// 	 *   Err: (err) => `Failed: ${err.reason}`,
// 	 * })
// 	 * ```
// 	 */
// 	match<R>(handlers: {Ok: (v: T) => R; Err: (e: never) => R}): R {
// 		return handlers.Ok(this.value)
// 	}
//
// 	/** Ok execution: Takes the inner value, runs the function, and returns the new Result
// 	 * @template T
// 	 * @template U
// 	 * @template E2
// 	 * @param {(val: T) => Result<U, E2>} fn
// 	 * @returns {Result<U, E2>}
// 	 */
// 	andThen<U, E2>(fn: (val: T) => Result<U, E2>): Result<U, E2> {
// 		return fn(this.value)
// 	}
//
// 	/**
// 	 * Ok execution: Ignores the function and passes itself forward.
// 	 * @template T2
// 	 * @template E2
// 	 * @param {(err: never) => Result<T2, E2>} _fn
// 	 * @returns {Result<T, E2>}
// 	 */
// 	orElse<T2, E2>(_fn: (err: never) => Result<T2, E2>): Result<T, E2> {
// 		return this as unknown as Result<T, E2>
// 	}
//
// 	/**
// 	 * Modifies the inner value and wraps it back up in an `Ok` automatically
// 	 * @template T
// 	 * @template U
// 	 * @param {(val: T) => U} fn
// 	 * @returns {Result<U, never>}
// 	 * @example
// 	 * ```ts
// 	 * const lengthResult = stringResult.map((str) => str.length)
// 	 * ```
// 	 */
// 	map<U>(fn: (val: T) => U): Result<U, never> {
// 		return new Ok(fn(this.value))
// 	}
//
// 	/**
// 	 * Ignores the function since it's not an error
// 	 * @template T
// 	 * @template E2
// 	 * @param {(err: never) => E2} _fn
// 	 * @returns {Result<T, E2>}
// 	 * @example
// 	 * ```ts
// 	 * interface AppError { code: string; displayMessage: string }
// 	 *
// 	 * const result = await tryAsync(() => fetch("/api/checkout"))
// 	 *   .mapErr((err): AppError => ({
// 	 *     code: "CHECKOUT_FAILED",
// 	 *     displayMessage: "We couldn't process your payment. Please try again."
// 	 *   }))
// 	 * ```
// 	 */
// 	mapErr<E2>(_fn: (err: never) => E2): Result<T, E2> {
// 		return this as unknown as Result<T, E2>
// 	}
// }
