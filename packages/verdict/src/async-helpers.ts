import { Err } from "./err.ts"
import { Ok } from "./ok.ts"
import type { AppError, Result, TryAsyncOptions } from "./types.ts"
import { isAppError } from "./utils.ts"

/**
 * Unified, thenable async Result wrapper.
 * Supports direct `await` (via PromiseLike) as well as fluent chaining.
 */
/**
 * Unified, thenable async Result wrapper.
 * Supports direct `await` (via PromiseLike) as well as fluent chaining.
 */
export class ResultAsync<T, E> implements PromiseLike<Result<T, E>> {
	public readonly promise: Promise<Result<T, E>>
	
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
	
	static fromResult<T, E>(
		result: Result<T, E> | Promise<Result<T, E>>,
	): ResultAsync<T, E> {
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
			this.promise.then(async (res): Promise<Result<U, E>> => {
				if(res.isErr()) return res
				return new Ok(await fn(res.value))
			}),
		)
	}
	
	mapErr<E2>(fn: (err: E) => E2 | Promise<E2>): ResultAsync<T, E2> {
		return new ResultAsync(
			this.promise.then(async (res): Promise<Result<T, E2>> => {
				if(res.isOk()) return res
				return new Err(await fn(res.error))
			}),
		)
	}
	
	andThen<U, E2>(
		fn: (val: T) => Result<U, E2> | Promise<Result<U, E2>> | ResultAsync<U, E2>,
	): ResultAsync<U, E | E2> {
		return new ResultAsync<U, E | E2>(
			this.promise.then(async (res): Promise<Result<U, E | E2>> => {
				if(res.isErr()) return res
				const next = fn(res.value)
				return next instanceof ResultAsync ? next.promise : next
			}),
		)
	}
	
	orElse<T2, E2>(
		fn: (err: E) => Result<T2, E2> | Promise<Result<T2, E2>> | ResultAsync<T2, E2>,
	): ResultAsync<T | T2, E2> {
		return new ResultAsync<T | T2, E2>(
			this.promise.then(async (res): Promise<Result<T | T2, E2>> => {
				if(res.isOk()) return res
				const next = fn(res.error)
				return next instanceof ResultAsync ? next.promise : next
			}),
		)
	}
	
	filter<E2>(
		predicate: (val: T) => boolean | Promise<boolean>,
		onFalse: (val: T) => E2 | Promise<E2>,
	): ResultAsync<T, E | E2> {
		return new ResultAsync<T, E | E2>(
			this.promise.then(async (res): Promise<Result<T, E | E2>> => {
				if(res.isErr()) return res
				return (await predicate(res.value))
				       ? res
				       : new Err(await onFalse(res.value))
			}),
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
	
	async unwrap(): Promise<Result<T, E>> {
		return this.promise
	}
	
	async unwrapOr<T2>(fallback: T2): Promise<T | T2> {
		const res = await this.promise
		return res.unwrapOr(fallback)
	}
	
	async unwrapOrElse<T2>(fn: (err: E) => T2 | Promise<T2>): Promise<T | T2> {
		const res = await this.promise
		return res.isOk() ? res.value : fn(res.error)
	}
	
	async toNullable(): Promise<T | null> {
		const res = await this.promise
		return res.toNullable()
	}
	
	async toTuple(): Promise<[E, null] | [null, T]> {
		const res = await this.promise
		return res.toTuple()
	}
	
	async match<R>(handlers: {
		Ok: (v: T) => R | Promise<R>
		Err: (e: E) => R | Promise<R>
	}): Promise<R> {
		const res = await this.promise
		return res.isOk() ? handlers.Ok(res.value) : handlers.Err(res.error)
	}
}

export function pipeAsync<T, E>(
	initial: Result<T, E> | Promise<Result<T, E>> | ResultAsync<T, E>,
): ResultAsync<T, E>

export function pipeAsync<T, E = unknown>(
	initial: Promise<T> | (() => Promise<T>),
	onError: (cause: unknown) => E,
): ResultAsync<T, E>

export function pipeAsync<T, E>(
	initial:
		| Result<T, E>
		| Promise<Result<T, E>>
		| ResultAsync<T, E>
		| Promise<T>
		| (() => Promise<T>),
	onError?: (cause: unknown) => E,
): ResultAsync<T, E> {
	if(initial instanceof ResultAsync) {
		return initial
	}
	
	if(onError) {
		const rawPromise = typeof initial === "function" ? initial() : initial
		return ResultAsync.fromPromise(rawPromise as Promise<T>, onError)
	}
	
	return ResultAsync.fromResult(
		initial as Result<T, E> | Promise<Result<T, E>>,
	)
}


const sleep = (ms: number, signal?: AbortSignal): Promise<void> => {
	if(!signal) {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}
	if(signal.aborted) {
		return Promise.reject(
			signal.reason ?? new DOMException("Aborted", "AbortError"),
		)
	}
	return new Promise((resolve, reject) => {
		const onAbort = () => {
			clearTimeout(timer)
			reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
		}
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", onAbort)
			resolve()
		}, ms)
		signal.addEventListener("abort", onAbort, {once: true})
	})
}

