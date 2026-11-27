import { type Ok } from "./ok.ts"
import type { Result } from "./types.ts"

export class Err<E> {
	public readonly error: E
	
	/** Wrap a failure value in a Result. */
	constructor(error: E) {
		this.error = error
	}
	
	/** Return false for the failure branch. */
	isOk(): this is Ok<never> {
		return false
	}
	
	/** Narrow this Result to its failure branch. */
	isErr(): this is Err<E> {
		return true
	}
	
	/** Call the failure handler. */
	match<R>(handlers: {Ok: (v: never) => R; Err: (e: E) => R}): R {
		return handlers.Err(this.error)
	}
	
	/** Return this error unchanged. */
	andThen<U, E2>(_fn: (val: never) => Result<U, E2>): Result<U, E | E2> {
		return this
	}
	
	/** Return this error unchanged. */
	async andThenAsync<U, E2>(
		_fn: (val: never) => Promise<Result<U, E2>>,
	): Promise<Result<U, E | E2>> {
		return this
	}
	
	/** Replace or recover from the error with another Result. */
	orElse<T2, E2>(fn: (err: E) => Result<T2, E2>): Result<T2, E2> {
		return fn(this.error)
	}
	
	/** Asynchronously replace or recover from the error. */
	async orElseAsync<T2, E2>(
		fn: (err: E) => Promise<Result<T2, E2>>,
	): Promise<Result<T2, E2>> {
		return fn(this.error)
	}
	
	/** Return this error unchanged. */
	map<U>(_fn: (val: never) => U): Result<U, E> {
		return this
	}
	
	/** Return this error unchanged. */
	async mapAsync<U>(_fn: (val: never) => Promise<U>): Promise<Result<U, E>> {
		return this
	}
	
	/** Transform the error while preserving the failure state. */
	mapErr<E2>(fn: (err: E) => E2): Result<never, E2> {
		return new Err(fn(this.error))
	}
	
	/** Return this error unchanged; no success value is available to filter. */
	filter<E2>(
		_predicate: (val: never) => boolean,
		_onFalse: (val: never) => E2,
	): Result<never, E | E2> {
		return this
	}
	
	/** Return this error unchanged. */
	inspect(_fn: (val: never) => void): this {
		return this
	}
	
	/** Run a side effect for the error and return this Result. */
	inspectErr(fn: (err: E) => void): this {
		fn(this.error)
		return this
	}
	
	/** Throw the stored error; non-Error values are wrapped in Error. */
	unwrap(): never {
		throw this.error instanceof Error
		      ? this.error
		      : new Error(`Called unwrap() on Err: ${String(this.error)}`)
	}
	
	/** Throw an Error prefixed with the supplied message. */
	expect(message: string): never {
		throw new Error(
			`${message}: ${this.error instanceof Error ? this.error.message : String(this.error)}`,
		)
	}
	
	/** Return the supplied fallback. */
	unwrapOr<T2>(fallback: T2): T2 {
		return fallback
	}
	
	/** Compute and return a fallback from the error. */
	unwrapOrElse<T2>(fn: (err: E) => T2): T2 {
		return fn(this.error)
	}
	
	/** Convert a failure to null without throwing. */
	toNullable(): null {
		return null
	}
	
	/** Convert to the `[error, value]` tuple convention. */
	toTuple(): [E, null] {
		return [this.error, null]
	}
}

/** Construct an `Err` result. */
export const err = <E>(error: E): Err<E> => new Err(error)