import type { Provider } from "@synergy-js/infusion"
import type { RouteTable } from "./router/route-table.ts"

export interface BootstrapOptions {
	controllers: readonly Controller[]
	adapter: (fetchHandler: FetchHandler) => Promise<ServerInstance> | ServerInstance
	interceptors?: readonly InterceptorFn[]
}

export type FetchHandler = (request: Request) => Promise<Response> | Response

export interface ServerInstance {
	fetch: FetchHandler
	stop: () => Promise<void> | void
}

export type ServerAdapter = (fetchHandler: FetchHandler) => Promise<ServerInstance> | ServerInstance


export interface FetchHandlerOptions {
	router: RouteTable
	appInterceptors?: readonly InterceptorFn[]
	createScope?: (providers?: Provider[]) => RequestScope
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

export type InterceptorFn = (req: Request, next: RequestHandler) => Promise<unknown> | unknown & {}


export type ParameterMappingsMap = Map<string | symbol, {paramName: string; index: number}[]>

export type RouteDecoratorFactory = (path?: string) => MethodDecoratorFactory

export type MethodDecoratorFactory = <This, Args extends unknown[], Return>(
	originalMethod: (this: This, ...args: Args) => Return,
	context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) => void


export interface RouteEntry {
	method: string
	path: string
	handlerName: string | symbol
	originalMethod: (...args: unknown[]) => unknown
	providers?: readonly Provider[]
	interceptors?: InterceptorFn[]
}

export interface FrameworkMetadata {
	routes?: RouteEntry[]
	interceptors?: Map<string | symbol, InterceptorFn[]>
	providers?: readonly Provider[]
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
	providers?: Provider[]
	isRpc?: boolean
}

export interface RouteOptionsConfig {
	interceptors?: InterceptorFn[]
	providers?: Provider[]
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

export interface MethodRouteOptions {
	interceptors?: InterceptorFn[]
}
