/**
 * 1. Immutable Chains: Building types via e.number().refine(...) nests structural invariants.
 *
 * 2. Strict Proxied Entry: If any required environment criteria are breached or missing, the process aborts instantly and displays a custom error.
 *
 * 3. State Isolation: Because `env-guard` acts as a pure, zero-side-effect gateway, every single test block is instantly isolated by default.
 *
 * @module Env-Guard
 */

type ValidatorFn<T> = (v: unknown) => T

type EnvSchema = Record<string, Builder<any>>

type InferredEnv<S extends EnvSchema> = {
	readonly [K in keyof S]: S[K] extends Builder<infer T> ? T : never
}

interface CreateEnvOptions {
	/** Validate all schema variables immediately on creation instead of lazily on property access. */
	eager?: boolean
}

export class Builder<T> {
	private readonly _parse: ValidatorFn<T>
	
	public readonly customErrorMessage?: string
	
	private readonly refinements: Array<(val: T) => boolean> = []
	
	private readonly _hasDefault: boolean
	
	private readonly _defaultValue: T
	
	private readonly _isOptional: boolean
	
	constructor(
		parse: ValidatorFn<T>,
		customErrorMessage?: string,
		refinements: Array<(val: T) => boolean> = [],
		options?: {hasDefault?: boolean; defaultValue?: T; isOptional?: boolean},
	) {
		this._parse = parse
		this.customErrorMessage = customErrorMessage
		this.refinements = refinements
		this._hasDefault = options?.hasDefault ?? false
		this._defaultValue = options?.defaultValue as T
		this._isOptional = options?.isOptional ?? false
	}
	
	public parse = (v: unknown, propName = "value"): T => {
		if(v === undefined || v === "") {
			if(this._hasDefault) {
				return this._defaultValue
			}
			if(this._isOptional) {
				return undefined as T
			}
			throw new ReferenceError(
				this.customErrorMessage ||
				`[Env Error]: Environment variable "${propName}" is missing.`,
			)
		}
		
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
	
	public default(value: T): Builder<T> {
		return new Builder(this._parse, this.customErrorMessage, this.refinements, {
			hasDefault: true,
			defaultValue: value,
			isOptional: this._isOptional,
		})
	}
	
	public optional(): Builder<T | undefined> {
		return new Builder<T | undefined>(
			this._parse,
			this.customErrorMessage,
			this.refinements as Array<(val: T | undefined) => boolean>,
			{
				hasDefault: this._hasDefault,
				defaultValue: this._defaultValue,
				isOptional: true,
			},
		)
	}
	
	public refine(assertion: (val: T) => boolean, message: string): Builder<T> {
		const newRefinements = [
			...this.refinements,
			(val: T): boolean => {
				if(!assertion(val)) {
					throw new Error(message)
				}
				return true
			},
		]
		return new Builder(this._parse, this.customErrorMessage, newRefinements, {
			hasDefault: this._hasDefault,
			defaultValue: this._defaultValue,
			isOptional: this._isOptional,
		})
	}
	
	public error(message: string): Builder<T> {
		return new Builder(this._parse, message, this.refinements, {
			hasDefault: this._hasDefault,
			defaultValue: this._defaultValue,
			isOptional: this._isOptional,
		})
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


export class EnvValidationError extends Error {
	public readonly issues: ReadonlyArray<{key: string; message: string}>
	
	constructor(issues: ReadonlyArray<{key: string; message: string}>) {
		const summary = issues.map((i) => `  - ${i.key}: ${i.message}`).join("\n")
		super(`[Env Error]: Invalid environment configuration:\n${summary}`)
		this.name = "EnvValidationError"
		this.issues = issues
	}
}

export const createEnv = <S extends EnvSchema>(
	schema: S,
	options?: CreateEnvOptions,
): InferredEnv<S> => {
	const proxy = new Proxy(
		{},
		{
			get(_, prop: string | symbol) {
				if(typeof prop !== "string") {
					return undefined
				}
				if(!Object.prototype.hasOwnProperty.call(schema, prop)) {
					return undefined
				}
				
				const builder = schema[prop]!
				const value = process.env[prop]
				
				try {
					return builder.parse(value, prop)
				}
				catch(err: unknown) {
					if(err instanceof ReferenceError) {
						throw err
					}
					throw new TypeError(
						builder.customErrorMessage ||
						`[Env Error]: Variable "${prop}" is invalid: ${err instanceof Error ? err.message : err}.`,
					)
				}
			},
			ownKeys() {
				return Object.keys(schema)
			},
			getOwnPropertyDescriptor(_, prop) {
				if(typeof prop === "string" && Object.prototype.hasOwnProperty.call(schema, prop)) {
					return {enumerable: true, configurable: true}
				}
				return undefined
			},
		},
	) as InferredEnv<S>
	
	if(options?.eager) {
		validateAll(proxy)
	}
	
	return proxy
}

/**
 * Eagerly validates every key on an env proxy at once and throws a single
 * aggregated `EnvValidationError` listing all missing or invalid variables.
 */
export const validateAll = <S extends EnvSchema>(env: InferredEnv<S>): InferredEnv<S> => {
	const issues: Array<{key: string; message: string}> = []
	
	for(const key of Object.keys(env)) {
		try {
			// Accessing the property triggers the Proxy getter
			void (env as Record<string, unknown>)[key]
		}
		catch(err: unknown) {
			issues.push({
				key,
				message: err instanceof Error ? err.message : String(err),
			})
		}
	}
	
	if(issues.length > 0) {
		throw new EnvValidationError(issues)
	}
	
	return env
}


