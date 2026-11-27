import type {
	Accessor,
	BaseContext,
	Listener,
	Owner,
	Resource,
	ResourceActions,
	Setter,
	StoreSetter,
} from "./types.js"

export type { Accessor, BaseContext, Listener, Owner, Resource, ResourceActions, Setter, StoreSetter } from "./types.ts"

let currentListener: Listener | null = null

let currentOwner: Owner | null = null

let batchDepth = 0

const pendingListeners = new Set<Listener>()

const RAW_TARGET = Symbol("syn.store.raw")

const PROXY_CACHE = new WeakMap<object, object>()

const cleanupListener = (listener: Listener): void => {
	if(!listener.deps) return
	for(const depSet of listener.deps) {
		depSet.delete(listener)
	}
	listener.deps.clear()
}

const scheduleListener = (listener: Listener): void => {
	if(batchDepth > 0) {
		pendingListeners.add(listener)
	}
	else {
		listener()
	}
}

export const batch = <T>(fn: () => T): T => {
	batchDepth++
	try {
		return fn()
	}
	finally {
		batchDepth--
		if(batchDepth === 0 && pendingListeners.size > 0) {
			const toRun = Array.from(pendingListeners)
			pendingListeners.clear()
			for(let i = 0; i < toRun.length; i++) {
				toRun[i]()
			}
		}
	}
}

export const untrack = <T>(fn: () => T): T => {
	const prevListener = currentListener
	currentListener = null
	try {
		return fn()
	}
	finally {
		currentListener = prevListener
	}
}
export const createSignal = <T>(initial: T): [Accessor<T>, Setter<T>] => {
	let internalValue = initial
	const subscribers = new Set<Listener>()
	
	const read: Accessor<T> = (): T => {
		if(currentListener !== null) {
			subscribers.add(currentListener)
			if(!currentListener.deps) {
				currentListener.deps = new Set()
			}
			currentListener.deps.add(subscribers)
		}
		return internalValue
	}
	
	const write: Setter<T> = (next): T => {
		const resolved =
			typeof next === "function" ? (next as (prev: T) => T)(internalValue) : next
		if(Object.is(internalValue, resolved)) return internalValue
		internalValue = resolved
		for(const listener of Array.from(subscribers)) {
			scheduleListener(listener)
		}
		return internalValue
	}
	
	return [read, write]
}

export const createMemo = <T>(fn: () => T): Accessor<T> => {
	let value: T
	let initialized = false
	const subscribers = new Set<Listener>()
	
	createEffect(() => {
		const next = fn()
		if(!initialized || !Object.is(value, next)) {
			value = next
			initialized = true
			for(const listener of Array.from(subscribers)) {
				scheduleListener(listener)
			}
		}
	})
	
	return (): T => {
		if(currentListener !== null) {
			subscribers.add(currentListener)
			if(!currentListener.deps) {
				currentListener.deps = new Set()
			}
			currentListener.deps.add(subscribers)
		}
		return value
	}
}
export const onCleanup = (fn: () => void): void => {
	if(currentOwner !== null) {
		currentOwner.cleanups.push(fn)
	}
}

export const runWithOwner = <T>(
	fn: () => T,
	contextEntry?: {id: symbol; value: unknown},
): {result: T; dispose: () => void} => {
	const contexts = new Map<symbol, unknown>()
	if(contextEntry !== undefined) {
		contexts.set(contextEntry.id, contextEntry.value)
	}
	
	const owner: Owner = {
		parent: currentOwner,
		cleanups: [],
		contexts,
	}
	
	const prevOwner = currentOwner
	currentOwner = owner
	
	try {
		const result = fn()
		return {
			result,
			dispose: () => {
				for(let i = owner.cleanups.length - 1; i >= 0; i--) {
					owner.cleanups[i]()
				}
				owner.cleanups.length = 0
			},
		}
	}
	finally {
		currentOwner = prevOwner
	}
}

export const createEffect = (fn: () => void): void => {
	let disposeInner: (() => void) | null = null
	
	const run: Listener = (): void => {
		cleanupListener(run)
		if(disposeInner !== null) {
			disposeInner()
			disposeInner = null
		}
		
		const prevListener = currentListener
		currentListener = run
		try {
			const owned = runWithOwner(fn)
			disposeInner = owned.dispose
		}
		finally {
			currentListener = prevListener
		}
	}
	
	onCleanup(() => {
		cleanupListener(run)
		if(disposeInner !== null) {
			disposeInner()
		}
	})
	
	run()
}

export const createBaseContext = <T>(defaultValue: T): BaseContext<T> => {
	return {
		id: Symbol("usrv.context"),
		defaultValue,
	}
}

