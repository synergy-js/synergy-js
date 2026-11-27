import type { HttpHandlerFn, HttpInterceptorFn } from "@synergy-js/srvr"

export const authGuard: HttpInterceptorFn = async (req: Request, next: HttpHandlerFn): Promise<unknown> => {
	// create new url from request.url
	const url = new URL(req.url || "http://localhost")
	
	// check if the URL query string contains ?admin=true
	const isAdmin = url.searchParams.get("admin") === "true"
	
	// return the standard htp 401 "Unauthorized" response
	if(!isAdmin) {
		console.log("Not an admin")
		return new Response("Unauthorized", {status: 401})
	}
	
	return await next(req)
}

export const logger: HttpInterceptorFn = async (req, next) => {
	const start = Date.now()
	console.log(
		`[Logging Pipeline] --> Received a ${req.method} request from ${req.url}`,
	)
	
	// Delegate execution to downstream handlers
	const result = await next(req)
	
	console.log(`[Logging Pipeline] <-- Completed in ${Date.now() - start}ms`)
	return result
}