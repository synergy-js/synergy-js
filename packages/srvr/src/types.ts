import type { AnyProvider } from "@synergy-js/infusion"
import type { RouteTable } from "./router/route-table.ts"


export interface BootstrapOptions {
	controllers: readonly Controller[]
	adapter: (fetchHandler: FetchHandler) => Promise<ServerInstance> | ServerInstance
	interceptors?: readonly InterceptorFn[]
	createScope?: (providers?: AnyProvider[]) => RequestScope
}

export type FetchHandler = (request: Request) => Promise<Response> | Response

export interface ServerInstance {
	fetch: FetchHandler
	stop: () => Promise<void> | void
}

export type ServerAdapter = (fetchHandler: FetchHandler) => Promise<ServerInstance> | ServerInstance


// Generic DI / Scope contract — zero coupling to Infusion
export interface RequestScope {
	resolve(target: Controller): object
	
	run<R>(fn: () => Promise<R>): Promise<R>
	
	destroy?(): Promise<void> | void
}


export interface FetchHandlerOptions {
	router: RouteTable
	appInterceptors?: readonly InterceptorFn[]
	createScope?: (providers?: AnyProvider[]) => RequestScope
}

export interface RequestScope {
	resolve<T>(target: new (...args: any[]) => T): T
	
	run<R>(fn: () => Promise<R>): Promise<R>
	
	destroy?(): Promise<void> | void
}

export type Controller = new (...args: any[]) => object

export type RouteSegment =
	| {kind: "literal"; value: string}
	| {kind: "param"; name: string}

export type RequestHandler = (request: Request) => Promise<unknown>

export type InterceptorFn = (req: Request, next: RequestHandler) => Promise<Response | string | unknown>

export type ParameterMappingsMap = Map<string | symbol, {paramName: string; index: number}[]>

export type RouteDecoratorFactory = (path?: string) => MethodDecoratorFactory

export type MethodDecoratorFactory = <This, Args extends unknown[], Return>(
	originalMethod: (this: This, ...args: Args) => Return,
	context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) => void


// export type ServiceToken =
// 	| (new (...args: never[]) => unknown)
// 	| {readonly description: string; readonly type: "InjectionToken"}
//
// export type ServiceProvider =
// 	| (new (...args: never[]) => unknown)
// 	| {provide: ServiceToken; useValue: unknown; multi?: boolean}
// 	| {provide: ServiceToken; useClass: new (...args: never[]) => unknown; multi?: boolean}
// 	| {provide: ServiceToken; useFactory: () => unknown; multi?: boolean}


/**
 * Internal shape of a route metadata entry gathered from method decorators
 */
export interface RouteEntry {
	method: string
	path: string
	handlerName: string | symbol
	originalMethod: (...args: unknown[]) => unknown
	providers?: readonly AnyProvider[]
}

export interface FrameworkMetadata {
	routes?: RouteEntry[]
	controllerGuards?: unknown[]
	methodGuards?: Record<string | symbol, unknown[]>
	interceptors?: Map<string | symbol, InterceptorFn[]>
	providers?: readonly AnyProvider[]
	parameterMappings?: ParameterMappingsMap
}

export interface RouteDefinition {
	method: string
	path: string
	segments: readonly RouteSegment[]
	paramNames: readonly string[]
	basePath: string
	controller: Controller
	handlerName: string | symbol
	originalMethod: (...args: unknown[]) => unknown
	routeInterceptors?: InterceptorFn[]
	routeGuards?: unknown[]
	providers?: AnyProvider[]
	isRpc?: boolean
}

export interface RouteOptionsConfig {
	interceptors?: InterceptorFn[]
	providers?: AnyProvider[]
}

export interface RouteMatch {
	route: RouteDefinition
	params: ReadonlyMap<string, string>
	values: readonly string[]
}

export interface RouteNode {
	literals: Map<string, RouteNode>
	parameter?: RouteNode
	handlers: Map<string, RouteDefinition>
}


