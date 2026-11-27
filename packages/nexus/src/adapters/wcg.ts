import type { FetchHandler, ServerInstance } from "../types.ts"

export const wcgAdapter = (fetchHandler: FetchHandler): ServerInstance => {
	return {
		fetch: fetchHandler,
		stop: () => {
		},
	}
}