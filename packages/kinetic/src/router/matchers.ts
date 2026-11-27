import type { MatchedRoute, RouteDefinition, RouteParams } from "../types.ts"

interface RouteCandidate {
	chain: MatchedRoute[]
	staticSegments: number
	order: number[]
}

/** Normalize repeated/trailing slashes to a canonical absolute pathname. */
const normalizePath = (path: string): string => {
	const parts = path.split("/").filter(Boolean)
	return `/${parts.join("/")}`
}

const getPathname = (path: string): string | null => {
	try {
		const base = new URL("http://kinetic.local")
		const url = new URL(path, base)
		if(url.origin !== base.origin) return null
		return normalizePath(url.pathname)
	}
	catch {
		return null
	}
}

/** Match route segments and return decoded params, or null for an invalid prefix. */
const matchPrefix = (pattern: string, pathname: string): RouteParams | null => {
	const patternParts = pattern.split("/").filter(Boolean)
	const pathParts = pathname.split("/").filter(Boolean)
	if(pathParts.length < patternParts.length) return null

	const params: RouteParams = {}
	for(let index = 0; index < patternParts.length; index++) {
		const patternPart = patternParts[index]!
		const pathPart = pathParts[index]!
		if(patternPart.startsWith(":")) {
			try {
				params[patternPart.slice(1)] = decodeURIComponent(pathPart)
			}
			catch {
				return null
			}
		}
		else {
			try {
				if(decodeURIComponent(patternPart) !== decodeURIComponent(pathPart)) {
					return null
				}
			}
			catch {
				return null
			}
		}
	}
	return params
}

const isMoreSpecific = (candidate: RouteCandidate, current: RouteCandidate): boolean => {
	if(candidate.staticSegments !== current.staticSegments) {
		return candidate.staticSegments > current.staticSegments
	}
	if(candidate.chain.length !== current.chain.length) {
		return candidate.chain.length > current.chain.length
	}
	for(let index = 0; index < Math.min(candidate.order.length, current.order.length); index++) {
		if(candidate.order[index] !== current.order[index]) {
			return candidate.order[index]! < current.order[index]!
		}
	}
	return false
}

/**
 * Resolve a pathname to its most specific matching route chain.
 * Static segments outrank params; definition order breaks otherwise equal ties.
 */
export const resolveRouteChain = (
	routes: RouteDefinition[],
	path: string,
): MatchedRoute[] | null => {
	const pathname = getPathname(path)
	if(pathname === null) return null

	const candidates: RouteCandidate[] = []
	const visit = (
		definitions: RouteDefinition[],
		basePath: string,
		parentChain: MatchedRoute[],
		parentStaticSegments: number,
		parentOrder: number[],
	): void => {
		for(let index = 0; index < definitions.length; index++) {
			const route = definitions[index]!
			const pattern = normalizePath(`${basePath}/${route.path}`)
			const matchedParams = matchPrefix(pattern, pathname)
			if(matchedParams === null) continue

			const routeParams = {...(parentChain.at(-1)?.params ?? {}), ...matchedParams}
			const chain = [...parentChain, {route, params: routeParams}]
			const staticSegments =
				parentStaticSegments +
				pattern.split("/").filter((part) => part && !part.startsWith(":")).length
			const order = [...parentOrder, index]
			const patternLength = pattern.split("/").filter(Boolean).length
			const pathnameLength = pathname.split("/").filter(Boolean).length

			if(patternLength === pathnameLength) {
				candidates.push({chain, staticSegments, order})
			}
			else if(route.children?.length) {
				visit(route.children, pattern, chain, staticSegments, order)
			}
		}
	}

	visit(routes, "", [], 0, [])
	let best: RouteCandidate | null = null
	for(const candidate of candidates) {
		if(best === null || isMoreSpecific(candidate, best)) best = candidate
	}
	return best?.chain ?? null
}
