import { createContext } from "../web/context.ts"
import type { Context } from "../web/context.ts"
import { createSignal } from "../signals"
import type { Accessor, JSXRenderNode, MatchedRoute, RouteData } from "../types"

const getBrowserLocation = (): string =>
	typeof window === "undefined"
		? "/"
		: `${window.location.pathname}${window.location.search}${window.location.hash}`

// Browser location is shared; route matches and render stacks belong to each Router.
const locationSignal = createSignal<string>(getBrowserLocation())
export const currentPath: Accessor<string> = locationSignal[0]
export const setCurrentPath = (value: string): void => {
	locationSignal[1](value)
}

export interface RouterContextValue {
	location: Accessor<string>
	matchedRoutes: Accessor<MatchedRoute[]>
	outletStack: Array<() => JSXRenderNode>
	dataStack: Array<RouteData | null>
}

export const routerContext: Context<RouterContextValue | null> =
	createContext<RouterContextValue | null>(null)