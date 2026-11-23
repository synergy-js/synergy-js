/**
 * 1. Immutable Chains: Building types via e.number().refine(...) nests structural invariants.
 *
 * 2. Strict Proxied Entry: If any required environment criteria are breached or missing, the process aborts instantly and displays a custom error.
 *
 * 3. State Isolation: Because `typed-env` acts as a pure, zero-side-effect gateway, every single test block is instantly isolated by default.
 *
 * @module Typed-Env
 */

export type ValidatorFn<T> = (v: unknown) => T

export type EnvSchema = Record<string, Builder<any>>

export type InferredEnv<S extends EnvSchema> = {
	readonly [K in keyof S]: S[K] extends Builder<infer T> ? T : never
}

export class Builder<T> {
	private readonly _parse: ValidatorFn<T>
	
	public readonly customErrorMessage?: string
	
	private readonly refinements: Array<(val: T) => boolean> = []
	
	constructor(parse: ValidatorFn<T>, customErrorMessage?: string, refinements: Array<(val: T) => boolean> = []) {
		this._parse = parse
		this.customErrorMessage = customErrorMessage
		this.refinements = refinements
	}
	
	public parse = (v: unknown): T => {
		const parsed = this._parse(v)
		for(const refineCheck of this.refinements) {
			if(!refineCheck(parsed)) {
				throw new TypeError(
					this.customErrorMessage || "Refinement validation failed.",
				)
			}
		}
		return parsed
	}
	
	public refine(assertion: (val: T) => boolean, message: string): Builder<T> {
		const newRefinements = [...this.refinements, (val: T): boolean => {
			if(!assertion(val)) {
				throw new Error(message)
			}
			return true
		},
		]
		return new Builder(this._parse, this.customErrorMessage, newRefinements)
	}
	
	public error(message: string): Builder<T> {
		return new Builder(this._parse, message, this.refinements)
	}
}

export const e = {
	string: (): Builder<string> =>
		new Builder((v: unknown): string => {
			if(typeof v !== "string") {
				throw new Error("must be a string")
			}
			return v
		}),
	
	number: (): Builder<number> =>
		new Builder((v: unknown): number => {
			if(typeof v === "number") {
				if(isNaN(v)) throw new Error("must be a valid number")
				return v
			}
			if(typeof v === "string") {
				const num = Number(v)
				if(isNaN(num) || v.trim() === "")
					throw new Error("must be a valid number")
				return num
			}
			throw new Error("must be a valid number")
		}),
	
	boolean: (): Builder<boolean> => new Builder((v: unknown): boolean => {
		if(typeof v === "boolean") {
			return v
		}
		if(typeof v === "string") {
			return v === "true" || v === "1"
		}
		throw new Error("must be a boolean conversion target")
	}),
	
	enum: <T extends string>(values: readonly T[]): Builder<T> => new Builder((v: unknown): T => {
		if(typeof v !== "string" || !values.includes(v as T)) {
			throw new Error(`must be one of: ${values.join(", ")}`)
		}
		return v as T
	}),
	
	array: <T>(itemBuilder: Builder<T>): Builder<T[]> => new Builder((v: unknown): T[] => {
		let rawItems: unknown[] = []
		if(Array.isArray(v)) {
			rawItems = v
		}
		else if(typeof v === "string") {
			rawItems = v
				.split(",")
				.map((item: string): string => item.trim())
				.filter(Boolean)
		}
		else {
			throw new Error("must be an array or a comma-separated string")
		}
		return rawItems.map((item: unknown, index: number): T => {
			try {
				return itemBuilder.parse(item)
			}
			catch(err: any) {
				throw new Error(
					`item at index [${index}] is invalid: ${err.message}`,
				)
			}
		})
	}),
}

export const validateEnv = <S extends EnvSchema>(schema: S): InferredEnv<S> => {
	return new Proxy(
		{},
		{
			get(_, prop: string | symbol) {
				if(typeof prop !== "string") {
					return undefined
				}
				if(!Object.prototype.hasOwnProperty.call(schema, prop))
					return undefined
				
				const builder = schema[prop]
				const value = process.env[prop]
				
				if(value === undefined || value === "") {
					throw new ReferenceError(
						builder.customErrorMessage ||
						`[Env Error]: Environment variable "${prop}" is missing.`,
					)
				}
				
				try {
					return builder.parse(value)
				}
				catch(err: unknown) {
					throw new TypeError(
						builder.customErrorMessage ||
						`[Env Error]: Variable "${prop}" is invalid: ${err}.`,
					)
				}
			},
		},
	) as InferredEnv<S>
}
