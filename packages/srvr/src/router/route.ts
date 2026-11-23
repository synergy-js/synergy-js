import type {
	InterceptorFn,
	FrameworkMetadata,
	RouteDecoratorFactory,
	RouteDefinition,
	RouteOptionsConfig,
	MethodDecoratorFactory,
	Controller,
} from "../types.ts"
import { ROUTE_DEFINITIONS } from "../constants.ts"

import { compilePath, joinPaths } from "./utils.ts"

function createRouteDecorator(httpMethod: string): RouteDecoratorFactory {
	return function(path = "/"): MethodDecoratorFactory {
		return function <This, Args extends unknown[], Return>(
			originalMethod: (this: This, ...args: Args) => Return,
			context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
		): void {
			if(context.kind !== "method") {
				throw new Error(`@${httpMethod} can only be used on class methods.`)
			}
			
			const metadata = context.metadata as FrameworkMetadata
			
			if(!metadata.routes) {
				metadata.routes = []
			}
			
			metadata.routes.push({
				method: httpMethod,
				path: path,
				handlerName: context.name,
				originalMethod: originalMethod as (...args: unknown[]) => unknown,
			})
			
			if(process.env.NODE_ENV === "development") {
				console.info(`\n[router/createRouteDecorator] Registered ${httpMethod} ${path} onto method: ${String(context.name)}`)
			}
			
			console.info(`\n[Router] Registered ${httpMethod} ${path} onto method: ${String(context.name)}`)
		}
	}
}


export const Get: RouteDecoratorFactory = createRouteDecorator("GET")


export const Post: RouteDecoratorFactory = createRouteDecorator("POST")


export const Patch: RouteDecoratorFactory = createRouteDecorator("PATCH")


export const Delete: RouteDecoratorFactory = createRouteDecorator("DELETE")

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
// export function Route(basePath: string): (targetClass: Controller, context: ClassDecoratorContext) => void {
// 	return function(targetClass, context): void {
// 		if(context.kind !== "class") {
// 			throw new Error("@Route only works on classes.")
// 		}
//
// 		const metadata = context.metadata as IExtendedFrameworkMetadata | undefined
// 		const routes = metadata?.routes ?? []
// 		const classGuards = metadata?.controllerGuards ?? []
// 		const methodGuards = metadata?.methodGuards ?? {}
// 		const interceptors = metadata?.interceptors ?? new Map<string | symbol, HttpInterceptorFn[]>()
//
// 		const definitions: RouteDefinition[] = routes.map((route) => {
// 			const path = joinPaths(basePath, route.path)
// 			const {segments, paramNames} = compilePath(path)
//
// 			return {
// 				method: route.method.toUpperCase(),
// 				path,
// 				segments,
// 				paramNames,
// 				basePath,
// 				controller: targetClass,
// 				handlerName: route.handlerName,
// 				originalMethod: route.originalMethod,
// 				routeInterceptors: interceptors.get(route.handlerName) ?? [],
// 				routeGuards: [
// 					...classGuards,
// 					...(methodGuards[route.handlerName] ?? []),
// 				],
// 			}
// 		})
//
// 		Object.defineProperty(targetClass, ROUTE_DEFINITIONS, {
// 			value: definitions,
// 		})
// 	}
// }
export function Route(
	basePath: string,
	options?: RouteOptionsConfig,
): <TClass extends Controller>(targetClass: TClass, context: ClassDecoratorContext<TClass>) => void {
	return function(targetClass, context): void {
		if(context.kind !== "class") {
			throw new Error("@Route only works on classes.")
		}
		
		const metadata = context.metadata as FrameworkMetadata | undefined
		const routes = metadata?.routes ?? []
		const classGuards = metadata?.controllerGuards ?? []
		const methodGuards = metadata?.methodGuards ?? {}
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
				routeGuards: [
					...classGuards,
					...(methodGuards[route.handlerName] ?? []),
				],
			}
		})
		
		Object.defineProperty(targetClass, ROUTE_DEFINITIONS, {
			value: definitions,
		})
	}
}