import { Err } from "./err.ts"
import { Ok } from "./ok.ts"
import type { AppError, Result } from "./types.ts"

export class AsyncPipeline<T, E> implements PromiseLike<Result<T, E>> {
	public readonly promise: Promise<Result<T, E>>
	
	constructor(promise: Promise<Result<T, E>>) {
		this.promise = promise
	}
	
	then<TResult1 = Result<T, E>, TResult2 = never>(
		onfulfilled?:
			| ((value: Result<T, E>) => TResult1 | PromiseLike<TResult1>)
			| null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): PromiseLike<TResult1 | TResult2> {
		return this.promise.then(onfulfilled, onrejected)
	}
	
	andThen<U, E2>(fn: (val: T) => Result<U, E2> | Promise<Result<U, E2>> | AsyncPipeline<U, E2>): AsyncPipeline<U, E | E2> {
		const nextPromise = this.promise.then(
			async (result): Promise<Result<U, E | E2>> => {
				if(result.isErr()) {
					return result
				}
				const next = fn(result.value)
				if(next instanceof AsyncPipeline) {
					return next.promise
				}
				return next
			},
		)
		
		return new AsyncPipeline(nextPromise)
	}
	
	map<U>(fn: (val: T) => U | Promise<U>): AsyncPipeline<U, E> {
		const nextPromise = this.promise.then(
			async (result): Promise<Result<U, E>> => {
				if(result.isErr()) {
					return result
				}
				return new Ok(await fn(result.value))
			},
		)
		
		return new AsyncPipeline(nextPromise)
	}
	
	mapErr<E2>(fn: (err: E) => E2 | Promise<E2>): AsyncPipeline<T, E2> {
		const nextPromise = this.promise.then(
			async (result): Promise<Result<T, E2>> => {
				if(result.isOk()) {
					return result
				}
				return new Err(await fn(result.error))
			},
		)
		
		return new AsyncPipeline(nextPromise)
	}
	
	async unwrap(): Promise<Result<T, E>> {
		return this.promise
	}
	
	orElse<T2, E2>(fn: (err: E) => Result<T2, E2> | Promise<Result<T2, E2>> | AsyncPipeline<T2, E2>): AsyncPipeline<T | T2, E2> {
		const nextPromise = this.promise.then(
			async (result): Promise<Result<T | T2, E2>> => {
				if(result.isOk()) {
					return result
				}
				const next = fn(result.error)
				if(next instanceof AsyncPipeline) {
					return next.promise
				}
				return next
			},
		)
		
		return new AsyncPipeline(nextPromise)
	}
	
	inspect(fn: (val: T) => void | Promise<void>): AsyncPipeline<T, E> {
		const nextPromise = this.promise.then(
			async (result): Promise<Result<T, E>> => {
				if(result.isOk()) {
					await fn(result.value)
				}
				return result
			},
		)
		
		return new AsyncPipeline(nextPromise)
	}
	
	inspectErr(fn: (err: E) => void | Promise<void>): AsyncPipeline<T, E> {
		const nextPromise = this.promise.then(
			async (result): Promise<Result<T, E>> => {
				if(result.isErr()) {
					await fn(result.error)
				}
				return result
			},
		)
		
		return new AsyncPipeline(nextPromise)
	}
	
	async unwrapOr<T2>(fallback: T2): Promise<T | T2> {
		const result = await this.promise
		return result.unwrapOr(fallback)
	}
	
	async match<R>(handlers: {
		Ok: (v: T) => R | Promise<R>
		Err: (e: E) => R | Promise<R>
	}): Promise<R> {
		const result = await this.promise
		return result.isOk() ? handlers.Ok(result.value) : handlers.Err(result.error)
	}
}

/**
 * Initiates an asynchronous, short-circuiting operational pipeline.
 */
/**
 * @template T
 * @template E
 * @param {Result<T, E> | Promise<Result<T, E>>} initial
 * @returns {AsyncPipeline<T, E>}
 * @example
 * ```ts
 * const jobExecution = await pipeAsync(trySync(() => readPayloadFile()))
 *   .andThen((payload) =>
 *     // This step will try to hit the server up to 5 times before failing the whole pipe
 *     tryAsync(
 *       () => sendAnalyticsData(payload),
 *       { attempts: 5, delayMs: 500 },
 *       "ANALYTICS_UPLOAD_CRASH"
 *     )
 *   )
 *   .unwrap();
 *
 * if (jobExecution.isErr()) {
 *   console.error("Job permanently failed:", jobExecution.error.message);
 * }
 * ```
 */
