import { Err } from "./err.ts"

import type { Result } from "./types.ts"

export class Ok<T> {
	public readonly value: T
	
	/** Wrap a successful value in a Result. */
	constructor(value: T) {
		this.value = value
	}
	
	/** Narrow this Result to its success branch. */
	isOk(): this is Ok<T> {
		return true
	}
	
	/** Return false for the success branch. */
	isErr(): this is Err<never> {
		return false
	}
	
	/** Call the success handler. */
	match<R>(handlers: {Ok: (v: T) => R; Err: (e: never) => R}): R {
		return handlers.Ok(this.value)
	}
	
	/** Transform the success value into another Result. */
	andThen<U, E2>(fn: (val: T) => Result<U, E2>): Result<U, E2> {
		return fn(this.value)
	}
	
	/** Transform the success value with an async Result-producing function. */
	async andThenAsync<U, E2>(
		fn: (val: T) => Promise<Result<U, E2>>,
	): Promise<Result<U, E2>> {
		return fn(this.value)
	}
	
	/** Return this success unchanged. */
	/** Return this success unchanged; no error value is available to recover. */
	orElse<T2, E2>(_fn: (err: never) => Result<T2, E2>): Result<T, E2> {
		return this
	}
	
	/** Replace the success value while preserving this Result's success state. */
	map<U>(fn: (val: T) => U): Result<U, never> {
		return new Ok(fn(this.value))
	}
	
	/** Asynchronously transform the success value. */
	async mapAsync<U>(fn: (val: T) => Promise<U>): Promise<Result<U, never>> {
		return new Ok(await fn(this.value))
	}
	
	/** Return this success unchanged. */
	mapErr<E2>(_fn: (err: never) => E2): Result<T, E2> {
		return this
	}
	
	/** Convert a success that fails a predicate into an error. */
	filter<E2>(
		predicate: (val: T) => boolean,
		onFalse: (val: T) => E2,
	): Result<T, E2> {
		return predicate(this.value) ? this : new Err(onFalse(this.value))
	}
	
	/** Run a side effect for the success value and return this Result. */
	inspect(fn: (val: T) => void): this {
		fn(this.value)
		return this
	}
	
	inspectErr(_fn: (err: never) => void): this {
		return this
	}
	
	/** Return the success value. */
	unwrap(): T {
		return this.value
	}
	
	/** Return the success value; the message is unused on this branch. */
	expect(_message: string): T {
		return this.value
	}
	
	/** Return the success value; the fallback is unused on this branch. */
	unwrapOr<T2>(_fallback: T2): T | T2 {
		return this.value
	}
	
	/** Return the success value; the callback is unused on this branch. */
	unwrapOrElse(_fn: (err: never) => T): T {
		return this.value
	}
	
	/** Convert to a nullable value without throwing. */
	toNullable(): T | null {
		return this.value
	}
	
	/** Convert to the `[error, value]` tuple convention. */
	toTuple(): [null, T] {
		return [null, this.value]
	}
}

/** Construct an `Ok` result. */
export const ok = <T>(value: T): Ok<T> => new Ok(value)