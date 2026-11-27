export const INJECTABLE_META: unique symbol = Symbol("infusion:injectable")

export type TokenType<T = unknown> = new (...args: never[]) => T

export type ProviderScope = "Singleton" | "Transient" | "Request"

export type AnyToken = | (new (...args: never[]) => unknown) | {readonly description: string; readonly type: "InjectionToken"}


export type Provider =
	| (new (...args: never[]) => unknown)
	| {provide: AnyToken; useValue: unknown; multi?: boolean}
	| {provide: AnyToken; useClass: new (...args: never[]) => unknown; multi?: boolean}
	| {provide: AnyToken; useFactory: () => unknown; multi?: boolean}

export interface InjectableOptions {
	scope?: ProviderScope
}

export interface InjectOptions<T = unknown> {
	optional?: boolean
	self?: boolean
	skipSelf?: boolean
}

export interface InjectableMetadata<T = unknown> {
	scope: ProviderScope
	autoProvided?: boolean
	factory?: () => T
}

export interface OnDestroy {
	onDestroy(): Promise<void> | void
}

export interface ServiceOptions<T = unknown> {
	autoProvided?: boolean
	scope?: ProviderScope
	factory?: () => T
}