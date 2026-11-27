import { type Ok } from "./ok.ts"
import type { Result } from "./types.ts"

export class Err<E> {
	public readonly error: E
	
	constructor(error: E) {
		this.error = error
	}
	
	isOk(): this is Ok<never> {
		return false
	}
	
	isErr(): this is Err<E> {
		return true
	}
	
	match<R>(handlers: {Ok: (v: never) => R; Err: (e: E) => R}): R {
		return handlers.Err(this.error)
	}
	
	andThen<U, E2>(_fn: (val: never) => Result<U, E2>): Result<U, E | E2> {
		return this
	}
	
	async andThenAsync<U, E2>(
		_fn: (val: never) => Promise<Result<U, E2>>,
	): Promise<Result<U, E | E2>> {
		return this
	}
	
	orElse<T2, E2>(fn: (err: E) => Result<T2, E2>): Result<T2, E2> {
		return fn(this.error)
	}
	
	async orElseAsync<T2, E2>(
		fn: (err: E) => Promise<Result<T2, E2>>,
	): Promise<Result<T2, E2>> {
		return fn(this.error)
	}
	
	map<U>(_fn: (val: never) => U): Result<U, E> {
		return this
	}
	
	async mapAsync<U>(_fn: (val: never) => Promise<U>): Promise<Result<U, E>> {
		return this
	}
	
	mapErr<E2>(fn: (err: E) => E2): Result<never, E2> {
		return new Err(fn(this.error))
	}
	
	filter<E2>(
		_predicate: (val: never) => boolean,
		_onFalse: (val: never) => E2,
	): Result<never, E | E2> {
		return this
	}
	
	inspect(_fn: (val: never) => void): this {
		return this
	}
	
	inspectErr(fn: (err: E) => void): this {
		fn(this.error)
		return this
	}
	
	unwrap(): never {
		throw this.error instanceof Error
		      ? this.error
		      : new Error(`Called unwrap() on Err: ${String(this.error)}`)
	}
	
	expect(message: string): never {
		throw new Error(
			`${message}: ${this.error instanceof Error ? this.error.message : String(this.error)}`,
		)
	}
	
	unwrapOr<T2>(fallback: T2): T2 {
		return fallback
	}
	
	unwrapOrElse<T2>(fn: (err: E) => T2): T2 {
		return fn(this.error)
	}
	
	toNullable(): null {
		return null
	}
	
	toTuple(): [E, null] {
		return [this.error, null]
	}
}

export const err = <E>(error: E): Err<E> => new Err(error)