import { Err } from "./err.ts"
import { Ok } from "./ok.ts"
import type { Result, AppError } from "./types.ts"


export const fromNullable = <T, E>(
	value: T | null | undefined,
	onNull: () => E,
): Result<T, E> => {
	return value != null ? new Ok(value) : new Err(onNull())
}

export const isAppError = (err: unknown): err is AppError =>
	typeof err === "object" &&
	err !== null &&
	"code" in err &&
	typeof err.code === "string" &&
	"message" in err &&
	typeof err.message === "string"

export const result = {
	all: <const T extends readonly unknown[], E extends readonly unknown[]>(
		results: readonly [...{ [K in keyof T]: Result<T[K], E[number]> }],
	): Result<{ -readonly [K in keyof T]: T[K] }, E[number]> => {
		const values = new Array(results.length)
		
		for(let i = 0; i < results.length; i++) {
			const res = results[i]
			if(res.isErr()) {
				return res as unknown as Result<
					{ -readonly [K in keyof T]: T[K] },
					E[number]
				>
			}
			values[i] = res.value
		}
		
		return new Ok(values as { -readonly [K in keyof T]: T[K] })
	},
}

export const all: <const T extends readonly unknown[], E extends readonly unknown[]>(results: readonly [...{
	[K in keyof T]: Result<T[K], E[number]>;
}
]) => Result<{
	-readonly [K in keyof T]: T[K];
}, E[number]> = result.all
