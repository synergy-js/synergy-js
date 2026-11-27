import { ROUTE_DEFINITIONS } from "../constants.ts"
import { RouteTable } from "../router/route-table.ts"
import {
	type BootstrapOptions,
	type RouteDefinition,
	type ServerInstance,
} from "../types.ts"
import { createFetchHandler } from "./utils"


export const bootstrap = async <TOptions>(options: BootstrapOptions): Promise<ServerInstance> => {
	const router = new RouteTable()
	
	for(const controller of options.controllers) {
		const defs = (controller as unknown as Record<symbol, RouteDefinition[] | undefined>)[ROUTE_DEFINITIONS] ?? []
		
		for(const def of defs) {
			router.register(def)
		}
	}
	
	const fetchHandler = createFetchHandler({
		router,
		appInterceptors: options.interceptors ?? [],
	})
	
	console.info("\n[Engine] Booting framework environment runtime.")
	console.info(`[Server]: Registered ${router.size} routes.`)
	
	return options.adapter(fetchHandler)
}
