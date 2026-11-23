//Universal DI engine (Bun, Node, Browser, Edge)

export type Type<T = unknown> = new (...args: never[]) => T

export type ProviderScope = "Singleton" | "Transient" | "Request"

export type ProviderToken<T = unknown> = Type<T> | InjectionToken<T>

export type AnyToken = | (new (...args: never[]) => unknown) | {readonly description: string; readonly type: "InjectionToken"}

// export type Provider<T = unknown> =
// 	| Type<T>
// 	| {provide: ProviderToken<T>; useValue: T; multi?: boolean}
// 	| {provide: ProviderToken<T>; useClass: Type<T>; multi?: boolean}
// 	| {provide: ProviderToken<T>; useFactory: () => T; multi?: boolean}

export type AnyProvider =
	| (new (...args: never[]) => unknown)
	| {provide: AnyToken; useValue: unknown; multi?: boolean}
	| {provide: AnyToken; useClass: new (...args: never[]) => unknown; multi?: boolean}
	| {provide: AnyToken; useFactory: () => unknown; multi?: boolean}

export interface InjectableOptions {
	scope?: ProviderScope
}

export interface InjectOptions<T = unknown> {
	optional?: boolean
	self?: boolean
	skipSelf?: boolean
	useFactory?: () => T
}

export interface OnDestroy {
	onDestroy(): Promise<void> | void
}

const INJECTABLE_META: unique symbol = Symbol("infusion:injectable")

interface InjectableMetadata {
	scope: ProviderScope
}

export function Injectable(options: InjectableOptions = {}) {
	return function <TClass extends Type>(
		targetClass: TClass,
		context: ClassDecoratorContext<TClass>,
	): void {
		if(context.kind !== "class") {
			throw new Error("@Injectable can only be applied to classes.")
		}
		Object.defineProperty(targetClass, INJECTABLE_META, {
			value: {scope: options.scope ?? "Singleton"} satisfies InjectableMetadata,
		})
	}
}

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


function getTokenName(token: unknown): string {
	if(token instanceof InjectionToken) return `InjectionToken(${token.description})`
	if(typeof token === "function" && token.name) return token.name
	return String(token)
}

function isOnDestroy(value: unknown): value is OnDestroy {
	return (
		typeof value === "object" &&
		value !== null &&
		"onDestroy" in value &&
		typeof (value as OnDestroy).onDestroy === "function"
	)
}

function getInjectableScope(token: unknown): ProviderScope {
	if(typeof token === "function" && INJECTABLE_META in token) {
		const meta = (token as unknown as Record<symbol, InjectableMetadata>)[INJECTABLE_META]
		return meta?.scope ?? "Singleton"
	}
	return "Singleton"
}

// --- Core Container ---
export class Infusion {
	private scopedCache = new Map<unknown, unknown>()
	
	private providers = new Map<unknown, AnyProvider[]>()
	
	private resolving = new Set<unknown>()
	
	private readonly parent?: Infusion
	
	constructor(parent?: Infusion) {
		this.parent = parent
	}
	
	/** Create an isolated child container (e.g., per-request or per-component tree). */
	public createChild(providers?: readonly AnyProvider[]): Infusion {
		const child = new Infusion(this)
		if(providers?.length) {
			child.register(providers)
		}
		return child
	}
	
	/** Register providers into this container scope. */
	public register(providers: readonly AnyProvider[]): this {
		for(const provider of providers) {
			const token = typeof provider === "function" ? provider : provider.provide
			const isMulti = typeof provider === "object" && "multi" in provider && Boolean(provider.multi)
			
			if(isMulti) {
				const existing = this.providers.get(token) ?? []
				existing.push(provider)
				this.providers.set(token, existing)
			}
			else {
				this.providers.set(token, [provider])
			}
		}
		return this
	}
	
	/** Run a synchronous callback with this container active for `inject()`. */
	public start<R>(fn: () => R): R {
		syncStack.push(this)
		try {
			return fn()
		}
		finally {
			syncStack.pop()
		}
	}
	
