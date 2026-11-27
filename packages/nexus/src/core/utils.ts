/**
 * • Zero-closure fast path: Routes with no global or route interceptors bypass the interceptor loop completely and call route.originalMethod.apply(...) directly.
 *
 * • Zero array allocation when only one interceptor tier exists: Avoids [...a, ...b] unless both appInterceptors and routeInterceptors are non-empty.
 *
 * • Zero array copy for values when no query/body exists: Passes values straight to .apply() without [...values] cloning.
 *
 * • O(1) JSON/object response serialization: Checks ctor === Object || ctor === Array before any instanceof prototype walks, and uses pre-allocated header objects with JSON.stringify
 */


import type {
	FetchHandler,
	FetchHandlerOptions, InterceptorFn, RequestHandler,
	RouteDefinition,
} from "../types.ts"

const JSON_HEADERS = {"content-type": "application/json; charset=utf-8"}
const TEXT_HEADERS = {"content-type": "text/plain; charset=utf-8"}
const HTML_HEADERS = {"content-type": "text/html; charset=utf-8"}

const _toResponse = (result: unknown): Response => {
	if(result == null) {
		return new Response(null, {status: 204})
	}
	
	if(typeof result === "string") {
		return new Response(result, {headers: TEXT_HEADERS})
	}
	
	if(typeof result === "object") {
		if(Object.hasOwn(result, "toString")) {
			return new Response(String(result), {headers: HTML_HEADERS})
		}
		
		// Fast O(1) constructor checks for plain JSON objects & arrays (90% of API responses)
		const ctor = (result as object).constructor
		if(ctor === Object || ctor === Array || ctor === undefined) {
			return new Response(JSON.stringify(result), {headers: JSON_HEADERS})
		}
		
		// Already a Response (or custom Response subclass)
		if(result instanceof Response) {
			return result
		}
		
		// Native BodyInit types (ReadableStream, Uint8Array, ArrayBuffer, Blob, FormData)
		if(
			ctor === ReadableStream ||
			ctor === ArrayBuffer ||
			ctor === Blob ||
			ctor === FormData ||
			ArrayBuffer.isView(result)
		) {
			return new Response(result as BodyInit)
		}
	}
	
	// Numbers, booleans, or custom class instances -> serialize as JSON
	return new Response(JSON.stringify(result), {headers: JSON_HEADERS})
}

const _parseArgs = async (
	req: Request,
	url: URL,
	route: RouteDefinition,
	values: readonly string[],
): Promise<unknown[]> => {
	if(route.isRpc) {
		const args = req.body ? await req.json() : []
		return Array.isArray(args) ? args : [args]
	}
	
	if(req.method === "GET" || req.method === "HEAD" || req.method === "DELETE") {
		if(!url.search) return values as unknown[]
		
		const query: Record<string, string | string[]> = {}
		for(const [k, v] of url.searchParams) {
			const prev = query[k]
			query[k] = prev === undefined ? v : Array.isArray(prev) ? (prev.push(v), prev) : [prev, v]
		}
		return [...values, query]
	}
	
	const type = req.headers.get("content-type") ?? ""
	if(type.includes("application/json")) {
		return [...values, await req.json()]
	}
	if(type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
		return [...values, await req.formData()]
	}
	
	return values as unknown[]
}

// 5. Completely DI-agnostic FetchHandler factory
export const createFetchHandler = ({
	router,
	appInterceptors = [],
	createScope,
}: FetchHandlerOptions): FetchHandler => {
	const hasAppInterceptors = appInterceptors.length > 0
	
	return async (request: Request): Promise<Response> => {
		const url = new URL(request.url)
		const match = router.match(request.method, url.pathname)
		
		if(!match) {
			return new Response(`Route [${request.method}:${url.pathname}] Not Found`, {status: 404})
		}
		
		const {route, values} = match
		const routeInterceptors = route.routeInterceptors ?? []
		const scope = createScope?.(route.providers)
		
		const execute = async (): Promise<unknown> => {
			const controller = scope ? scope.resolve(route.controller) : new route.controller()
			
			// Fast path: 0 interceptors -> direct invocation with zero wrapper closures
			if(!hasAppInterceptors && routeInterceptors.length === 0) {
				return route.originalMethod.apply(controller, await _parseArgs(request, url, route, values))
			}
			
			const chain: readonly InterceptorFn[] = !hasAppInterceptors
			                                        ? routeInterceptors
			                                        : routeInterceptors.length === 0
			                                          ? appInterceptors
			                                          : [...appInterceptors, ...routeInterceptors]
			
			let dispatch: RequestHandler = async (req) => route.originalMethod.apply(controller, await _parseArgs(req, url, route, values))
			
			for(let i = chain.length - 1; i >= 0; i--) {
				const fn = chain[i]!
				const next = dispatch
				dispatch = async (req) => fn(req, (nextReq = req) => next(nextReq))
			}
			
			return dispatch(request)
		}
		
		try {
			return _toResponse(scope ? await scope.run(execute) : await execute())
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