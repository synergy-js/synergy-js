import { createEffect, createMemo, onCleanup } from "@synergy-js/signals"
import { JSXRenderNode, renderFragment, Show } from "../web"
import { createRouteData } from "./loaders.js"
import { resolveRouteChain } from "./matchers.js"
import { currentPath, dataStack, outletStack, setCurrentPath, setParams } from "./state.js"
import type { MatchedRoute, RouteDefinition, RouteParams } from "./types.ts"

const syncPopState = (): void => {
	const onPopState = () => setCurrentPath(window.location.pathname)
	window.addEventListener("popstate", onPopState)
	onCleanup(() => window.removeEventListener("popstate", onPopState))
}

const mergeParams = (chain: MatchedRoute[]): RouteParams =>
	chain.reduce<RouteParams>((acc, item) => ({...acc, ...item.params}), {})

const renderRouteWithContext = (
	activeChain: () => MatchedRoute[],
	index: number,
	route: RouteDefinition,
): JSXRenderNode => {
	const routeData = createRouteData(route.loader)
	
	outletStack.push(() => <RouteLevel activeChain={activeChain} index={index + 1} />)
	dataStack.push(routeData)
	
	try {
		return route.component()
	}
	finally {
		outletStack.pop()
		dataStack.pop()
	}
}

const RouteLevel = (props: {
	activeChain: () => MatchedRoute[]
	index: number
}): JSXRenderNode => {
	const currentRoute = createMemo(() => props.activeChain()[props.index]?.route)
	
	return (
		<Show when={currentRoute}>
			{(route) => renderRouteWithContext(props.activeChain, props.index, route)}
		</Show>
	)
}

export const Outlet = (): JSXRenderNode => {
	const renderChild = outletStack[outletStack.length - 1]
	return renderChild ? renderChild() : renderFragment(null)
}

export const Router = (props: {routes: RouteDefinition[]}): JSXRenderNode => {
	syncPopState()
	
	const activeChain = createMemo(
		() => resolveRouteChain(props.routes, currentPath()) ?? [],
	)
	
	createEffect(() => {
		setParams(mergeParams(activeChain()))
	})
	
	return <RouteLevel activeChain={activeChain} index={0} />
}
