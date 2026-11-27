/**
 * @template TRoutes
 * @param {ClientOptions} options
 * @returns {RpcClient<TRoutes>}
 * @example
 * ```ts
 * @Route("users")
 * export class UserRoute {
 * 	private db = inject(DatabaseService)
 *
 * 	@Get("/:id")
 * 	getUser(id: string) {
 * 		return this.db.findUser(Number(id))
 * 	}
 *
 * 	@Get("/")
 * 	searchUsers(query: { q?: string; tags?: string[] }) {
 * 		return this.db.search(query)
 * 	}
 *
 * 	@Post("/")
 * 	createUser(body: { name: string; email: string }) {
 * 		return this.db.create(body)
 * 	}
 * }
 *
 * // Client
 * import type { UserRoute } from "../server/routes/UserRoute"
 * import { createClient } from "@synergy-js/router/client"
 *
 * export const api = createClient<{
 * 	users: typeof UserRoute
 * }>({
 * 	headers: () => ({
 * 		Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
 * 	}),
 * 	onError: (status, msg) => console.error(`API ${status}:`, msg),
 * })
 *
 * // Full autocomplete & type inference everywhere:
 * const user = await api.users.getUser("42")                       // GET /users/42
 * const results = await api.users.searchUsers({ q: "sam" })        // GET /users?q=sam
 * const created = await api.users.createUser({ name: "A", email: "a@b.com" }) // POST /users
 * ```
 *
 * @module RpcCloent
 */

import type { ClientOptions, RpcClient } from "./types.ts"

export const createClient = <TRoutes extends Record<string, new (...args: any[]) => any>, >(options: ClientOptions = {}): RpcClient<TRoutes> => {
	const {
		baseUrl = "",
		headers: getHeaders,
		fetch: customFetch = globalThis.fetch,
		onError,
	} = options
	
	return new Proxy({} as RpcClient<TRoutes>, {
		get(_, routePrefix: string) {
			if(
				typeof routePrefix === "symbol" ||
				routePrefix === "then" ||
				routePrefix === "toJSON"
			) {
				return undefined
			}
			
			return new Proxy(
				{},
				{
					get(_, methodName: string) {
						if(
							typeof methodName === "symbol" ||
							methodName === "then" ||
							methodName === "toJSON"
						) {
							return undefined
						}
						
						return async (...args: unknown[]) => {
							const extraHeaders = getHeaders ? await getHeaders() : {}
							const url = `${baseUrl}/_rpc/${routePrefix}/${methodName}`
							const hasArgs = args.length > 0
							
							const res = await customFetch(url, {
								method: "POST",
								headers: {
									...(hasArgs ? {"Content-Type": "application/json"} : {}),
									...extraHeaders,
								},
								body: hasArgs ? JSON.stringify(args) : undefined,
							})
							
							if(!res.ok) {
								const errText = await res.text()
								onError?.(res.status, errText)
								throw new Error(errText || `HTTP ${res.status}`)
							}
							
							if(res.status === 204) return undefined
							const contentType = res.headers.get("content-type") ?? ""
							return contentType.includes("application/json")
							       ? res.json()
							       : res.text()
						}
					},
				},
			)
		},
	})
}
