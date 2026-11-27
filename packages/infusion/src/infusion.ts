import {
	type Provider,
	INJECTABLE_META,
	type InjectableMetadata,
	type InjectOptions,
	type OnDestroy,
	type ProviderScope,
	type TokenType,
} from "./types.ts"
import { InjectionToken, type ProviderToken } from "./injection-token.ts"

let activeContainer: Infusion | undefined
let externalResolver: (() => Infusion | undefined) | undefined

export class Infusion {
	private _scopedCache = new Map<unknown, unknown>()
	
	private _providers = new Map<unknown, Provider[]>()
	
	private _resolving = new Set<unknown>()
	
	private readonly _parent?: Infusion
	
	constructor(parent?: Infusion) {
		this._parent = parent
	}
	
	/** Create an isolated child container (e.g., per-request or per-component tree). */
	public createChild(providers?: readonly Provider[]): Infusion {
		const child = new Infusion(this)
		if(providers?.length) {
			child.register(providers)
		}
		return child
	}
	
	/** Register providers into this container scope. */
	public register(providers: readonly Provider[]): this {
		for(const provider of providers) {
			const token = typeof provider === "function" ? provider : provider.provide
			const isMulti = typeof provider === "object" && "multi" in provider && Boolean(provider.multi)
			
			if(isMulti) {
				const existing = this._providers.get(token) ?? []
				existing.push(provider)
				this._providers.set(token, existing)
			}
			else {
				this._providers.set(token, [provider])
			}
		}
		return this
	}
	
	/** Run a synchronous callback with this container active for `inject()`. */
	public start<R>(fn: () => R): R {
		const prev = activeContainer
		activeContainer = this
		try {
			return fn()
		}
		finally {
			activeContainer = prev
		}
	}
	
	/** Dispose this container scope and invoke onDestroy() on any scoped instances. */
	public async destroy(): Promise<void> {
		const cleanups: Promise<void>[] = []
		for(const value of this._scopedCache.values()) {
			if(Array.isArray(value)) {
				for(const item of value) {
					if(this._isOnDestroy(item)) {
						const res = item.onDestroy()
						if(res instanceof Promise) cleanups.push(res)
					}
				}
			}
			else if(this._isOnDestroy(value)) {
				const res = value.onDestroy()
				if(res instanceof Promise) cleanups.push(res)
			}
		}
		if(cleanups.length > 0) {
			await Promise.all(cleanups)
		}
		this._scopedCache.clear()
		this._providers.clear()
		this._resolving.clear()
	}
	
	/** Resolve a token from this container or its parent hierarchy. */
	public get<T>(token: ProviderToken<T>): T
	public get<T>(token: ProviderToken<T>, options: InjectOptions & {optional: true}): T | null
	public get<T>(token: ProviderToken<T>, options?: InjectOptions): T
	public get<T>(token: ProviderToken<T>, options?: InjectOptions): T | null {
		if(options?.skipSelf) {
			if(!this._parent) {
				if(options.optional) return null
				throw new Error(`[Dependency Injection] No parent container for @SkipSelf ${this._getTokenName(token)}.`)
			}
			return this._parent.get(token, {...options, skipSelf: false}) as T | null
		}
		
		// 1. Return cached instance in this scope if already resolved
		if(this._scopedCache.has(token)) {
			return this._scopedCache.get(token) as T
		}
		
		// 2. Check local provider registrations
		const registered = this._providers.get(token)
		if(registered && registered.length > 0) {
			const isMulti =
				registered.length > 1 ||
				(typeof registered[0] === "object" && "multi" in registered[0] && Boolean(registered[0].multi))
			
			if(isMulti) {
				const instances = registered.map((p) => this._instantiate<unknown>(token, p))
				this._scopedCache.set(token, instances)
				return instances as T
			}
			
			const provider = registered[0]!
			const scope = this._getInjectableScope(
				typeof provider === "object" && "useClass" in provider ? provider.useClass : token,
			)
			const instance = this._instantiate<T>(token, provider)
			
			if(scope !== "Transient") {
				this._scopedCache.set(token, instance)
			}
			return instance
		}
		
		// 3. Walk parent hierarchy ONLY for already-cached instances or explicit registrations
		if(!options?.self && this._parent) {
			let parent: Infusion | undefined = this._parent
			while(parent) {
				if(parent._scopedCache.has(token)) {
					return parent._scopedCache.get(token) as T
				}
				if(parent._providers.has(token)) {
					return parent.get(token, {...options, self: true})
				}
				parent = parent._parent
			}
		}
		
		// 4. Auto-instantiate un-registered classes or InjectionTokens with default factories
		if(typeof token === "function") {
			const meta = this._getInjectableMeta(token)
			
			// If `@Service({ autoProvided: false })`, do not auto-instantiate—must be explicitly registered
			if(meta?.autoProvided === false) {
				if(options?.optional) return null
				throw new Error(`[Dependency Injection] No provider found for ${this._getTokenName(token)}.`)
			}
			
			const scope = meta?.scope ?? "Singleton"
			const rootTarget = scope === "Singleton" ? this._getRoot() : this
			
			if(rootTarget !== this && rootTarget._scopedCache.has(token)) {
				return rootTarget._scopedCache.get(token) as T
			}
			
			const provider: Provider = meta?.factory
			                           ? {provide: token as ProviderToken<T>, useFactory: meta.factory as () => T}
			                           : (token as TokenType<T>)
			
			const instance = rootTarget._instantiate<T>(token, provider)
			if(scope !== "Transient") {
				rootTarget._scopedCache.set(token, instance)
			}
			return instance
		}
		
		if(token instanceof InjectionToken) {
			try {
				const instance = this.start(() => token.resolveFallback())
				this._scopedCache.set(token, instance)
				return instance
			}
			catch(err) {
				if(options?.optional) return null
				throw err
			}
		}
		
		if(options?.optional) {
			return null
		}
		throw new Error(`[Dependency Injection] No provider found for ${this._getTokenName(token)}.`)
	}
	
