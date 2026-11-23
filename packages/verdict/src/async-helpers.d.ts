import type { AppError, Result, RetryOptions } from "./types.ts";
declare class AsyncPipeline<T, E> {
  readonly promise: Promise<Result<T, E>>;
  constructor(promise: Promise<Result<T, E>>);
  /**
   * Chains another asynchronous operation that returns a Result.
   * Dynamically widens the error track type to accumulate new error variants (E | E2).
   */
  andThen<U, E2>(
    fn: (val: T) => Result<U, E2> | Promise<Result<U, E2>>,
  ): AsyncPipeline<U, E | E2>;
  /**
   * Transforms the success value directly.
   */
  map<U>(fn: (val: T) => U | Promise<U>): AsyncPipeline<U, E>;
  /**
   * Resolves the execution tree back into a concrete Result object
   */
  unwrap(): Promise<Result<T, E>>;
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
export declare const pipeAsync: <T, E>(
  initial: Result<T, E> | Promise<Result<T, E>>,
) => AsyncPipeline<T, E>;
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
export declare const tryAsync: <T, E = AppError>(
  fn: () => Promise<T>,
  optionsOrFallbackCode?: RetryOptions | string,
  fallbackCode?: string,
) => Promise<Result<T, E>>;
export {};
