import { type RsbuildMiddlewares } from "@rsbuild/core"
import { type IncomingMessage, ServerResponse } from "node:http"
import { useDevServerFnHandler } from "./utils.ts"

/**
 * Transforms a standard Node.js `IncomingMessage` into a WinterTC compatible `Request` object
 * @param {IncomingMessage} req
 * @returns {Request}
 */
export const nodeToWtcRequest = (req: IncomingMessage): Request => {
	const protocol = req.headers["x-forwarded-proto"] || "http"
	const host = req.headers.host || "localhost"
	const fullUrl = new URL(req.url || "", `${protocol}://${host}`)
	
	return new Request(fullUrl.toString(), {
		method: req.method,
		headers: req.headers as Record<string, string>,
		body:
			req.method !== "GET" && req.method !== "HEAD"
			? (req as unknown as ReadableStream)
			: null,
		duplex: "half",
	} as RequestInit)
}

/**
 * Pipes a WinterTC compatible `Response` back into a Node.js `ServerResponse` stream
 * @param {Response} webResponse
 * @param {ServerResponse} res
 * @returns {Promise<void>}
 */
export const wtcToNodeResponse = async (webResponse: Response, res: ServerResponse): Promise<void> => {
	res.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()))
	const responseBodyText = await webResponse.text()
	res.end(responseBodyText)
}

export const useServerFnMiddleware = (middleware: RsbuildMiddlewares, interceptedRoute: string): RsbuildMiddlewares => {
	return middleware.use(
		async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
			const {url} = req
			
			if(!url) {
				return next()
			}
			
			// 1. Flattened URL parsing
			const webRequest = nodeToWtcRequest(req)
			const {pathname, searchParams} = new URL(webRequest.url)
			
			// 2. Route Matching
			if(pathname !== interceptedRoute) {
				return next()
			}
			
			// 3. Extraction & Validation
			const filePath = searchParams.get("file")
			const targetMethod = searchParams.get("method")
			
			if(!filePath || !targetMethod) {
				res.statusCode = 400
				res.end("Missing required query parameters")
				return
			}
			
			// 4. Execution & Piping
			try {
				const webResponse = await useDevServerFnHandler(
					webRequest,
					filePath,
					targetMethod,
				)
				await wtcToNodeResponse(webResponse, res)
			}
			catch(err: unknown) {
				res.writeHead(500, {"Content-Type": "application/json"})
				res.end(
					JSON.stringify({
						error: {message: "Critical middleware failure bridging streams."},
					}),
				)
			}
		},
	)
}
