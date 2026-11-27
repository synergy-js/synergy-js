import type { RouteDefinition, RouteMatch, RouteNode } from "../types.ts"

const createRouteNode = (): RouteNode => ({
	literals: new Map(),
	handlers: new Map(),
})

export class RouteTable {
	private readonly root = createRouteNode()
	
	private routeCount = 0
	
	get size(): number {
		return this.routeCount
	}
	
	register(route: RouteDefinition): void {
		let node = this.root
		
		for(const segment of route.segments) {
			if(segment.kind === "literal") {
				let child = node.literals.get(segment.value)
				if(!child) {
					child = createRouteNode()
					node.literals.set(segment.value, child)
				}
				node = child
			}
			else {
				node.parameter ??= createRouteNode()
				node = node.parameter
			}
		}
		
		const method = route.method.toUpperCase()
		
		if(node.handlers.has(method)) {
			throw new Error(`Duplicate route: ${method} ${route.path}`)
		}
		
		node.handlers.set(method, {...route, method})
		this.routeCount++
	}
	
	match(method: string, pathname: string): RouteMatch | null {
		let parts: string[]
		
		try {
			parts = pathname
				.split("/")
				.filter(Boolean)
				.map((part) => decodeURIComponent(part))
		}
		catch {
			return null
		}
		
		const upperMethod = method.toUpperCase()
		const values: string[] = []
		
		const visit = (node: RouteNode, index: number): RouteMatch | null => {
			if(index === parts.length) {
				const route = node.handlers.get(upperMethod)
				if(!route || values.length !== route.paramNames.length) {
					return null
				}
				
				const params = new Map<string, string>()
				for(let i = 0; i < route.paramNames.length; i++) {
					params.set(route.paramNames[i]!, values[i]!)
				}
				
				return {route, params, values: [...values]}
			}
			
			const part = parts[index]!
			
			const literal = node.literals.get(part)
			if(literal) {
				const match = visit(literal, index + 1)
				if(match) return match
			}
			
			if(node.parameter) {
				values.push(part)
				const match = visit(node.parameter, index + 1)
				if(match) return match
				values.pop()
			}
			
			return null
		}
		
		return visit(this.root, 0)
	}
	
}