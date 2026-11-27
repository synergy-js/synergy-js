import type { Accessor, Listener, Setter } from "../types.ts"
import { getOwner, onCleanup, runWithOwnerWithParent } from "./owner.ts"
import {
	cleanupListener,
	getCurrentListener,
	scheduleListener,
	setCurrentListener,
	trackDependency,
} from "./scheduler.ts"

/** Create a reactive value and setter; writes notify subscribers only on value changes. */
export const createSignal = <T>(initial: T): [Accessor<T>, Setter<T>] => {
	let internalValue = initial
	const subscribers = new Set<Listener>()
	
	const read: Accessor<T> = (): T => {
		trackDependency(subscribers)
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

/** Run immediately and again whenever a signal read by the callback changes. */
export const createEffect = (fn: () => void): void => {
	const parentOwner = getOwner()
	let disposeInner: (() => void) | null = null
	
	const run: Listener = (): void => {
		cleanupListener(run)
		if(disposeInner !== null) {
			disposeInner()
			disposeInner = null
		}
		
		const prevListener = getCurrentListener()
		setCurrentListener(run)
		try {
			const owned = runWithOwnerWithParent(fn, parentOwner)
			disposeInner = owned.dispose
		}
		finally {
			setCurrentListener(prevListener)
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

/** Create a cached derived accessor that notifies downstream effects on changed results. */
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
		trackDependency(subscribers)
		return value
	}
}
