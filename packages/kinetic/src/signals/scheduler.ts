import type { Listener } from "../types.ts"

let currentListener: Listener | null = null
let batchDepth = 0
const pendingListeners = new Set<Listener>()

export const getCurrentListener = (): Listener | null => currentListener

export const setCurrentListener = (listener: Listener | null): void => {
	currentListener = listener
}

export const trackDependency = (subscribers: Set<Listener>): void => {
	if(currentListener !== null) {
		subscribers.add(currentListener)
		if(!currentListener.deps) {
			currentListener.deps = new Set()
		}
		currentListener.deps.add(subscribers)
	}
}

export const cleanupListener = (listener: Listener): void => {
	if(!listener.deps) return
	for(const depSet of listener.deps) {
		depSet.delete(listener)
	}
	listener.deps.clear()
}

export const scheduleListener = (listener: Listener): void => {
	if(batchDepth > 0) {
		pendingListeners.add(listener)
	}
	else {
		listener()
	}
}

/** Defer subscribed effects until the outermost batch completes. */
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

/** Execute without recording signal reads as dependencies of the current effect. */
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
