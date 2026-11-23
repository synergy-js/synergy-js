export type HookFn<Args extends any[] = any[]> = (...args: Args) => any
export type HookMap = Record<string, HookFn>

export const createHooks = <Hooks extends HookMap = Record<string, HookFn>>() => {
	const listeners = new Map<keyof Hooks, Set<HookFn>>()
	
	return {
		register<K extends keyof Hooks>(name: K, fn: Hooks[K]) {
			let set = listeners.get(name)
			if(!set) {
				listeners.set(name, (set = new Set()))
			}
			set.add(fn)
			return () => set!.delete(fn)
		},
		
		async call<K extends keyof Hooks>(name: K, ...args: Parameters<Hooks[K]>) {
			const set = listeners.get(name)
			if(!set) {
				return
			}
			for(const fn of [...set]) {
				await fn(...args)
			}
		},
		
		async callParallel<K extends keyof Hooks>(name: K, ...args: Parameters<Hooks[K]>) {
			const set = listeners.get(name)
			if(!set) {
				return
			}
			await Promise.all([...set].map((fn) => fn(...args)))
		},
	}
}