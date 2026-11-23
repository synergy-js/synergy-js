import { rootContainer } from "@synergy-js/infusion"
import type {
	Controller,
	FetchHandler,
	FetchHandlerOptions,
	InterceptorFn,
	RequestHandler,
	RouteDefinition,
	RouteMatch,
} from "../types.ts"


// 1. Single reusable helper for wrapping interceptors (zero array allocations)
const _wrapInterceptors = (
	interceptors: readonly InterceptorFn[] | undefined,
	nextHandler: RequestHandler,
): RequestHandler => {
	if(!interceptors?.length) return nextHandler
	let pipeline = nextHandler
	for(let i = interceptors.length - 1; i >= 0; i--) {
		const interceptor = interceptors[i]!
		const next = pipeline
		pipeline = (req) => interceptor(req, (nextReq = req) => next(nextReq))
	}
	return pipeline
}

// 2. Fast pathname slicer (avoids allocating `new URL()` on every request)
const _getPathname = (url: string): string => {
	const pathStart = url.indexOf("/", url.indexOf("//") + 2)
	if(pathStart === -1) return "/"
	const queryStart = url.indexOf("?", pathStart)
	return queryStart === -1 ? url.slice(pathStart) : url.slice(pathStart, queryStart)
}

const _parseQuery = (url: string): Record<string, string | string[]> | undefined => {
	const qIndex = url.indexOf("?")
	if(qIndex === -1) return undefined
	
	const query: Record<string, string | string[]> = {}
	for(const [key, value] of new URLSearchParams(url.slice(qIndex + 1))) {
		const existing = query[key]
		query[key] =
			existing === undefined
			? value
			: Array.isArray(existing)
			  ? (existing.push(value), existing)
			  : [existing, value]
	}
	return query
}

// 3. Clean argument resolver for RPC, bodyless, JSON, and FormData routes
const _resolveArgs = async (
	req: Request,
	route: RouteDefinition,
	values: readonly string[],
): Promise<unknown[]> => {
	if(route.isRpc) {
		const args = req.body ? await req.json() : []
		return Array.isArray(args) ? args : [args]
	}
	
	if(req.method === "GET" || req.method === "HEAD" || req.method === "DELETE") {
		const query = _parseQuery(req.url)
		return query ? [...values, query] : [...values]
	}
	
	const contentType = req.headers.get("content-type") ?? ""
	if(contentType.includes("application/json")) {
		return [...values, await req.json()]
	}
	if(
		contentType.includes("multipart/form-data") ||
		contentType.includes("application/x-www-form-urlencoded")
	) {
		return [...values, await req.formData()]
	}
	
	return [...values]
}

// 4. Executes matched route using either the active scope resolver or plain `new Ctrl()`
const _executeRoute = (
	request: Request,
	match: RouteMatch,
	appInterceptors: readonly InterceptorFn[],
	resolveController: (ctrl: Controller) => object,
): Promise<unknown> => {
	const {values, route} = match
	const controller = resolveController(route.controller)
	
	const baseHandler: RequestHandler = async (req) => {
		const args = await _resolveArgs(req, route, values)
		return route.originalMethod.apply(controller, args)
	}
	
	const withRoute = _wrapInterceptors(route.routeInterceptors, baseHandler)
	const pipeline = _wrapInterceptors(appInterceptors, withRoute)
	
	return pipeline(request)
}

const _executeMatch = async (
	request: Request,
	match: RouteMatch,
	appInterceptors: readonly InterceptorFn[],
): Promise<Response> => {
	const {values, route} = match
	const requestContainer = rootContainer.createChild(route.providers)
	
	try {
		// Instantiate controller synchronously inside `start()` so `inject()` resolves all class fields
		const controller = requestContainer.start(() => requestContainer.get(route.controller))
		
		const baseHandler: RequestHandler = async (req) => {
			const args = await _resolveArgs(req, route, values)
			return route.originalMethod.apply(controller, args)
		}
		
		const withRoute = _wrapInterceptors(route.routeInterceptors, baseHandler)
		const pipeline = _wrapInterceptors(appInterceptors, withRoute)
		
		return _toResponse(await pipeline(request))
	}
	catch(error) {
		console.error("[Runtime Error]:", error)
		return new Response(`Runtime Error: ${String(error)}`, {status: 500})
	}
	finally {
		await requestContainer.destroy()
	}
}

const _toResponse = (result: unknown): Response => {
	if(result instanceof Response) return result
	if(typeof result === "string") return new Response(result)
	if(result == null) return new Response(null, {status: 204})
	return Response.json(result)
}

// 5. Completely DI-agnostic FetchHandler factory
export const createFetchHandler = ({
	router,
	appInterceptors = [],
	createScope,
}: FetchHandlerOptions): FetchHandler => {
	return async (request: Request): Promise<Response> => {
		const pathname = _getPathname(request.url)
		const match = router.match(request.method, pathname)
		
		if(!match) {
			return new Response(`Route [${request.method}:${pathname}] Not Found`, {status: 404})
		}
		
		const scope = createScope?.(match.route.providers)
		
		try {
			const result = scope
			               ? await scope.run(() =>
					_executeRoute(request, match, appInterceptors, (ctrl) => scope.resolve(ctrl)),
				)
			               : await _executeRoute(request, match, appInterceptors, (Ctrl) => new Ctrl())
			
			return _toResponse(result)
		}
		catch(error) {
			console.error("[Runtime Error]:", error)
			return new Response(`Runtime Error: ${String(error)}`, {status: 500})
		}
		finally {
			await scope?.destroy?.()
		}
	}
}