	/**
	 * which container actually holds a cached instance
	 * (e.g., verifying a Singleton resolved from a child was cached on root, not on child)
	 * @param {ProviderToken<unknown>} token
	 * @returns {boolean}
	 */
	public hasCached(token: ProviderToken<unknown>): boolean {
		return this._scopedCache.has(token)
	}
	
	private _getInjectableMeta(token: unknown): InjectableMetadata | undefined {
		if(typeof token === "function" && INJECTABLE_META in token) {
			return (token as unknown as Record<symbol, InjectableMetadata>)[INJECTABLE_META]
		}
		return undefined
	}
	
	private _getInjectableScope(token: unknown): ProviderScope {
		if(typeof token === "function" && INJECTABLE_META in token) {
			const meta = (token as unknown as Record<symbol, InjectableMetadata>)[INJECTABLE_META]
			return meta?.scope ?? "Singleton"
		}
		return "Singleton"
	}
	
	private _getRoot(): Infusion {
		let current: Infusion = this
		while(current._parent) {
			current = current._parent
		}
		return current
	}
	
	private _instantiate<T>(token: unknown, provider: Provider): T {
		if(this._resolving.has(token)) {
			const chain = [...this._resolving, token].map(this._getTokenName).join(" -> ")
			throw new Error(`[Dependency Injection] Circular dependency detected: ${chain}`)
		}
		
		this._resolving.add(token)
		try {
			return this.start(() => {
				if(typeof provider === "function") {
					const Ctor = provider as TokenType<T>
					return new Ctor()
				}
				if("useValue" in provider) {
					return provider.useValue as T
				}
				if("useFactory" in provider) {
					return provider.useFactory() as T
				}
				if("useClass" in provider) {
					const Ctor = provider.useClass as TokenType<T>
					return new Ctor()
				}
				throw new Error(`[Dependency Injection] Invalid provider configuration for ${this._getTokenName(token)}.`)
			})
		}
		finally {
			this._resolving.delete(token)
		}
	}
	
	private _getTokenName(token: unknown): string {
		if(token instanceof InjectionToken) {
			return `InjectionToken(${token.description})`
		}
		if(typeof token === "function" && token.name) {
			return token.name
		}
		return String(token)
	}
	
	private _isOnDestroy(value: unknown): value is OnDestroy {
		return (
			typeof value === "object" &&
			value !== null &&
			"onDestroy" in value &&
			typeof (value as OnDestroy).onDestroy === "function"
		)
	}
}

const rootContainer: Infusion = new Infusion()

export function inject<T>(token: ProviderToken<T>): T
export function inject<T>(token: ProviderToken<T>, options: InjectOptions & {optional: true}): T | null
export function inject<T>(token: ProviderToken<T>, options?: InjectOptions): T
export function inject<T>(token: ProviderToken<T>, options?: InjectOptions): T | null {
	return getActiveContainer().get(token, options)
}

/** Optional hook for AsyncLocalStorage (server) or reactive Owner tree (UI). */
export const setContextResolver = (resolver: (() => Infusion | undefined) | undefined): void => {
	externalResolver = resolver
}

export const getActiveContainer = (): Infusion => {
	return activeContainer ?? externalResolver?.() ?? rootContainer
}