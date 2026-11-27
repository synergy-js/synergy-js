import { Err } from "./err.ts"
import { Ok } from "./ok.ts"

/** A value that is either a successful `Ok<T>` or a failed `Err<E>`. */
export type Result<T, E> = Ok<T> | Err<E>

/**
 * Structured application error suitable for consistent Result and HTTP handling.
 *
 * @example
 * ```ts
 * export const Errors = {
 *   UserNotFound: (id: string): AppError => ({
 *     code: "USER_NOT_FOUND",
 *     message: `The user with ID "${id}" could not be located.`,
 *     status: 404,
 *   }),
 *   Unauthorized: (reason = "Session expired"): AppError => ({
 *     code: "UNAUTHORIZED",
 *     message: `Access denied: ${reason}`,
 *     status: 401,
 *   }),
 * }
 *
 * // Example Service
 * async function getUserData(id: string): Promise<Result<UserData, AppError>> {
 *   if (!id) {
 *     return new Err(Errors.Unauthorized("Missing active identifier"))
 *   }
 *
 *   // If fetch throws a standard network error, tryAsync wraps it as an AppError automatically
 *   return await tryAsync(
 *     () => api.fetchUser(id),
 *     "FETCH_USER_NETWORK_CRASH"
 *   )
 * }
 * ```
 */


export interface AppError {
	/** A stable, uppercase string code for machine filtering (e.g., 'AUTH_FAILED') */
	code: string;
	/** A human-readable description for diagnostics or user-facing handling. */
	message: string;
	/** Optional HTTP status code for API layer consistency */
	status?: number;
	/** Optional debugging metadata or original system error details */
	context?: Record<string, unknown>;
	/** Original thrown value, when the error wraps an exception. */
	cause?: unknown
}


/**
 * Extracts the "Ok" type from a Result
 * @template T ok
 * @template R
 * @example
 * ```ts
 * // If you are consuming a third-party function or an internal API, you can grab its return types automatically
 *
 * declare function fetchUserProfile(): Result<{ id: string; avatar: string }, HttpError>
 *
 * // TypeScript automatically extracts the exact shapes!
 * type UserProfileShape = InferOk<ReturnType<typeof fetchUserProfile>> // { id: string; avatar: string }
 * type UserErrorShape  = InferErr<ReturnType<typeof fetchUserProfile>> // HttpError
 * ```
 */
export type InferOk<R> = R extends Result<infer T, any> ? T : never;

/**
 * Extracts the "Err" type from a Result
 * @template R
 * @template E
 * @example
 * ```ts
 * // If you are consuming a third-party function or an internal API, you can grab its return types automatically
 *
 * declare function fetchUserProfile(): Result<{ id: string; avatar: string }, HttpError>
 *
 * // TypeScript automatically extracts the exact shapes!
 * type UserProfileShape = InferOk<ReturnType<typeof fetchUserProfile>> // { id: string; avatar: string }
 * type UserErrorShape  = InferErr<ReturnType<typeof fetchUserProfile>> // HttpError
 * ```
 */
export type InferErr<R> = R extends Result<any, infer E> ? E : never;

/** Go-style tuple representation returned by `Result.toTuple()`. */
export type ResultTuple<T, E> = [error: null, data: T] | [error: E, data: null];

/** Retry, cancellation, and error-mapping controls for `tryAsync`. */
export interface RetryOptions<E = AppError> {
	/** Maximum total calls to the operation, including the first call. Defaults to 1. */
	attempts?: number
	/** Delay before the first retry, in milliseconds. Defaults to 0. */
	delayMs?: number
	/** Multiplier applied to the delay after each retry. Defaults to 1. */
	backoffFactor?: number
	/** Randomize each delay between 0.8× and 1.2× its calculated value. */
	withJitter?: boolean
	/** Stop before another attempt and interrupt retry delays when aborted. */
	signal?: AbortSignal
	/** Return false to stop retrying after this failure. Attempt count starts at 1. */
	shouldRetry?: (err: unknown, attempt: number) => boolean
	/** Convert a thrown value, including abort reasons, to the desired error type. */
	mapError?: (cause: unknown) => E
}

/** Options accepted by `tryAsync`. */
export type TryAsyncOptions<E = AppError> = RetryOptions<E>