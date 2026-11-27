import { createServer, type ServerOptions } from "node:http"
import { Readable } from "node:stream"
import type { FetchHandler, ServerAdapter, ServerInstance } from "../types.ts"

export interface NodeAdapterOptions extends ServerOptions {
	port?: number
	host?: string
}

export function nodeAdapter(options: NodeAdapterOptions = {}): ServerAdapter {
	return async (fetchHandler: FetchHandler): Promise<ServerInstance> => {
		const {port = 3000, host = "0.0.0.0", ...serverOpts} = options
		
		const server = createServer(serverOpts, async (req, res) => {
			const request = new Request(`http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`, {
				method: req.method,
				headers: req.headers as Record<string, string>,
				body: req.method === "GET" || req.method === "HEAD" ? undefined : (req as unknown as BodyInit),
				//@ts-ignore - Required
				duplex: "half",
			})
			
			const response = await fetchHandler(request)
			res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
			
			if(response.body) {
				Readable.fromWeb(response.body as never).pipe(res)
			}
			else {
				res.end()
			}
		})
		
		await new Promise<void>((resolve) => server.listen(port, host, resolve))
		console.info(`[Server]: Active on Node at http://${host}:${port}`)
		
		const stop = () =>
			new Promise<void>((resolve, reject) =>
				server.close((err) => (err ? reject(err) : resolve())),
			)
		
		process.once("SIGINT", stop)
		process.once("SIGTERM", stop)
		
		return {fetch: fetchHandler, stop}
	}
}
