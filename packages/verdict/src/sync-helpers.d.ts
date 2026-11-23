import type { AppError, Result } from "./types.ts";
declare class SyncPipeline<T, E> {
  private readonly _result;
  constructor(result: Result<T, E>);
  /**
   * Chains another synchronous operation that returns a Result.
   * @template T
   * @template E2
   * @template U
   * @template E
   * @param {(val: T) => Result<U, E2>} fn
   * @returns {SyncPipeline<U, E | E2>}
   */
  andThen<U, E2>(fn: (val: T) => Result<U, E2>): SyncPipeline<U, E | E2>;
  /**
   * Transforms the inner success value synchronously.
   * @template T
   * @template U
   * @template E
   * @param {(val: T) => U} fn
   * @returns {SyncPipeline<U, E>}
   */
  map<U>(fn: (val: T) => U): SyncPipeline<U, E>;
  /**
   * Extracts the underlying Result object.
   * @template T
   * @template E
   * @returns {Result<T, E>}
   */
  unwrap(): Result<T, E>;
}
/**
 * @template T
 * @template E
 * @param {Result<T, E>} initial
 * @returns {SyncPipeline<T, E>}
 *
 * Initiates a synchronous, short-circuiting operational pipeline.
 *
 * @example
 * ```ts
 * const processData = (rawString: string) =>
 *   pipeSync(trySync(() => JSON.parse(rawString))) // Result<any, AppError>
 *     .map((json) => json.payload)                 // Extract payload
 *     .andThen((payload) => validate(payload))     // Returns Result<ValidPayload, ValidationError>
 *     .unwrap()
 * ```
 */
export declare function pipeSync<T, E>(
  initial: Result<T, E>,
): SyncPipeline<T, E>;
/**
 * Explicit type assertions to avoid 'any' and runtime checking
 * @template T
 * @template E
 * @param {() => T} fn
 * @param fallbackCode
 * @returns {Result<T, E>}
 *
 * @example
 * ```ts
 * interface AppConfig {
 *   theme: "light" | "dark"
 *   retries: number
 * }
 *
 * function loadConfig(rawJson: string): Result<AppConfig, Error> {
 *   // Catches JSON syntax crashes
 *   return trySync<AppConfig, Error>(() => JSON.parse(rawJson))
 * }
 *
 * // 1. Success track
 * const goodConfig = loadConfig('{"theme": "dark", "retries": 3}')
 * if (goodConfig.isOk()) {
 *   console.log("Retries allowed:", goodConfig.value.retries) // Works!
 * }
 *
 * // 2. Failure track
 * const badConfig = loadConfig('{ corrupted json... }')
 * if (badConfig.isErr()) {
 *   console.error("Failed to parse configurations:", badConfig.error.message)
 * }
 * ```
 *
 * @example
 * ```ts
 * const getUserIdFromLocalStorage = (): string => {
 *   // Might throw an error if storage is blocked or empty
 *   const id = localStorage.getItem("current_user_id")
 *   if (!id) throw new Error("No user ID found in storage")
 *   return id
 * };
 *
 * // You can wrap local operations and immediately handle them or pipe them
 * const setupUser = trySync(() => getUserIdFromLocalStorage())
 *   .andThen((id) => {
 *     // If found, return an Ok with the formatted resource route
 *     return new Ok(`/api/users/${id}`)
 *   })
 * ```
 */
export declare const trySync: <T, E = AppError>(
  fn: () => T,
  fallbackCode: string,
) => Result<T, E>;
export {};
