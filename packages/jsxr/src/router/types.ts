import type { JSXRenderNode } from "../../web"

export type RouteParams = Record<string, string>

export interface RouteDefinition<T = unknown> {
	path: string
	component: () => JSXRenderNode
	loader?: (args: {params: RouteParams}) => Promise<T> | T
	children?: RouteDefinition[]
}

export interface MatchedRoute {
	route: RouteDefinition
	params: RouteParams
}

export interface RouteData<T = unknown> {
	data: () => T | undefined
	loading: () => boolean
}

export interface LinkProps {
	href: string
	class?: string
	children?: JSXRenderNode
}