import type { RouteSegment } from "../types.ts"

export const joinPaths = (...parts: string[]): string => {
	const segments = parts.flatMap((part) => part.split("/").filter(Boolean))
	return `/${segments.join("/")}`
}

export const isValidParamName = (name: string): boolean => {
	if(name.length === 0) return false
	
	const isStart = (char: string): boolean => {
		const code = char.charCodeAt(0)
		return (
			char === "_" ||
			(code >= 65 && code <= 90) ||
			(code >= 97 && code <= 122)
		)
	}
	
	const isPart = (char: string): boolean => {
		const code = char.charCodeAt(0)
		return (isStart(char) || (code >= 48 && code <= 57))
	}
	
	if(!isStart(name[0] ?? "")) {
		return false
	}
	
	for(let index = 1; index < name.length; index++) {
		if(!isPart(name[index] ?? "")) {
			return false
		}
	}
	
	return true
}

export const compilePath = (path: string): {segments: RouteSegment[], paramNames: string[]} => {
	const names = new Set<string>()
	const segments: RouteSegment[] = []
	
	for(const rawSegment of path.split("/").filter(Boolean)) {
		if(rawSegment.startsWith(":")) {
			const name = rawSegment.slice(1)
			
			if(!isValidParamName(name)) {
				throw new Error(`Invalid route parameter "${name}" in "${path}"`)
			}
			if(names.has(name)) {
				throw new Error(`Duplicate route parameter "${name}" in "${path}"`)
			}
			
			names.add(name)
			segments.push({kind: "param", name})
			continue
		}
		
		let value: string
		try {
			value = decodeURIComponent(rawSegment)
		}
		catch {
			throw new Error(`Invalid encoded path segment in "${path}"`)
		}
		
		segments.push({kind: "literal", value})
	}
	
	return {segments, paramNames: [...names]}
}

