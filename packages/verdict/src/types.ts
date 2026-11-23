import { Err } from "./err.ts"
import { Ok } from "./ok.ts"

export type Result<T, E> = Ok<T> | Err<E>

/**
 * Establish a global error architecture.
 * This ensures the entire codebase uses consistent, structured error schemas that integrate seamlessly with the `Result` type.
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
	/** A human-readable message, safe to show to end users */
	message: string;
	/** Optional HTTP status code for API layer consistency */
	status?: number;
	/** Optional debugging metadata or original system error details */
	context?: Record<string, unknown>;
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

export type ResultTuple<T, E> = [error: null, data: T] | [error: E, data: null];
