import type { Accessor, Setter, StoreSetter } from "../types.ts"
import { batch, getCurrentListener } from "./scheduler.ts"
import { createSignal } from "./signal.ts"

const RAW_TARGET = Symbol("kinetic.store.raw")
const PROXY_CACHE = new WeakMap<object, object>()

/**
 * Create a deeply proxied object whose accessed properties track independently.
 * Apply mutations in the recipe callback; its writes are batched together.
 */
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
				
				if(getCurrentListener() !== null && typeof key !== "symbol") {
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
