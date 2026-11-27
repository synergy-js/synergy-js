import { describe, expect, it } from "rstack/test"
import { Readable } from "node:stream"
import type { IncomingMessage, ServerResponse } from "node:http"
import { useServerFnMiddleware } from "../src/common/middleware.ts"

const fixturePath = new URL("./fixtures/server-functions.ts", import.meta.url).href

type MiddlewareHandler = (
	request: IncomingMessage,
	response: ServerResponse,
	next: () => void,
) => void | Promise<void>

const createMiddlewareHandler = (): MiddlewareHandler => {
	let registeredHandler: MiddlewareHandler | undefined
	const middleware = {
		use(handler: MiddlewareHandler) {
			registeredHandler = handler
			return middleware
		},
	}
	
	useServerFnMiddleware(middleware as never, "/fusion/rpc")
	
	if(!registeredHandler) {
		throw new Error("Fusion middleware handler was not registered")
	}
	
	return registeredHandler
}

const createRequest = (url: string, body = ""): IncomingMessage =>
	Object.assign(Readable.from(body ? [body] : []), {
		url,
		method: "POST",
		headers: {
			host: "localhost",
			"content-type": "application/json",
		},
	}) as IncomingMessage

const createResponse = () => {
	const response = {
		statusCode: 200,
		headers: {} as Record<string, string>,
		body: "",
		writeHead(status: number, headers: Record<string, string>) {
			response.statusCode = status
			response.headers = headers
			return response
		},
		end(body = "") {
			response.body = body
			return response
		},
	}
	
	return response
}

describe("Fusion RPC middleware", () => {
	it("executes server functions and bridges the JSON response", async () => {
		const handler = createMiddlewareHandler()
		const request = createRequest(
			`/fusion/rpc?file=${encodeURIComponent(fixturePath)}&method=add`,
			JSON.stringify([2, 3]),
		)
		const response = createResponse()
		
		await handler(request, response as unknown as ServerResponse, () => {
		})
		
		expect(response.statusCode).toBe(200)
		expect(response.headers["content-type"]).toBe("application/json;charset=utf-8")
		expect(JSON.parse(response.body)).toEqual({result: 5})
	})
	
	it("returns a bad request when routing parameters are missing", async () => {
		const handler = createMiddlewareHandler()
		const response = createResponse()
		
		await handler(
			createRequest("/fusion/rpc?method=add"),
			response as unknown as ServerResponse,
			() => {
			},
		)
		
		expect(response.statusCode).toBe(400)
		expect(response.body).toBe("Missing required query parameters")
	})
	
	it("passes requests for other routes to the next middleware", async () => {
		const handler = createMiddlewareHandler()
		let nextCalled = false
		
		await handler(
			createRequest("/other"),
			createResponse() as unknown as ServerResponse,
			() => {
				nextCalled = true
			},
		)
		
		expect(nextCalled).toBe(true)
	})
})