export const useContext = <T>(context: BaseContext<T>): T => {
	let cursor: Owner | null = currentOwner
	while(cursor !== null) {
		if(cursor.contexts.has(context.id)) {
			return cursor.contexts.get(context.id) as T
		}
		cursor = cursor.parent
	}
	return context.defaultValue
}

export function createResource<T, S = true>(fetcher: (source: S) => Promise<T>): [Resource<T>, ResourceActions<T>]

export function createResource<T, S>(source: Accessor<S | undefined | null | false>, fetcher: (source: S) => Promise<T>): [Resource<T>, ResourceActions<T>]

export function createResource<T, S = true>(
	sourceOrFetcher:
		| Accessor<S | undefined | null | false>
		| ((source: S) => Promise<T>),
	maybeFetcher?: (source: S) => Promise<T>,
): [Resource<T>, ResourceActions<T>] {
	const hasSource = typeof maybeFetcher === "function"
	const source: Accessor<S | undefined | null | false> = hasSource
	                                                       ? (sourceOrFetcher as Accessor<S | undefined | null | false>)
	                                                       : () => true as S
	const fetcher = hasSource
	                ? maybeFetcher!
	                : (sourceOrFetcher as (source: S) => Promise<T>)
	
	const [data, setData] = createSignal<T | undefined>(undefined)
	const [loading, setLoading] = createSignal<boolean>(false)
	const [error, setError] = createSignal<unknown>(undefined)
	
	let requestId = 0
	
	const load = async (currentSource: S | undefined | null | false): Promise<T | undefined> => {
		if(currentSource === undefined || currentSource === null || currentSource === false) {
			return data()
		}
		
		const id = ++requestId
		setLoading(true)
		setError(undefined)
		
		try {
			const result = await fetcher(currentSource)
			if(id === requestId) {
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
	
	const read = Object.assign((): T | undefined => data(), {
		loading,
		error,
	})
	
	return [
		read,
		{
			mutate: setData,
			refetch: () => load(source()),
		},
	]
}


export const createStore = <T extends object>(initial: T): [T, StoreSetter<T>] => {
	const propSignals = new WeakMap<object, Map<PropertyKey, [Accessor<number>, Setter<number>]>>()
	
	const getPropTrigger = (target: object, key: PropertyKey): [Accessor<number>, Setter<number>] => {
		let map = propSignals.get(target)
		if(!map) {
			map = new Map()
			propSignals.set(target, map)
		}
		let pair = map.get(key)
		if(!pair) {
			pair = createSignal(0)
			map.set(key, pair)
		}
		return pair
	}
	
	const wrap = <U extends object>(obj: U): U => {
		const raw = ((obj as Record<symbol, U>)[RAW_TARGET] ?? obj) as U
		const existing = PROXY_CACHE.get(raw)
		if(existing) return existing as U
		
		const proxy = new Proxy(raw, {
			get(target, key, receiver) {
				if(key === RAW_TARGET) return raw
				
				// Track array length or property reads when inside an active effect/memo
				if(currentListener !== null && typeof key !== "symbol") {
					const [track] = getPropTrigger(target, key)
					track()
					if(Array.isArray(target)) {
						const [trackLen] = getPropTrigger(target, "length")
						trackLen()
					}
				}
				
				const value = Reflect.get(target, key, receiver)
				if(typeof value === "object" && value !== null) {
					return wrap(value)
				}
				return value
			},
			set(target, key, newValue, receiver) {
				const prevValue = Reflect.get(target, key, receiver)
				const nextRaw =
					typeof newValue === "object" && newValue !== null
					? ((newValue as Record<symbol, unknown>)[RAW_TARGET] ?? newValue)
					: newValue
				
				const changed = !Object.is(prevValue, nextRaw)
				const ok = Reflect.set(target, key, nextRaw, receiver)
				
				if(ok && changed && typeof key !== "symbol") {
					const [, notify] = getPropTrigger(target, key)
					notify((n) => n + 1)
					if(Array.isArray(target)) {
						const [, notifyLen] = getPropTrigger(target, "length")
						notifyLen((n) => n + 1)
					}
				}
				return ok
			},
			deleteProperty(target, key) {
				const hadKey = Object.prototype.hasOwnProperty.call(target, key)
				const ok = Reflect.deleteProperty(target, key)
				if(ok && hadKey && typeof key !== "symbol") {
					const [, notify] = getPropTrigger(target, key)
					notify((n) => n + 1)
				}
				return ok
			},
		})
		
		PROXY_CACHE.set(raw, proxy)
		return proxy
	}
	
	const store = wrap(initial)
	
	const setStore: StoreSetter<T> = (recipe) => {
		batch(() => {
			recipe(store)
		})
	}
	
	return [store, setStore]
}