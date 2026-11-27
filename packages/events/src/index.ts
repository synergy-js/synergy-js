/**
 *
 */
export type HookFn<TArgs extends any[] = any[]> = (...args: TArgs) => any

/**
 *
 */
export type HookMap = Record<string, HookFn>

/**
 *
 */
export const createHooks = <THooks extends HookMap>() => {
	const listeners = new Map<keyof THooks, Set<HookFn>>()
	
	return {
		/**
		 * @template K Key of the hook taken from "user defined registry" (e.g.) `type Hooks = {"myHook1": () => void}`
		 * @param {K} name
		 * @param {Hooks[K]} fn Hook function to execute
		 * @returns {() => boolean}
		 *
		 * @example
		 * ```ts
		 * register("myHookGroup", async () => {
		 * 	await Bun.sleep(20)
		 * 	orderAsync.push("slow")
		 * })
		 *
		 * register("myHookGroup", async () => {
		 * 	await Bun.sleep(5)
		 * 	orderAsync.push("fast")
		 * })
		 * await callParallel("myHookGroup")
		 * ```
		 */
		register<K extends keyof THooks>(name: K, fn: THooks[K]) {
			let set = listeners.get(name)
			if(!set) {
				listeners.set(name, (set = new Set()))
			}
			set.add(fn)
			return () => set!.delete(fn)
		},
		/**
		 * @template K
		 * @param {K} name
		 * @param {any} args
		 * @returns {Promise<void>}
		 * @example
		 * ```ts
		 * 	const order: string[] = []
		 *
		 * 	register("run", () => order.push("1"))
		 *
		 * 	register("run", () => order.push("2"))
		 *
		 * 	await call("run")
		 * ```
		 */
		async call<K extends keyof THooks>(name: K, ...args: Parameters<THooks[K]>) {
			const set = listeners.get(name)
			if(!set) {
				return
			}
			for(const fn of [...set]) {
				await fn(...args)
			}
		},
		
		/**
		 * @template K
		 * @param {K} name
		 * @param {any} args
		 * @returns {Promise<void>}
		 * @example
		 * ```ts
		 * const order: string[] = []
		 *
		 * register("myHookGroup", async () => {
		 * 	await Bun.sleep(20)
		 * 	order.push("slow")
		 * })
		 *
		 * register("myHookGroup", async () => {
		 * 	await Bun.sleep(5)
		 * 	order.push("fast")
		 * })
		 *
		 * await callParallel("myHookGroup")
		 * ```
		 */
		async callParallel<K extends keyof THooks>(name: K, ...args: Parameters<THooks[K]>) {
			const set = listeners.get(name)
			if(!set) {
				return
			}
			await Promise.all([...set].map((fn) => fn(...args)))
		},
	}
}