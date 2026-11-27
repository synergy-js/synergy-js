import type { Accessor, Resource, ResourceActions, ResourceState, Setter } from "../types.ts"
import { untrack } from "./scheduler.ts"
import { createEffect, createSignal } from "./signal.ts"

/**
 * Create an async resource without a reactive source; the fetcher starts immediately.
 */
export function createResource<T, S = true>(
	fetcher: (source: S) => T | Promise<T>,
): [Resource<T>, ResourceActions<T>]

/**
 * Create an async resource driven by a source accessor.
 * `undefined`, `null`, and `false` disable fetching; stale requests cannot overwrite newer data.
 */
export function createResource<T, S>(
	source: Accessor<S | undefined | null | false>,
	fetcher: (source: S) => T | Promise<T>,
): [Resource<T>, ResourceActions<T>]

export function createResource<T, S = true>(
	sourceOrFetcher:
		
		| Accessor<S | undefined | null | false>
		| ((source: S) => T | Promise<T>),
	maybeFetcher?: (source: S) => T | Promise<T>,
): [Resource<T>, ResourceActions<T>] {
	const hasSource = typeof maybeFetcher === "function"
	const source: Accessor<S | undefined | null | false> = hasSource
	                                                       ? (sourceOrFetcher as Accessor<S | undefined | null | false>)
	                                                       : () => true as S
	const fetcher = hasSource
	                ? maybeFetcher!
	                : (sourceOrFetcher as (source: S) => T | Promise<T>)
	
	const [data, setData] = createSignal<T | undefined>(undefined)
	const [loading, setLoading] = createSignal<boolean>(false)
	const [error, setError] = createSignal<unknown>(undefined)
	let hasResolved = false
	let requestId = 0
	
	const state: Accessor<ResourceState> = () => {
		if(error() !== undefined) {
			return "error"
		}
		if(loading()) {
			return hasResolved ? "refreshing" : "pending"
		}
		return hasResolved ? "ready" : "unresolved"
	}
	
	const load = async (currentSource: S | undefined | null | false): Promise<T | undefined> => {
		const id = ++requestId
		
		if(currentSource === undefined || currentSource === null || currentSource === false) {
			setLoading(false)
			setError(undefined)
			return data()
		}
		
		setLoading(true)
		setError(undefined)
		
		try {
			const result = await untrack(() => fetcher(currentSource))
			if(id === requestId) {
				hasResolved = true
				setData(() => result)
			}
			return result
		}
		catch(err) {
			if(id === requestId) {
				setError(() => err)
			}
			return undefined
		}
		finally {
			if(id === requestId) {
				setLoading(false)
			}
		}
	}
	
	createEffect(() => {
		const currentSource = source()
		void load(currentSource)
	})
	
	const mutate: Setter<T | undefined> = (value) => {
		const next = setData(value)
		hasResolved = next !== undefined
		setError(undefined)
		return next
	}
	
	const read: Resource<T> = () => data()
	read.loading = loading
	read.error = error
	read.state = state
	
	return [
		read,
		{
			mutate,
			refetch: () => load(untrack(source)),
		},
	]
}
