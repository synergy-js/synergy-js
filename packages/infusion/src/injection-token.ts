import type { TokenType } from "./types.ts"

export class InjectionToken<T = unknown> {
	public readonly description: string
	
	public readonly type = "InjectionToken" as const
	
	private readonly factory?: () => T
	
	constructor(description: string, options?: {factory?: () => T}) {
		this.description = description
		this.factory = options?.factory
	}
	
	public resolveFallback(): T {
		if(this.factory) {
			return this.factory()
		}
		throw new Error(`[Dependency Injection] No provider found for InjectionToken(${this.description}).`)
	}
}

export type ProviderToken<T = unknown> = TokenType<T> | InjectionToken<T>