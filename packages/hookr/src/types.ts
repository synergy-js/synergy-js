export type HookCallback<T extends any[] = any[], R = any> = (...args: T) => R | Promise<R>

export type HookMap = Record<string, HookCallback>

export type HookConfig<THooks extends HookMap> = {
	[K in keyof THooks]?: THooks[K] | THooks[K][]
}

export type SystemHooks = {
	"server:start": (info: {port?: number, hostname?: string, url?: string}) => void | Promise<void>
	
	"server:ready": () => void | Promise<void>
	
	"server:shutdown": (reason?: string) => void | Promise<void>
	
	"error": (error: unknown, context?: {source?: string}) => void | Promise<void>
}

export type AppContext<Hooks extends HookMap = SystemHooks, Context = {}> = {
	context: Context
	hooks: Hookable<Hooks>
}

export interface HookTraceEvent<THooks extends HookMap = HookMap> {
	name: keyof THooks
	plugin: string
	args: any[]
	context: Record<string, any>
}

export interface HookOptions {
	name?: string
}

export interface ListenerEntry {
	fn: HookCallback
	plugin: string
}

export interface Options {
	name?: string
}

export interface Hookable<THooks extends HookMap> {
	
	hook<K extends keyof THooks>(name: K, fn: THooks[K], options?: HookOptions): () => void
	
	hookOnce<K extends keyof THooks>(name: K, fn: THooks[K], options?: HookOptions): () => void
	
	addHooks(config: HookConfig<THooks>, options?: HookOptions): () => void
	
	beforeEach(fn: (event: HookTraceEvent<THooks>) => void): () => void
	
	afterEach(fn: (event: HookTraceEvent<THooks>) => void): () => void
	
	callHook<K extends keyof THooks>(name: K, ...args: Parameters<THooks[K]>): Promise<void>
	
	callHookParallel<K extends keyof THooks>(name: K, ...args: Parameters<THooks[K]>): Promise<void>
	
	removeAllHooks(): void
}

