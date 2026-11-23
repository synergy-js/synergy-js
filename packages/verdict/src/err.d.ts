import { type Ok } from "./ok.ts";
import type { Result } from "./types.ts";
/**
 * @template E
 */
export declare class Err<E> {
  readonly error: E;
  /**
   * @template E error
   * @param {E} error
   */
  constructor(error: E);
  /**
   * @returns {this is Ok<never>}
   * @example
   * ```ts
   * interface User { name: string; email: string }
   *
   * async function renderUserProfile(userId: string) {
   *   // tryAsync catches fetch/network crashes automatically
   *   const result = await tryAsync(() => fetchUserFromApi(userId));
   *
   *   // Type narrowing forces autocomplete for .error
   *   if (result.isErr()) {
   *     showNotification(`Could not load profile: ${result.error.reason}`)
   *     return
   *   }
   *
   *   // Type narrowing forces autocomplete for .value
   *   renderHeader(result.value.name)
   *   renderEmailInput(result.value.email)
   * }
   * ```
   */
  isOk(): this is Ok<never>;
  /**
   * @returns {this is Err<E>}
   */
  isErr(): this is Err<E>;
  /**
   * @template R result
   * @template E error
   * @returns {R}
   * @param handlers
   * @example
   * ```ts
   * const pageText = result.match({
   *   Ok: (data) => `Loaded: ${data}`,
   *   Err: (err) => `Failed: ${err.reason}`,
   * })
   * ```
   */
  match<R>(handlers: { Ok: (v: never) => R; Err: (e: E) => R }): R;
  /** Err execution: Ignores the function and passes the error forward.
   *  We cast 'this' because the underlying 'T' type changes to 'U', but the error remains the same.
   * @template U
   * @template E2
   * @param {(val: never) => Result<U, E2>} _fn
   * @returns {Result<U, E2>}
   *
   * @example
   * ```ts
   * interface Token { tokenString: string }
   * interface UserData { id: number; plan: string }
   *
   * // Dummy API functions returning Result types
   * const login = () => new Ok<Token>({ tokenString: "secret-token" });
   * const fetchProfile = (_t: Token) => new Err<{ reason: string }>({ reason: "Rate limit reached" });
   * const fetchCachedProfile = () => new Ok<UserData>({ id: 42, plan: "free" });
   *
   * function runPipeline() {
   *   const finalProfile = login()
   *     // 1. If login succeeds, try to fetch the live profile
   *     .andThen((token) => fetchProfile(token))
   *
   *     // 2. Since fetchProfile returned an Err, this step is automatically SKIPPED
   *     .andThen((user) => new Ok(`User plan is ${user.plan}`))
   *
   *     // 3. The chain is in an Err state, so orElse catches it and recovers via cache
   *     .orElse((err) => {
   *       console.warn(`Live fetch failed (${err.reason}), falling back to cache...`)
   *       return fetchCachedProfile()
   *     });
   *
   *   // finalProfile is now an Ok containing the cached UserData!
   *   console.log(finalProfile);
   * }
   * ```
   */
  andThen<U, E2>(_fn: (val: never) => Result<U, E2>): Result<U, E>;
  /**
   * Err execution: Takes the error, runs the function, and returns the new Result.
   * @template T2
   * @template E2
   * @param {(err: E) => Result<T2, E2>} fn
   * @returns {Result<T2, E2>}
   * @example
   * ```ts
   * const fetchPrimaryDB = (): Result<string, string> => new Err("Primary DB is down");
   * const fetchBackupDB = (): Result<string, string> => new Ok("Data from Backup");
   *
   * // Chaining a fallback
   * const dataResult = fetchPrimaryDB()
   *   .orElse((err) => {
   *     console.warn(`Switching to backup due to: ${err}`)
   *     return fetchBackupDB()
   *   });
   *
   * // dataResult will be Ok("Data from Backup")
   * ```
   */
  orElse<T2, E2>(fn: (err: E) => Result<T2, E2>): Result<T2, E2>;
  /**
   * Ignores the function since there's no success value to map
   * @template U
   * @template E
   * @param {(val: never) => U} _fn
   * @returns {Result<U, E>}
   */
  map<U>(_fn: (val: never) => U): Result<U, E>;
  /**
   * Modifies the inner error and wraps it back up in an Err automatically
   * @template E
   * @template E2
   * @param {(err: E) => E2} fn
   * @returns {Result<never, E2>}
   */
  mapErr<E2>(fn: (err: E) => E2): Result<never, E2>;
}