export function tryAsync<T>(
	fn: () => Promise<T>,
	optionsOrFallbackCode?: Omit<TryAsyncOptions<AppError>, "mapError"> | string,
	fallbackCode?: string,
): ResultAsync<T, AppError>

export function tryAsync<T, E>(
	fn: () => Promise<T>,
	options: TryAsyncOptions<E> & {mapError: (cause: unknown) => E},
	fallbackCode?: string,
): ResultAsync<T, E>

export function tryAsync<T, E = AppError>(
	fn: () => Promise<T>,
	optionsOrFallbackCode?: TryAsyncOptions<E> | string,
	fallbackCode = "UNKNOWN_ASYNC_ERROR",
): ResultAsync<T, E | AppError> {
	const execute = async (): Promise<Result<T, E | AppError>> => {
		const opts =
			typeof optionsOrFallbackCode === "object" ? optionsOrFallbackCode : {}
		
		const code =
			typeof optionsOrFallbackCode === "string"
			? optionsOrFallbackCode
			: fallbackCode
		
		const attempts = Math.max(1, opts.attempts ?? 1)
		const backoffFactor = opts.backoffFactor ?? 1
		const withJitter = opts.withJitter ?? false
		let currentDelay = opts.delayMs ?? 0
		
		for(let currentAttempt = 1; currentAttempt <= attempts; currentAttempt++) {
			if(opts.signal?.aborted) {
				const abortErr =
					opts.signal.reason ?? new DOMException("Aborted", "AbortError")
				return new Err(
					opts.mapError
					? opts.mapError(abortErr)
					: {
							code: "ABORTED",
							message: "Operation was aborted.",
							cause: abortErr,
						},
				)
			}
			
			try {
				return new Ok(await fn())
			}
			catch(err) {
				const canRetry =
					currentAttempt < attempts &&
					(!opts.shouldRetry || opts.shouldRetry(err, currentAttempt))
				
				if(canRetry) {
					if(currentDelay > 0) {
						const jitterMultiplier = withJitter
						                         ? Math.random() * 0.4 + 0.8
						                         : 1
						try {
							await sleep(currentDelay * jitterMultiplier, opts.signal)
						}
						catch(abortErr) {
							return new Err(
								opts.mapError
								? opts.mapError(abortErr)
								: {
										code: "ABORTED",
										message: "Operation was aborted.",
										cause: abortErr,
									},
							)
						}
						currentDelay *= backoffFactor
					}
					continue
				}
				
				if(opts.mapError) {
					return new Err(opts.mapError(err))
				}
				
				if(isAppError(err)) {
					return new Err(err)
				}
				
				return new Err({
					code,
					message: err instanceof Error ? err.message : String(err),
					cause: err,
				})
			}
		}
		
		return new Err({
			code,
			message: "Execution failed unexpectedly.",
		})
	}
	
	return new ResultAsync(execute())
}