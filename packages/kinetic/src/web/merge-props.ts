export type MergeSources<T extends readonly Record<string, unknown>[]> = { [K in keyof T]: T[K] }

export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never

/** Merge sources lazily; later sources take precedence and getters remain live. */
export const mergeProps = <T extends readonly object[]>(...sources: T): UnionToIntersection<T[number]> & object => {
	return new Proxy({} as UnionToIntersection<T[number]> & object, {
		get(_, prop) {
			for(let i = sources.length - 1; i >= 0; i--) {
				const source = sources[i]
				if(source && prop in source) {
					return Reflect.get(source, prop, source)
				}
			}
			return undefined
		},
		
		has(_, prop) {
			for(let i = sources.length - 1; i >= 0; i--) {
				if(sources[i] && prop in sources[i]!) {
					return true
				}
			}
			return false
		},
		
		ownKeys() {
			const keys = new Set<string | symbol>()
			for(let i = 0; i < sources.length; i++) {
				const source = sources[i]
				if(source) {
					for(const key of Reflect.ownKeys(source)) {
						keys.add(key)
					}
				}
			}
			return Array.from(keys)
		},
		
		getOwnPropertyDescriptor(_, prop) {
			for(let i = sources.length - 1; i >= 0; i--) {
				const source = sources[i]
				if(source && prop in source) {
					const desc = Object.getOwnPropertyDescriptor(source, prop)
					if(desc) {
						return {...desc, configurable: true}
					}
				}
			}
			return undefined
		},
	})
}

