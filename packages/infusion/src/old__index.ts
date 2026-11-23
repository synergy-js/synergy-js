/**
 * The choice between the `@Injectable` class decorator and the self-providing `InjectionToken` comes down to state lifecycles and object behavior,
 * they serve two completely different architectural purposes.
 *
 * ### `@Injectable` (Class-Based DI)
 * Benefits: Automatic method context binding, instance lifecycle management, and preservation of `this`.
 *
 *  Class based DI provides a vital runtime feature; it loops through the prototype and forcefully runs `.bind(this)` on every class method.
 * If you pass that service into nested async handler streams or event callbacks, `this` never drops out as undefined.
 *
 * • Supports Complex Scope Trees: Because it targets concrete class constructors, it naturally integrates with `RequestContainer` to support `Transient` or `Request scoped lifecycles.
 * You can instantiate a fresh copy of the class per network thread if it needs to track temporary request state.
 * • Encapsulates Heavy Business Logic: It is perfect for stateful database services, repository models, or transaction managers where you need full object-oriented capabilities.
 *
 *
 * ### `inject()`  (InjectionToken)
 * Benefits: Interface Abstraction, zero-configuration globals, and tree shaking are the priority.
 *
 * • Bypasses Class Requirements: JavaScript classes cannot represent raw configurations, environment variables, primitive string keys, or third-party client connection pools.
 * An InjectionToken<T> allows you to inject an abstract shape (like your ApiConfig interface) with full type-safety.
 *
 * • Zero Boilerplate: Because it carries its own factory() hook, you can drop the token directly into any file without opening your AppModule.ts configuration file to mount it.
 *
 * • Aggressive Dead Code Elimination (DCE): If you build your application for production and a controller stops utilizing a token,
 * Bun scans the module graph, sees no active usage of the token, and completely strips the token and its factory data out of your binary. A class imported globally is much harder to tree-shake
 *
 * @module Depedency-Injection
 */

import { AsyncLocalStorage } from "node:async_hooks"

export type ScopeType = "Singleton" | "Transient" | "Request"

export type GenericConstructor<T = object> = new (...args: any[]) => T

/**
 * Strict zero-any signature constraint for instantiable class constructors
 */
export type Type<T> = new (...args: any[]) => T

/**
 * Self-resolving abstract Injection Token block
 * @template T
 */
export class InjectionToken<T> {
	private _staticValue: T | undefined
	
	private _hasBeenEvaluated = false
	
	private readonly _options?: {factory: () => T}
	
	public readonly description: string
	
	public readonly type = "InjectionToken" as const
	
	constructor(description: string, options?: {factory: () => T}) {
		this.description = description
		this._options = options
	}
	
	/**
	 * @template T
	 * @returns {T}
	 */
	public resolveFallback(): T {
		if(this._hasBeenEvaluated) {
			return this._staticValue as T
		}
		if(this._options?.factory) {
			this._staticValue = this._options.factory()
			this._hasBeenEvaluated = true
			return this._staticValue
		}
		throw new Error(
			`[Dependency Injection] InjectionToken(${this.description}) has no factory or provider registered.`,
		)
	}
}

/**
 * Unified token lookup type mapping classes and interfaces side-by-side
 */
export type ProviderToken<T> = Type<T> | InjectionToken<T>

/**
 *
 */
export interface IDiMetadata {
	scope: ScopeType
	className: string
}

/**
 * `Lifetime`: Bound to the entire application process.
 *
 * A Singleton, by definition, must live forever and be shared globally across the entire application lifecycle.
 * It doesn't matter if we spawn 10,000 different `RequestContainer` instances over the course of a day;
 * they all need to resolve to the exact same instance of a heavy resource (like a database connection pool or
 * a global config object).
 *
 * `The Goal`: By moving this outside the class constructor space into the module scope, we ensure it is instantiated
 * exactly once when your library file is first loaded, making it completely decoupled from the creation and
 * destruction of short-lived request containers.
 * @type {Map<unknown, unknown>}
 */
export const singletonCache: Map<unknown, unknown> = new Map<unknown, unknown>()

/**
 *
 * @type {module:node:async_hooks.AsyncLocalStorage<RequestContainer>}
 */
export const containerStorage: AsyncLocalStorage<Infusion> = new AsyncLocalStorage<Infusion>()

/**
 *
 * @returns {RequestContainer | null}
 */
export const getActiveContainer = (): Infusion | null => {
	return containerStorage.getStore() || null
}

/**
 * Returns the current RequestContainer
 * @template T
 * @param {ProviderToken<T>} ServiceToken
 * @returns {T}
 *
 * @example
 * ```ts
 * export interface User {
 * 	id: number
 * 	name: string
 * 	role: string
 * }
 * export interface ITestConfig {
 * 	url: string
 * 	users: User[]
 * }
 *
 * // Declare the token and hand it its own explicit factory value provider block!
 * export const TEST_CONFIG = new InjectionToken<ITestConfig>("Core API Config Setup", {
 * 	factory: () => ({
 * 	    url: "https://my-api.com"
 * 		users: [
 * 			{id: 1, name: "Alice", role: "Admin"},
 * 			{id: 2, name: "Bob", role: "Developer"},
 * 		]
 * 	}),
 * })
 * ```
 */
export const inject = <T>(ServiceToken: ProviderToken<T>): T => {
	const activeContainer = getActiveContainer()
	if(!activeContainer) {
		const tokenName =
			ServiceToken instanceof InjectionToken
			? ServiceToken.description
			: ServiceToken.name
		throw new Error(
			`[Dependency Injection]: inject(${tokenName}) called outside of an active injection context\n
Please make sure you created a DI container\nconst container = new RequestContainer()\n container.runInContext(() => {...})\n`,
		)
	}
	return activeContainer.get(ServiceToken)
}

