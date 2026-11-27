//#region JSX
export interface JSXElement {
	tagName: string
	props: Record<string, unknown>
	children: JSXChild[]
	dom: Node
}

export type JSXRenderNode = JSXElement

/** Array form of JSX child content. */
export interface JSXChildArray extends Array<JSXChild> {
}

export interface JSXChildAccessor {
	(): JSXChild
}


/** For components that accept optional children (layouts, cards, buttons, providers). */
export type ParentProps<P = {}> = P & {
	children?: JSXElement
}

/** Helper type for components typed with ParentProps. */
export type ParentComponent<P = {}> = (props: ParentProps<P>) => JSXElement

/** For components that must not accept children (inputs, icons, void elements). */
export type VoidProps<P = {}> = P & {
	children?: never
}

export type VoidComponent<P = {}> = (props: VoidProps<P>) => JSXElement

/** Props shape for components that receive children or render functions. */
export type FlowProps<P = {}, C = JSXElement> = P & {
	children: C
}

export type FlowComponent<P = {}, C = JSXElement> = (props: FlowProps<P, C>) => JSXElement


/** Values accepted as JSX children, including accessors for reactive output. */
export type JSXChild =
	| Node
	| JSXElement
	| string
	| number
	| boolean
	| null
	| undefined
	| JSXChildAccessor
	| JSXChildArray
	| Accessor<string | number | boolean | null | undefined>
	| JSXChild[]

export type EventHandler<E extends Event = Event> =
	| ((event: E) => unknown)
	| {}
	| null
	| undefined
	| boolean

export type EventHandlers = {
	[K in keyof HTMLElementEventMap as `on${Capitalize<K>}` | `on${K}`]?: EventHandler<HTMLElementEventMap[K]>
} & {
	// Optional fallback for custom events (e.g. CustomEvent)
	[key: `on${string}`]: EventHandler<Event>
}

export interface CustomLayoutOverrides<TElement extends Element = HTMLElement> {
	class?: string | Accessor<string>
	className?: string | Accessor<string>
	style?: string | Partial<CSSStyleDeclaration>
	ref?: (el: TElement) => void
	children?: JSXChild
	key?: string | number
}

export type ReactiveAttributes<T> = {
	[K in keyof T]?: T[K] | Accessor<T[K]>
}

export type ReactiveProps<K extends keyof HTMLElementTagNameMap> = ReactiveAttributes<
	Omit<Partial<HTMLElementTagNameMap[K]>, keyof CustomLayoutOverrides | keyof EventHandlers | "children">> &
	CustomLayoutOverrides<HTMLElementTagNameMap[K]> &
	EventHandlers

export type JSXComponent<P = Record<string, unknown>> = (props: P) => JSXElement

/** Internal description of one conditional branch collected by `Switch`. */
export interface MatchDescriptor<T = unknown> {
	readonly __jsxrMatch: true
	when: T | undefined | null | false | Accessor<T | undefined | null | false>
	children?: JSXChild | ((item: NonNullable<T>) => JSXChild)
}

//@endregion

//#region Router
export type RouteParams = Record<string, string>

/** A route component, optional data loader, and nested child routes. */
export interface RouteDefinition<T = unknown> {
	/** Absolute or parent-relative URL path; `:name` segments capture params. */
	path: string
	/** Setup function rendered when this route is active. */
	component: () => JSXElement
	/** Optional data loader; its signal is aborted when the route scope is disposed. */
	loader?: (args: {params: RouteParams; signal: AbortSignal}) => Promise<T> | T
	/** Nested route definitions matched after this route's path. */
	children?: RouteDefinition[]
}

/** One route and the decoded params accumulated through its parent chain. */
export interface MatchedRoute {
	route: RouteDefinition
	params: RouteParams
}

/** Reactive result returned by `useRouteData`. */
export interface RouteData<T = unknown> {
	/** Latest successful loader result, or undefined before a result is available. */
	data: () => T | undefined
	/** Whether the active loader request is still in progress. */
	loading: () => boolean
	/** Latest loader error, if the request failed. */
	error: () => unknown
}

/** Props accepted by the router's enhanced anchor component. */
export interface LinkProps {
	href: string
	class?: string
	children?: JSXElement
	/** Target browsing context; non-self targets are not intercepted. */
	target?: string
	/** Download hint; links with this attribute are not intercepted. */
	download?: boolean | string
	rel?: string
}

//#endregion


//#region Signals
export type Listener = (() => void) & {deps?: Set<Set<Listener>>}

/** Setter callback that mutates a store through its tracked proxy. */
export type StoreSetter<T> = (recipe: (draft: T) => void) => void

/** Read a reactive value and subscribe the current computation to it. */
export type Accessor<T> = () => T

/** Write a value or derive the next value from the current one. */
export type Setter<T> = (next: T | ((prev: T) => T)) => T

/** Reactive scope that owns cleanup callbacks and context values. */
export interface Owner {
	parent: Owner | null
	cleanups: Array<() => void>
	contexts: Map<symbol, unknown>
}

/** Identity and fallback value shared by a context and its provider. */
export interface BaseContext<T> {
	readonly id: symbol
	readonly defaultValue: T
}

/** Readable async value with reactive status accessors. */
export interface Resource<T> {
	(): T | undefined
	
	/** True while the initial request or a refetch is running. */
	loading: Accessor<boolean>
	/** Most recent fetch error. */
	error: Accessor<unknown>
	/** Current unresolved, pending, ready, refreshing, or error state. */
	state: Accessor<ResourceState>
}

/** Imperative operations paired with a resource accessor. */
export interface ResourceActions<T> {
	mutate: Setter<T | undefined>
	refetch: () => Promise<T | undefined>
}

export type ResourceState = "unresolved" | "pending" | "ready" | "refreshing" | "error"
//#endregion