	/** Resolve a token from this container or its parent hierarchy. */
	public get<T>(token: ProviderToken<T>): T
	public get<T>(token: ProviderToken<T>, options: InjectOptions & {optional: true}): T | null
	public get<T>(token: ProviderToken<T>, options?: InjectOptions): T
	public get<T>(token: ProviderToken<T>, options?: InjectOptions<T>): T | null {
		
		if(options?.skipSelf) {
			if(!this.parent) {
				if(options.optional) return null
				throw new Error(`[Dependency Injection] No parent container for @SkipSelf ${getTokenName(token)}.`)
			}
			return this.parent.get(token, {...options, skipSelf: false}) as T | null
		}
		
		// 1. Return cached instance in this scope if already resolved
		if(this.scopedCache.has(token)) {
			return this.scopedCache.get(token) as T
		}
		
		// 2. Check local provider registrations
		const registered = this.providers.get(token)
		if(registered && registered.length > 0) {
			const isMulti =
				registered.length > 1 ||
				(typeof registered[0] === "object" && "multi" in registered[0] && Boolean(registered[0].multi))
			
			if(isMulti) {
				const instances = registered.map((p) => this.instantiate<unknown>(token, p))
				this.scopedCache.set(token, instances)
				return instances as T
			}
			
			const provider = registered[0]!
			const scope = getInjectableScope(
				typeof provider === "object" && "useClass" in provider ? provider.useClass : token,
			)
			const instance = this.instantiate<T>(token, provider)
			
			if(scope !== "Transient") {
				this.scopedCache.set(token, instance)
			}
			return instance
		}
		
		// 3. Delegate up to parent container unless `self: true`
		if(!options?.self && this.parent) {
			return this.parent.get(token, options) as T | null
		}
		
		// 4. Auto-instantiate un-registered classes or InjectionTokens with default factories
		if(typeof token === "function") {
			const scope = getInjectableScope(token)
			const rootTarget = scope === "Singleton" ? this.getRoot() : this
			
			if(rootTarget !== this && rootTarget.scopedCache.has(token)) {
				return rootTarget.scopedCache.get(token) as T
			}
			
			const instance = rootTarget.instantiate<T>(token, token)
			if(scope !== "Transient") {
				rootTarget.scopedCache.set(token, instance)
			}
			return instance
		}
		
		if(token instanceof InjectionToken) {
			try {
				const instance = token.resolveFallback()
				this.scopedCache.set(token, instance)
				return instance
			}
			catch(err) {
				if(options?.useFactory) {
					const instance = this.start(() => options.useFactory!())
					this.scopedCache.set(token, instance)
					return instance
				}
				if(options?.optional) {
					return null
				}
				throw err
			}
		}
		
		if(options?.useFactory) {
			const instance: T = this.start(() => options.useFactory!())
			this.scopedCache.set(token, instance)
			return instance
		}
		
		if(options?.optional) {
			return null
		}
		throw new Error(`[Dependency Injection] No provider found for ${getTokenName(token)}.`)
	}
	
	private getRoot(): Infusion {
		let current: Infusion = this
		while(current.parent) {
			current = current.parent
		}
		return current
	}
	
	private instantiate<T>(token: unknown, provider: AnyProvider): T {
		if(this.resolving.has(token)) {
			const chain = [...this.resolving, token].map(getTokenName).join(" -> ")
			throw new Error(`[Dependency Injection] Circular dependency detected: ${chain}`)
		}
		
		this.resolving.add(token)
		try {
			return this.start(() => {
				if(typeof provider === "function") {
					const Ctor = provider as Type<T>
					return new Ctor()
				}
				if("useValue" in provider) {
					return provider.useValue as T
				}
				if("useFactory" in provider) {
					return provider.useFactory() as T
				}
				if("useClass" in provider) {
					const Ctor = provider.useClass as Type<T>
					return new Ctor()
				}
				throw new Error(`[Dependency Injection] Invalid provider configuration for ${getTokenName(token)}.`)
			})
		}
		finally {
			this.resolving.delete(token)
		}
	}
	
	/** Dispose this container scope and invoke onDestroy() on any scoped instances. */
	public async destroy(): Promise<void> {
		const cleanups: Promise<void>[] = []
		for(const value of this.scopedCache.values()) {
			if(Array.isArray(value)) {
				for(const item of value) {
					if(isOnDestroy(item)) {
						const res = item.onDestroy()
						if(res instanceof Promise) cleanups.push(res)
					}
				}
			}
			else if(isOnDestroy(value)) {
				const res = value.onDestroy()
				if(res instanceof Promise) cleanups.push(res)
			}
		}
		if(cleanups.length > 0) {
			await Promise.all(cleanups)
		}
		this.scopedCache.clear()
		this.providers.clear()
		this.resolving.clear()
	}
}

// --- Angular-Style Root Container & Synchronous Injector Stack ---
export const rootContainer: Infusion = new Infusion()
const syncStack: Infusion[] = []

export function getActiveContainer(): Infusion {
	return syncStack[syncStack.length - 1] ?? rootContainer
}

export function inject<T>(token: ProviderToken<T>): T
export function inject<R>(token: InjectionToken<unknown>, options: InjectOptions<R> & {useFactory: () => R}): R
export function inject<R>(token: InjectionToken<unknown>, options: InjectOptions<R> & {useFactory: () => R}): R
export function inject<T>(token: ProviderToken<T>, options: InjectOptions<NoInfer<T>> & {useFactory: () => NoInfer<T>}): T
export function inject<T>(token: ProviderToken<T>, options: InjectOptions<NoInfer<T>> & {optional: true}): T | null
export function inject<T>(token: ProviderToken<T>, options?: InjectOptions<NoInfer<T>>): T
export function inject<T>(token: ProviderToken<T>, options?: InjectOptions<T>): T | null {
	return getActiveContainer().get(token, options)
}