/**
 *
 */
export class Infusion {
	/**
	 * `Lifetime`: Bound to a single Request/Network thread.
	 *
	 * We instantiate a new `RequestContainer()` for every incoming HTTP request or isolated test case.
	 * When that specific request finishes or the test ends, you call container.destroy(), which wipes out the map.
	 * Eventually, JavaScript garbage-collects the entire container instance.
	 *
	 * `The Goal`: It must be an instance property so that Request A and Request B have completely separated, isolated pockets of memory.
	 * If it was not inside the class, Request A would accidentally see and overwrite the data belonging to Request B.
	 * @type {Map<unknown, unknown>}
	 */
	public scopedCache: Map<unknown, unknown> = new Map<unknown, unknown>()
	
	public get debugScopedCache(): {token: InjectionToken<unknown>, value: unknown}[] {
		return Array.from(this.scopedCache.entries()).map(([key, val]) => ({
			token:
				key instanceof InjectionToken
				? `Token(${key.description})`
				: (key as any).name,
			value: val,
		}))
	}
	
	start<R>(fn: () => R): R {
		return containerStorage.run(this, fn)
	}
	
	set<T>(token: ProviderToken<T>, value: T): void {
		this.scopedCache.set(token, value)
	}
	
	get<T>(ServiceToken: ProviderToken<T>): T {
		// Structural Check: If it has resolveFallback, it is an InjectionToken instance
		if(
			ServiceToken &&
			typeof ServiceToken === "object" &&
			"resolveFallback" in ServiceToken
		) {
			const tokenInstance = ServiceToken as unknown as InjectionToken<T>
			if(!this.scopedCache.has(tokenInstance)) {
				this.scopedCache.set(tokenInstance, tokenInstance.resolveFallback())
			}
			return this.scopedCache.get(tokenInstance) as T
		}
		
		// Pathway B: Real, Concrete Classes
		const metadata = ((ServiceToken as unknown as Record<string | symbol, unknown>)[Symbol.metadata] as Record<string | symbol, unknown> | undefined) || {}
		const meta = (metadata.di || {scope: "Singleton"}) as IDiMetadata
		
		const TargetConstructor = ServiceToken as Type<T>
		
		if(meta.scope === "Singleton") {
			if(!singletonCache.has(ServiceToken)) {
				singletonCache.set(
					ServiceToken,
					this.start(() => new TargetConstructor()),
				)
			}
			return singletonCache.get(ServiceToken) as T
		}
		
		if(meta.scope === "Request") {
			if(!this.scopedCache.has(ServiceToken)) {
				this.scopedCache.set(
					ServiceToken,
					this.start(() => new TargetConstructor()),
				)
			}
			return this.scopedCache.get(ServiceToken) as T
		}
		
		return this.start(() => new TargetConstructor())
	}
	
	destroy(): void {
		this.scopedCache.clear()
	}
}

/**
 * @example Class decorator
 * ```ts
 * @Injectable({scope: "Singleton"})
 * export class UserService {
 * 	getUsers() {
 * 		return [
 * 			{id: 1, name: "Alice", role: "Admin"},
 * 			{id: 2, name: "Bob", role: "Developer"},
 * 		]
 * 	}
 * }
 * ```
 *
 * @template T
 * @param {{scope: ScopeType}} config
 * @returns {<T extends Type<unknown>>(targetClass: T, context: ClassDecoratorContext<T>) => T}
 * @constructor
 */
export function Injectable(
	config: {scope: ScopeType} = {scope: "Singleton"},
) {
	return function <T extends Type<unknown>>(
		targetClass: T,
		context: ClassDecoratorContext<T>,
	): T {
		if(context.kind !== "class") {
			throw new Error(
				"[Dependency Injection]: @Injectable can only be applied to classes.",
			)
		}
		
		const metadata = (context.metadata || Object.create(null)) as Record<
			string | symbol,
			unknown
		>
		
		metadata.di = {
			scope: config.scope,
			className: context.name || targetClass.name,
		} satisfies IDiMetadata
		
		const base = targetClass as GenericConstructor
		
		// Retain constructor binding wrapper mapping to capture active 'this' parameters
		const MixinClass = class extends base {
			constructor(...args: any[]) {
				super(...args)
				
				// Traverse upwards through the prototype inheritance chain
				let currentProto = targetClass.prototype
				while(currentProto && currentProto !== Object.prototype) {
					for(const key of Object.getOwnPropertyNames(currentProto)) {
						if(key === "constructor") {
							continue
						}
						const instance = this as Record<string, unknown>
						// Prevent overriding a binding that was already applied by a derived child class execution pass
						if(Object.prototype.hasOwnProperty.call(this, key)) {
							continue
						}
						
						const descriptor = Object.getOwnPropertyDescriptor(
							currentProto,
							key,
						)
						if(descriptor && typeof descriptor.value === "function") {
							instance[key] = (
								descriptor.value as (...args: unknown[]) => unknown
							).bind(this)
						}
					}
					currentProto = Object.getPrototypeOf(currentProto)
				}
			}
		}
		Object.defineProperty(MixinClass, Symbol.metadata, {
			value: metadata,
			configurable: true,
			writable: true,
			enumerable: true,
		})
		return MixinClass as unknown as T
	}
}

/**
 * Inspects a decorated class to determine its configured DI scope lifecycle.
 */
export const getServiceScope = (TargetClass: Type<unknown>): ScopeType => {
	const metadata =
		((TargetClass as GenericConstructor)[Symbol.metadata] as
			Record<string | symbol, unknown> | undefined) || {}
	const meta = metadata.di as IDiMetadata | undefined
	
	// If the decorator ran, return its configured scope; otherwise default to Singleton
	return meta ? meta.scope : "Singleton"
}
