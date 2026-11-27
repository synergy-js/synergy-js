import { createMemo, onCleanup, useContext } from "../signals"
import { createRouteData } from "./loaders.js"
import { resolveRouteChain } from "./matchers.js"
import { currentPath, routerContext, setCurrentPath } from "./state.js"
import type { RouterContextValue } from "./state.js"
import type { MatchedRoute, RouteDefinition, JSXRenderNode } from "../types.ts"
import { renderFragment, Show } from "../web"
import type { ShowProps } from "../web/components/show.js"
import { jsx } from "../web"

const syncPopState = (): void => {
	const updateLocation = (): void => {
		setCurrentPath(
			`${window.location.pathname}${window.location.search}${window.location.hash}`,
		)
	}
	updateLocation()
	window.addEventListener("popstate", updateLocation)
	window.addEventListener("hashchange", updateLocation)
	onCleanup(() => {
		window.removeEventListener("popstate", updateLocation)
		window.removeEventListener("hashchange", updateLocation)
	})
}

/** Resolve a browser location into the pathname used for route matching. */
const getPathname = (location: string): string => {
	try {
		return new URL(location, window.location.origin).pathname
	}
	catch {
		return "/"
	}
}

const renderRouteWithContext = (
	context: RouterContextValue,
	activeChain: () => MatchedRoute[],
	index: number,
	matched: MatchedRoute,
): JSXRenderNode => {
	const routeData = createRouteData(matched.route.loader, () => matched.params)
	
	// The stacks provide Outlet and useRouteData with the currently rendering route.
	context.outletStack.push(() => jsx(RouteLevel, {context, activeChain, index: index + 1}))
	context.dataStack.push(routeData)
	try {
		return matched.route.component()
	}
	finally {
		context.outletStack.pop()
		context.dataStack.pop()
	}
}

/**
 * Renders the match at this depth and replaces its owned branch when navigation
 * changes that match. Nested matches are rendered through the parent's Outlet.
 */
const RouteLevel = (props: {
	context: RouterContextValue
	activeChain: () => MatchedRoute[]
	index: number
}): JSXRenderNode => {
	const currentMatch = createMemo(() => props.activeChain()[props.index])

	const showProps: ShowProps<MatchedRoute> = {
		when: currentMatch,
		children: (matched) =>
			renderRouteWithContext(props.context, props.activeChain, props.index, matched),
	}
	return Show(showProps)
}

/** Renders the next matched child route inside its parent route component. */
export const Outlet = (): JSXRenderNode => {
	const renderChild = useContext(routerContext)?.outletStack.at(-1)
	return renderChild ? renderChild() : renderFragment(null)
}

/** Matches browser navigation against route definitions and renders the active chain. */
export const Router = (props: {routes: RouteDefinition[]}): JSXRenderNode => {
	syncPopState()
	
	const pathname = createMemo(() => getPathname(currentPath()))
	const activeChain = createMemo(
		() => resolveRouteChain(props.routes, pathname()) ?? [],
	)
	const context: RouterContextValue = {
		location: currentPath,
		matchedRoutes: activeChain,
		outletStack: [],
		dataStack: [],
	}
	
	return jsx(routerContext.Provider, {
		value: context,
		children: () => jsx(RouteLevel, {context, activeChain, index: 0}),
	})
}
