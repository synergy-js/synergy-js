import type { AppError, Result, ResultTuple } from "./types";
/**
 * Type guard to check if any unknown caught object conforms to AppError contract.
 * @param err
 * @returns {err is AppError}
 */
export declare const isAppError: (err: unknown) => err is AppError;
/**
 *
 * @example
 * ```ts
 * const validateUsername = (name: string): Result<string, string> => {...}
 * const validateEmail = (email: string): Result<string, string> => {...}
 * const validateAge = (age: number): Result<number, string> => {...}
 *
 * function handleFormSubmit() {
 *   const formResults = [
 *     validateUsername("dev_123"),
 *     validateEmail("invalid-email"), // ❌ Will fail
 *     validateAge(25)
 *   ]
 *
 *   // Combines them into a single Result
 *   const combined = Result.all(formResults)
 *
 *   if (combined.isErr()) {
 *     console.error("Form validation failed on first error:", combined.error)
 *     return
 *   }
 *
 *   // If successful, 'combined.value' is typed as an array: [string, string, number]
 *   const [username, email, age] = combined.value
 *   saveUser(username, email, age)
 * }
 * ```
 *
 * @example
 * ```ts
 * const tupleResults = [
 *   new Ok("SessionActive" as const),
 *   new Ok(404),
 *   new Ok(true)
 * ] as const
 *
 * const combined = Result.all(tupleResults)
 *
 * if (combined.isOk()) {
 *   const [status, code, isVip] = combined.value
 *   // TypeScript strictly infers
 *   // status: "SessionActive"
 *   // code: number
 *   // isVip: boolean
 * }
 * ```
 */
export declare const result: {
  all: <const T extends readonly unknown[], E extends readonly unknown[]>(
    results: readonly [...{ [K in keyof T]: Result<T[K], E[number]> }],
  ) => Result<{ -readonly [K in keyof T]: T[K] }, E[number]>;
};
export declare function tryExecute<T>(fn: () => T): ResultTuple<T, Error>;
