import { type Err } from "./err";
import type { Result } from "./types.ts";
export declare class Ok<T> {
  readonly value: T;
  constructor(value: T);
  /**
   * Type predicate tells TS: "If this returns true, 'this' is definitely Ok<T>"
   * @template T
   * @returns {this is Ok<T>}
   */
  isOk(): this is Ok<T>;
  /**
   * @returns {this is Err<never>}
   */
  isErr(): this is Err<never>;
  /**
   * @template T
   * @template R
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
  match<R>(handlers: { Ok: (v: T) => R; Err: (e: never) => R }): R;
  /** Ok execution: Takes the inner value, runs the function, and returns the new Result
   * @template T
   * @template U
   * @template E2
   * @param {(val: T) => Result<U, E2>} fn
   * @returns {Result<U, E2>}
   */
  andThen<U, E2>(fn: (val: T) => Result<U, E2>): Result<U, E2>;
  /**
   * Ok execution: Ignores the function and passes itself forward.
   * @template T2
   * @template E2
   * @param {(err: never) => Result<T2, E2>} _fn
   * @returns {Result<T, E2>}
   */
  orElse<T2, E2>(_fn: (err: never) => Result<T2, E2>): Result<T, E2>;
  /**
   * Modifies the inner value and wraps it back up in an Ok automatically
   * @template T
   * @template U
   * @param {(val: T) => U} fn
   * @returns {Result<U, never>}
   * @example
   * ```ts
   * const lengthResult = stringResult.map((str) => str.length)
   * ```
   */
  map<U>(fn: (val: T) => U): Result<U, never>;
  /**
   * Ignores the function since it's not an error
   * @template T
   * @template E2
   * @param {(err: never) => E2} _fn
   * @returns {Result<T, E2>}
   * @example
   * ```ts
   * interface AppError { code: string; displayMessage: string }
   *
   * const result = await tryAsync(() => fetch("/api/checkout"))
   *   .mapErr((err): AppError => ({
   *     code: "CHECKOUT_FAILED",
   *     displayMessage: "We couldn't process your payment. Please try again."
   *   }))
   * ```
   */
  mapErr<E2>(_fn: (err: never) => E2): Result<T, E2>;
}
