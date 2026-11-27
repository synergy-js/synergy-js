import type {
	InterceptorFn,
	FrameworkMetadata,
	RouteDecoratorFactory,
	RouteDefinition,
	RouteOptionsConfig,
	MethodDecoratorFactory,
	Controller, MethodRouteOptions,
} from "../types.ts"
import { ROUTE_DEFINITIONS } from "../constants.ts"

import { compilePath, joinPaths } from "./utils.ts"

/**
 * `Tier 1` — Global interceptors: Passed once to bootstrap({ controllers: [...], interceptors: [globalFn] }) -> forwarded to createFetchHandler({ router, appInterceptors }).
 *
 * `Tier 2 `— `@Route` (controller-level) interceptors: Passed to @Route("/users", { interceptors: [controllerFn] }) -> stored in classInterceptors.
 *
 * `Tier 3` — `@Get / @Post / @Patch / @Delete` (HTTP method-level) interceptors: Passed to @Get("/:id", { interceptors: [methodFn] }) -> stored on each route entry in metadata.routes.
 * @param {string} httpMethod
 * @returns {RouteDecoratorFactory}
 */
function _createRouteDecorator(httpMethod: string): RouteDecoratorFactory {
	return function(path = "/", options?: MethodRouteOptions): MethodDecoratorFactory {
		return function <This, Args extends unknown[], Return>(
			originalMethod: (this: This, ...args: Args) => Return,
			context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
		): void {
			if(context.kind !== "method") {
				throw new Error(`@${httpMethod} can only be used on class methods.`)
			}
			
			const metadata = context.metadata as FrameworkMetadata
			
			if(!Object.hasOwn(metadata, "routes")) {
				metadata.routes = [...(metadata.routes ?? [])]
			}
			
			metadata.routes!.push({
				method: httpMethod,
				path: path,
				handlerName: context.name,
				originalMethod: originalMethod as (...args: unknown[]) => unknown,
				interceptors: options?.interceptors ?? [],
			})
		}
	}
}

export const Get: RouteDecoratorFactory = _createRouteDecorator("GET")

export const Post: RouteDecoratorFactory = _createRouteDecorator("POST")

export const Patch: RouteDecoratorFactory = _createRouteDecorator("PATCH")

export const Delete: RouteDecoratorFactory = _createRouteDecorator("DELETE")

/**
 * Synchronous Stage 3 Class Decorator
 * @param {string} basePath
 * @param options
 * @returns {(targetClass: any, context: ClassDecoratorContext) => void}
 * @example
 * ```tsx
 * // Create a route for "/"
 * @Route("/")
 * export class HomePage {
 *      @Get("/")
 *      async home() {
 *          return (<p>Home Page</p>)
 *      }
 *  }
 * ```
 */

export function Route(basePath: string, options?: RouteOptionsConfig): <TClass extends Controller>(targetClass: TClass, context: ClassDecoratorContext<TClass>) => void {
	return function(targetClass, context): void {
		if(context.kind !== "class") {
			throw new Error("@Route only works on classes.")
		}
		// Options defined in ../types.ts -> FrameworkMetadata
		const metadata = context.metadata as FrameworkMetadata | undefined
		
		const routes = metadata?.routes ?? []
		
		const classInterceptors = options?.interceptors ?? []
		
		const providers = options?.providers ?? []
		
		const methodInterceptors = metadata?.interceptors ?? new Map<string | symbol, InterceptorFn[]>()
		
		const definitions: RouteDefinition[] = routes.map((route) => {
			const path = joinPaths(basePath, route.path)
			const {segments, paramNames} = compilePath(path)
			
			return {
				method: route.method.toUpperCase(),
				path,
				segments,
				paramNames,
				basePath,
				controller: targetClass,
				handlerName: route.handlerName,
				originalMethod: route.originalMethod,
				providers: [...providers],
				routeInterceptors: [
					...classInterceptors,
					...(methodInterceptors.get(route.handlerName) ?? []),
				],
			}
		})
		
		Object.defineProperty(targetClass, ROUTE_DEFINITIONS, {
			value: definitions,
		})
	}
}