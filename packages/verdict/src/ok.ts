import { Err } from "./err.ts"

import type { Result } from "./types.ts"

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

export const ok = <T>(value: T): Ok<T> => new Ok(value)