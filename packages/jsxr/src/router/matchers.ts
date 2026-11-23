import type { MatchedRoute, RouteDefinition, RouteParams } from "./types"

interface SearchFrame {
	routes: RouteDefinition[]
	index: number
	basePath: string
	chain: MatchedRoute[]
	parentFallback: MatchedRoute[] | null
}

const matchSegment = (pattern: string, path: string, exact = true): RouteParams | null => {
	const patternParts = pattern.split("/").filter(Boolean)
	const pathParts = path.split("/").filter(Boolean)
	
	if(exact && patternParts.length !== pathParts.length) return null
	if(!exact && pathParts.length < patternParts.length) return null
	
	const extracted: RouteParams = {}
	
	for(let i = 0; i < patternParts.length; i++) {
		const pat = patternParts[i]!
		const seg = pathParts[i]!
		if(pat.startsWith(":")) {
			extracted[pat.slice(1)] = decodeURIComponent(seg)
		}
		else if(pat !== seg) {
			return null
		}
	}
	
	return extracted
}

export const resolveRouteChain = (
	routes: RouteDefinition[],
	path: string,
): MatchedRoute[] | null => {
	const stack: SearchFrame[] = [
		{routes, index: 0, basePath: "", chain: [], parentFallback: null},
	]
	
	while(stack.length > 0) {
		const frame = stack[stack.length - 1]!
		
		if(frame.index >= frame.routes.length) {
			stack.pop()
			if(frame.parentFallback) return frame.parentFallback
			continue
		}
		
		const route = frame.routes[frame.index++]!
		const fullPattern = `${frame.basePath}/${route.path}`.replace(/\/+/g, "/")
		const hasChildren = Boolean(route.children?.length)
		const prefixParams = matchSegment(fullPattern, path, !hasChildren)
		
		if(!prefixParams) continue
		
		const nextChain: MatchedRoute[] = [...frame.chain, {route, params: prefixParams}]
		const exactParams = matchSegment(fullPattern, path, true)
		const exactChain = exactParams ? [...frame.chain, {route, params: exactParams}] : null
		
		if(hasChildren && route.children) {
			stack.push({
				routes: route.children,
				index: 0,
				basePath: fullPattern,
				chain: nextChain,
				parentFallback: exactChain,
			})
			continue
		}
		
		if(exactChain) return exactChain
	}
	
	return null
}
