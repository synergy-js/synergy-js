export type Listener = (() => void) & {deps?: Set<Set<Listener>>}

export type StoreSetter<T> = (recipe: (draft: T) => void) => void

export type Accessor<T> = () => T

export type Setter<T> = (next: T | ((prev: T) => T)) => T

export interface Owner {
	parent: Owner | null
	cleanups: Array<() => void>
	contexts: Map<symbol, unknown>
}

export interface BaseContext<T> {
	readonly id: symbol
	readonly defaultValue: T
}

// ============================================================================
// Async Resource Primitive (`createResource`)
// ============================================================================

export interface Resource<T> {
	(): T | undefined
	
	readonly loading: Accessor<boolean>
	readonly error: Accessor<unknown>
}

export interface ResourceActions<T> {
	mutate: Setter<T | undefined>
	refetch: () => Promise<T | undefined>
}

