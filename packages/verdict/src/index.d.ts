/**
 * ### Type Guards: isOk/isErr
 * Great for early returns or simple conditional handling in UI components.
 * @example
 * ```ts
 * const result = await getUserData("user_999")
 *
 * if (result.isErr()) {
 *   // Flawless autocompletion on your unified global schema attributes
 *   logger.error(`[${result.error.code}] ${result.error.message}`, result.error.context)
 *
 *   showToast({
 *     intent: "danger",
 *     title: "Action Failed",
 *     body: result.error.message // Explicitly safe to render to the client
 *   })
 * }
 * ```
 *
 * ### Pipelines: andThen & orElse
 * Perfect for multistep workflows (like auth or processing) where you want to instantly drop out if any step fails, or gracefully fall back.
 *
 * ### Pattern Matching: match
 * Excellent when transforming a backend Result into a final status code, string, or UI block.
 *
 * ### Customizing Errors: mapErr
 * Perfect for turning generic errors (like network errors or system crashes) into descriptive, customer-facing errors early in your stack
 *
 * ### Combining Results: Result.all
 * When working with form submissions or parallel API calls, you often get back an array of Result objects. Dealing with them individually is tedious
 *
 *
 * @module Rustify
 * */
export { pipeAsync, tryAsync } from "./async-helpers.ts";
export { pipeSync, trySync } from "./sync-helpers.ts";
export { Ok } from "./ok.ts";
export { Err } from "./err.ts";
export type {
  AppError,
  InferErr,
  InferOk,
  Result,
  RetryOptions,
} from "./types.ts";
export { isAppError, result, tryExecute } from "./utils.ts";
