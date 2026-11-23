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

/**
 * @template E
 */
// export class Err<E> {
// 	public readonly error: E
//
// 	/**
// 	 * @template E error
// 	 * @param {E} error
// 	 */
// 	constructor(error: E) {
// 		this.error = error
// 	}
//
// 	/**
// 	 * @returns {this is Ok<never>}
// 	 * @example
// 	 * ```ts
// 	 * interface User { name: string; email: string }
// 	 *
// 	 * async function renderUserProfile(userId: string) {
// 	 *   // tryAsync catches fetch/network crashes automatically
// 	 *   const result = await tryAsync(() => fetchUserFromApi(userId));
// 	 *
// 	 *   // Type narrowing forces autocomplete for .error
// 	 *   if (result.isErr()) {
// 	 *     showNotification(`Could not load profile: ${result.error.reason}`)
// 	 *     return
// 	 *   }
// 	 *
// 	 *   // Type narrowing forces autocomplete for .value
// 	 *   renderHeader(result.value.name)
// 	 *   renderEmailInput(result.value.email)
// 	 * }
// 	 * ```
// 	 */
// 	isOk(): this is Ok<never> {
// 		return false
// 	}
//
// 	/**
// 	 * @returns {this is Err<E>}
// 	 */
// 	isErr(): this is Err<E> {
// 		return true
// 	}
//
// 	/**
// 	 * @template R result
// 	 * @template E error
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
// 	match<R>(handlers: {Ok: (v: never) => R; Err: (e: E) => R}): R {
// 		return handlers.Err(this.error)
// 	}
//
// 	/** Err execution: Ignores the function and passes the error forward.
// 	 *  We cast 'this' because the underlying 'T' type changes to 'U', but the error remains the same.
// 	 * @template U
// 	 * @template E2
// 	 * @param {(val: never) => Result<U, E2>} _fn
// 	 * @returns {Result<U, E2>}
// 	 *
// 	 * @example
// 	 * ```ts
// 	 * interface Token { tokenString: string }
// 	 * interface UserData { id: number; plan: string }
// 	 *
// 	 * // Dummy API functions returning Result types
// 	 * const login = () => new Ok<Token>({ tokenString: "secret-token" });
// 	 * const fetchProfile = (_t: Token) => new Err<{ reason: string }>({ reason: "Rate limit reached" });
// 	 * const fetchCachedProfile = () => new Ok<UserData>({ id: 42, plan: "free" });
// 	 *
// 	 * function runPipeline() {
// 	 *   const finalProfile = login()
// 	 *     // 1. If login succeeds, try to fetch the live profile
// 	 *     .andThen((token) => fetchProfile(token))
// 	 *
// 	 *     // 2. Since fetchProfile returned an Err, this step is automatically SKIPPED
// 	 *     .andThen((user) => new Ok(`User plan is ${user.plan}`))
// 	 *
// 	 *     // 3. The chain is in an Err state, so orElse catches it and recovers via cache
// 	 *     .orElse((err) => {
// 	 *       console.warn(`Live fetch failed (${err.reason}), falling back to cache...`)
// 	 *       return fetchCachedProfile()
// 	 *     });
// 	 *
// 	 *   // finalProfile is now an Ok containing the cached UserData!
// 	 *   console.log(finalProfile);
// 	 * }
// 	 * ```
// 	 */
// 	andThen<U, E2>(_fn: (val: never) => Result<U, E2>): Result<U, E> {
// 		return this as unknown as Result<U, E>
// 	}
//
// 	/**
// 	 * Err execution: Takes the error, runs the function, and returns the new Result.
// 	 * @template T2
// 	 * @template E2
// 	 * @param {(err: E) => Result<T2, E2>} fn
// 	 * @returns {Result<T2, E2>}
// 	 * @example
// 	 * ```ts
// 	 * const fetchPrimaryDB = (): Result<string, string> => new Err("Primary DB is down");
// 	 * const fetchBackupDB = (): Result<string, string> => new Ok("Data from Backup");
// 	 *
// 	 * // Chaining a fallback
// 	 * const dataResult = fetchPrimaryDB()
// 	 *   .orElse((err) => {
// 	 *     console.warn(`Switching to backup due to: ${err}`)
// 	 *     return fetchBackupDB()
// 	 *   });
// 	 *
// 	 * // dataResult will be Ok("Data from Backup")
// 	 * ```
// 	 */
// 	orElse<T2, E2>(fn: (err: E) => Result<T2, E2>): Result<T2, E2> {
// 		return fn(this.error)
// 	}
//
// 	/**
// 	 * Ignores the function since there's no success value to map
// 	 * @template U
// 	 * @template E
// 	 * @param {(val: never) => U} _fn
// 	 * @returns {Result<U, E>}
// 	 */
// 	map<U>(_fn: (val: never) => U): Result<U, E> {
// 		return this as unknown as Result<U, E>
// 	}
//
// 	/**
// 	 * Modifies the inner error and wraps it back up in an Err automatically
// 	 * @template E
// 	 * @template E2
// 	 * @param {(err: E) => E2} fn
// 	 * @returns {Result<never, E2>}
// 	 */
// 	mapErr<E2>(fn: (err: E) => E2): Result<never, E2> {
// 		return new Err(fn(this.error))
// 	}
// }
