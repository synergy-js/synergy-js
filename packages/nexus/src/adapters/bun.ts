import type { FetchHandler, ServerAdapter, ServerInstance } from "../types.ts"
import type { Serve } from "bun"

export interface BunAdapterOptions {
	port?: number
	hostname?: string
	unix?: string
	development?: boolean
	id?: string
	idleTimeout?: number
	maxRequestBodySize?: number
	reusePort?: boolean
	ipv6Only?: boolean
	tls?: Bun.TLSOptions | Bun.TLSOptions[],
	routes?: Record<string, unknown>
}

export const bunAdapter = (options?: BunAdapterOptions): ServerAdapter => {
	return (fetchHandler: FetchHandler): ServerInstance => {
		const server = Bun.serve({
			...(options as Bun.Serve.Options<unknown>),
			fetch: fetchHandler,
		})
		
		console.info(`[Server]: Active on Bun at ${server.url}`)
		
		const stop = async () => {
			server.closeIdleConnections()
			await server.stop()
		}
		
		process.once("SIGINT", stop)
		process.once("SIGTERM", stop)
		
		return {fetch: fetchHandler, stop}
	}
}