export function pipeAsync<T, E>(initial: Result<T, E> | Promise<Result<T, E>> | AsyncPipeline<T, E>): AsyncPipeline<T, E>

export function pipeAsync<T, E = unknown>(initial: Promise<T> | (() => Promise<T>), onError: (cause: unknown) => E): AsyncPipeline<T, E>

export function pipeAsync<T, E>(
	initial:
		| Result<T, E>
		| Promise<Result<T, E>>
		| AsyncPipeline<T, E>
		| Promise<T>
		| (() => Promise<T>),
	onError?: (cause: unknown) => E,
): AsyncPipeline<T, E> {
	if(initial instanceof AsyncPipeline) {
		return initial
	}
	
	if(onError) {
		const rawPromise = typeof initial === "function" ? initial() : initial
		return new AsyncPipeline(
			(rawPromise as Promise<T>).then(
				(val) => new Ok(val),
				(cause) => new Err(onError(cause)),
			),
		)
	}
	
	return new AsyncPipeline(
		Promise.resolve(initial as Result<T, E> | Promise<Result<T, E>>),
	)
}

/**
 * @template T
 * @template E
 * @returns {Promise<Result<T, E>>}
 * @param fn
 * @param optionsOrFallbackCode
 * @param fallbackCode
 *
 * @example
 * ```ts
 * async function queryDatabase() {
 *   const queryResult = await tryAsync(
 *     () => db.executeRaw("UPDATE metrics SET status = 'processed'"),
 *     {
 *       attempts: 4,
 *       delayMs: 250,        // Start small (250ms)
 *       backoffFactor: 2,    // Double it every loop (250ms -> 500ms -> 1000ms)
 *       withJitter: true     // Soften the precise timing
 *     },
 *     "DATABASE_LOCK_TIMEOUT"
 *   );
 *
 *   if (queryResult.isErr()) {
 *     console.error("Permanently failed to clear db lock:", queryResult.error.message)
 *   }
 * }
 * ```
 */
export interface RetryOptions<E = AppError> {
	attempts?: number
	delayMs?: number
	backoffFactor?: number
	withJitter?: boolean
	signal?: AbortSignal
	shouldRetry?: (err: unknown, attempt: number) => boolean
	mapError?: (cause: unknown) => E
}

const isAppErrorLike = (err: unknown): err is AppError =>
	typeof err === "object" &&
	err !== null &&
	"code" in err &&
	typeof err.code === "string" &&
	"message" in err &&
	typeof err.message === "string"

const sleep = (ms: number, signal?: AbortSignal): Promise<void> => {
	if(!signal) {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}
	if(signal.aborted) {
		return Promise.reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
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

type TryAsyncOptions<E = AppError> = RetryOptions & {
	signal?: AbortSignal
	shouldRetry?: (err: unknown, attempt: number) => boolean
	mapError?: (cause: unknown) => E
}

export async function tryAsync<T>(
	fn: () => Promise<T>,
	optionsOrFallbackCode?: Omit<TryAsyncOptions<AppError>, "mapError"> | string,
	fallbackCode?: string,
): Promise<Result<T, AppError>>
export async function tryAsync<T, E>(
	fn: () => Promise<T>,
	options: TryAsyncOptions<E> & {mapError: (cause: unknown) => E},
	fallbackCode?: string,
): Promise<Result<T, E>>
export async function tryAsync<T, E = AppError>(
	fn: () => Promise<T>,
	optionsOrFallbackCode?: TryAsyncOptions<E> | string,
	fallbackCode = "UNKNOWN_ASYNC_ERROR",
): Promise<Result<T, E | AppError>> {
	{
		{
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
						: {code: "ABORTED", message: "Operation was aborted.", cause: abortErr},
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
							const jitterMultiplier = withJitter ? Math.random() * 0.4 + 0.8 : 1
							try {
								await sleep(currentDelay * jitterMultiplier, opts.signal)
							}
							catch(abortErr) {
								return new Err(
									opts.mapError
									? opts.mapError(abortErr)
									: {code: "ABORTED", message: "Operation was aborted.", cause: abortErr},
								)
							}
							currentDelay *= backoffFactor
						}
						continue
					}
					
					if(opts.mapError) {
						return new Err(opts.mapError(err))
					}
					
					if(isAppErrorLike(err)) {
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
	}
}