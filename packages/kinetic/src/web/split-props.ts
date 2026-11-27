export type SplitPropsMulti<
	T extends Record<string, unknown>,
	K extends readonly (readonly (keyof T)[])[],
> = [
	...{ [I in keyof K]: Pick<T, K[I][number]> },
	Omit<T, K[number][number]>,
]

export const splitProps = <T extends Record<string, unknown>, const K extends readonly (readonly (keyof T)[])[]>(props: T, ...keyGroups: K): SplitPropsMulti<T, K> => {
	const buckets = keyGroups.map(() => ({})) as Record<PropertyKey, unknown>[]
	const rest: Record<PropertyKey, unknown> = {}
	
	const keyToBucket = new Map<PropertyKey, Record<PropertyKey, unknown>>()
	for(let i = 0; i < keyGroups.length; i++) {
		for(const key of keyGroups[i]!) {
			if(!keyToBucket.has(key)) {
				keyToBucket.set(key, buckets[i]!)
			}
		}
	}
	
	for(const key of Reflect.ownKeys(props)) {
		const target = keyToBucket.get(key) ?? rest
		Object.defineProperty(target, key, {
			enumerable: true,
			configurable: true,
			get() {
				return Reflect.get(props, key, props)
			},
		})
	}
	
	return [...buckets, rest] as unknown as SplitPropsMulti<T, K>
}
