import type {
	AppContext,
	Hookable,
	HookConfig,
	HookMap,
	HookTraceEvent,
	ListenerEntry,
	Options,
	SystemHooks,
} from "./types.ts"

export const createHooks = <CustomHooks extends HookMap = {}, Context = {}>(initialContext: Context = {} as Context): AppContext<SystemHooks & CustomHooks, Context> => {
	
	type AllHooks = SystemHooks & CustomHooks
	
	const registry = new Map<keyof AllHooks, Set<ListenerEntry>>()
	const beforeListeners = new Set<(event: HookTraceEvent<AllHooks>) => void>()
	const afterListeners = new Set<(event: HookTraceEvent<AllHooks>) => void>()
	
	const hook = <K extends keyof AllHooks>(name: K, fn: AllHooks[K], options?: Options): (() => void) => {
		let listeners = registry.get(name)
		
		if(!listeners) {
			listeners = new Set()
			registry.set(name, listeners)
		}
		
		const entry: ListenerEntry = {
			fn,
			plugin: options?.name || fn.name || "anonymous",
		}
		
		listeners.add(entry)
		
		return () => {
			listeners?.delete(entry)
			if(listeners?.size === 0) registry.delete(name)
		}
	}
	
	const hookOnce = <K extends keyof AllHooks>(name: K, fn: AllHooks[K], options?: Options): (() => void) => {
		const off = hook(name, ((...args: Parameters<AllHooks[K]>) => {
				off()
				return fn(...args)
			}) as AllHooks[K],
			{name: options?.name || fn.name || "anonymous"},
		)
		
		return off
	}
	
	const addHooks = (config: HookConfig<AllHooks>, options?: Options): (() => void) => {
		const unsubs: (() => void)[] = []
		
		for(const [name, entry] of Object.entries(config)) {
			if(!entry) continue
			const fns = Array.isArray(entry) ? entry : [entry]
			for(const fn of fns) {
				unsubs.push(hook(name as keyof AllHooks, fn, options))
			}
		}
		
		return () => {
			for(const off of unsubs) {
				off()
			}
		}
	}
	
	const beforeEach = (fn: (event: HookTraceEvent<AllHooks>) => void) => {
		beforeListeners.add(fn)
		return () => beforeListeners.delete(fn)
	}
	
	const afterEach = (fn: (event: HookTraceEvent<AllHooks>) => void) => {
		afterListeners.add(fn)
		return () => afterListeners.delete(fn)
	}
	
	const invokeEntry = async <K extends keyof AllHooks>(name: K, entry: ListenerEntry, args: Parameters<AllHooks[K]>) => {
		if(beforeListeners.size === 0 && afterListeners.size === 0) {
			await entry.fn(...args)
			return
		}
		
		const event: HookTraceEvent<AllHooks> = {
			name,
			plugin: entry.plugin,
			args,
			context: {},
		}
		
		for(const fn of beforeListeners) {
			fn(event)
		}
		try {
			await entry.fn(...args)
		}
		finally {
			for(const fn of afterListeners) {
				fn(event)
			}
		}
	}
	
	const callHook = async <K extends keyof AllHooks>(name: K, ...args: Parameters<AllHooks[K]>): Promise<void> => {
		const listeners = registry.get(name)
		if(!listeners) return
		
		for(const entry of [...listeners]) {
			await invokeEntry(name, entry, args)
		}
	}
	
	const callHookParallel = async <K extends keyof AllHooks>(name: K, ...args: Parameters<AllHooks[K]>): Promise<void> => {
		const listeners = registry.get(name)
		if(!listeners) return
		
		await Promise.all(
			[...listeners].map((entry) => invokeEntry(name, entry, args)),
		)
	}
	
	const removeAllHooks = () => {
		registry.clear()
		beforeListeners.clear()
		afterListeners.clear()
	}
	
	const hooks: Hookable<AllHooks> = {
		hook,
		hookOnce,
		addHooks,
		beforeEach,
		afterEach,
		callHook,
		callHookParallel,
		removeAllHooks,
	}
	
	return {
		context: initialContext,
		hooks,
	}
}

/**
 * Curried helper so users can bind their app type once: `const plugin = definePlugin<typeof app>()`
 */
export const definePlugin = <App extends AppContext<any, any>>(): <R = void | Promise<void>>(plugin: (app: App) => R) => (app: App) => R => {
	return <R = void | Promise<void>>(plugin: (app: App) => R) => plugin
}

export type { AppContext, Hookable, HookCallback, HookConfig, HookMap, HookTraceEvent, ListenerEntry, Options, SystemHooks } from "./types.ts"