import { isAppError } from "./utils.ts"
import { Err } from "./err.ts"
import { Ok } from "./ok.ts"
import type { AppError, Result } from "./types.ts"

/** Fluent synchronous operations that short-circuit after the first error. */
export class SyncPipeline<T, E> {
	private readonly _result: Result<T, E>
	
	constructor(result: Result<T, E>) {
		this._result = result
	}
	
	/** Chain a Result-producing step on success; preserve an existing error. */
	andThen<U, E2>(fn: (val: T) => Result<U, E2>): SyncPipeline<U, E | E2> {
		if(this._result.isErr()) {
			return this as unknown as SyncPipeline<U, E | E2>
		}
		return new SyncPipeline(fn(this._result.value))
	}
	
	/** Recover from an error with another Result; leave success unchanged. */
	orElse<T2, E2>(fn: (err: E) => Result<T2, E2>): SyncPipeline<T | T2, E2> {
		if(this._result.isOk()) {
			return this as unknown as SyncPipeline<T | T2, E2>
		}
		return new SyncPipeline(fn(this._result.error))
	}
	
	/** Transform the successful value; skip the callback after an error. */
	map<U>(fn: (val: T) => U): SyncPipeline<U, E> {
		if(this._result.isErr()) {
			return this as unknown as SyncPipeline<U, E>
		}
		return new SyncPipeline(this._result.map(fn))
	}
	
	/** Transform the error; skip the callback after success. */
	mapErr<E2>(fn: (err: E) => E2): SyncPipeline<T, E2> {
		if(this._result.isOk()) {
			return this as unknown as SyncPipeline<T, E2>
		}
		return new SyncPipeline(this._result.mapErr(fn))
	}
	
	/** Convert a success that fails a predicate into an error. */
	filter<E2>(
		predicate: (val: T) => boolean,
		onFalse: (val: T) => E2,
	): SyncPipeline<T, E | E2> {
		return new SyncPipeline(this._result.filter(predicate, onFalse))
	}
	
	/** Run a success-side effect without changing the pipeline. */
	inspect(fn: (val: T) => void): SyncPipeline<T, E> {
		this._result.inspect(fn)
		return this
	}
	
	/** Run an error-side effect without changing the pipeline. */
	inspectErr(fn: (err: E) => void): SyncPipeline<T, E> {
		this._result.inspectErr(fn)
		return this
	}
	
	/** Return the Result at the end of the pipeline. */
	unwrap(): Result<T, E> {
		return this._result
	}
	
	/** Return the success value or a fallback. */
	unwrapOr<T2>(fallback: T2): T | T2 {
		return this._result.unwrapOr(fallback)
	}
	
	/** Handle both outcomes and return the handler result. */
	match<R>(handlers: {Ok: (v: T) => R; Err: (e: E) => R}): R {
		return this._result.match(handlers)
	}
}

/** Start a fluent synchronous pipeline from an existing Result. */
export function pipeSync<T, E>(initial: Result<T, E>): SyncPipeline<T, E> {
	return new SyncPipeline(initial)
}

/**
 * Execute a function and convert thrown values into `Err`.
 * Existing AppError-shaped values are preserved; other errors use `fallbackCode`.
 */
export const trySync = <T, E = AppError>(
	fn: () => T,
	fallbackCode = "UNKNOWN_SYNC_ERROR",
): Result<T, E> => {
	try {
		return new Ok(fn())
	}
	catch(err) {
		if(isAppError(err)) return new Err(err as unknown as E)
		return new Err({
			code: fallbackCode,
			message: err instanceof Error ? err.message : String(err),
			cause: err,
		} as unknown as E)
	}
}
