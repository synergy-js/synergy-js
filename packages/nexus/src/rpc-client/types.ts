type RouteMethods<TClass> = {
	[K in keyof TClass as TClass[K] extends (...args: any[]) => any
	                      ? K
	                      : never]: TClass[K] extends (...args: infer TArgs) => infer TReturn
	                                ? (...args: TArgs) => Promise<Awaited<TReturn>>
	                                : never
}

export type RpcClient<TRoutes extends Record<string, new (...args: any[]) => any>> = {
	[K in keyof TRoutes]: RouteMethods<InstanceType<TRoutes[K]>>
}

export interface ClientOptions {
	baseUrl?: string
	headers?: () => Record<string, string> | Promise<Record<string, string>>
	fetch?: typeof globalThis.fetch
	onError?: (status: number, message: string) => void
}