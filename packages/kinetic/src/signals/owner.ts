import type { BaseContext, Owner } from "../types.ts"

let currentOwner: Owner | null = null

/** Register cleanup in the current owner; a no-op when no owner is active. */
export const onCleanup = (fn: () => void): void => {
	if(currentOwner !== null) {
		currentOwner.cleanups.push(fn)
	}
}

export const getOwner = (): Owner | null => currentOwner

const createOwner = <T>(
	fn: () => T,
	contextEntry?: {id: symbol; value: unknown},
	parentOwner: Owner | null,
): {result: T; dispose: () => void} => {
	const contexts = new Map<symbol, unknown>()
	if(contextEntry !== undefined) {
		contexts.set(contextEntry.id, contextEntry.value)
	}
	
	const owner: Owner = {
		parent: parentOwner,
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

/** Run a callback in a new disposable owner, optionally providing one context value. */
export const runWithOwner = <T>(
	fn: () => T,
	contextEntry?: {id: symbol; value: unknown},
): {result: T; dispose: () => void} => createOwner(fn, contextEntry, currentOwner)

export const runWithOwnerWithParent = <T>(
	fn: () => T,
	parentOwner: Owner | null,
): {result: T; dispose: () => void} => createOwner(fn, undefined, parentOwner)

/** Read the nearest provided context value, falling back to its default. */
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
