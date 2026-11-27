import type { Accessor, BaseContext, Setter } from "@synergy-js/signals"

export interface JSXRenderNode {
	tagName: string
	props: Record<string, unknown>
	children: JSXChild[]
	dom: Node
}

export interface JSXChildArray extends Array<JSXChild> {
}

export interface JSXChildAccessor {
	(): JSXChild
}

export type JSXChild =
	| Node
	| JSXRenderNode
	| string
	| number
	| boolean
	| null
	| undefined
	| JSXChildAccessor
	| JSXChildArray
	| Accessor<string | number | boolean | null | undefined>
	| JSXChild[]

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

export type JSXComponent<P = Record<string, unknown>> = (props: P) => JSXRenderNode

export type EventHandlers = {
	[K in keyof HTMLElementEventMap as `on${Capitalize<K>}` | `on${K}`]?: (
		event: HTMLElementEventMap[K],
	) => void
}


export interface MatchDescriptor<T = unknown> {
	readonly __jsxrMatch: true
	when: T | undefined | null | false | Accessor<T | undefined | null | false>
	children?: JSXChild | ((item: NonNullable<T>) => JSXChild)
}

export interface ContextProviderProps<T> {
	value: T
	children?: JSXChild | (() => JSXChild)
}

export interface Context<T> extends BaseContext<T> {
	Provider: (props: ContextProviderProps<T>) => JSXRenderNode
}


export interface RowEntry<T> {
	item: T
	setIndex: Setter<number>
	nodes: Node[]
	dispose: () => void
}