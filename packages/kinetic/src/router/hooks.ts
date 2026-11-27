import { useContext } from "../signals"
import type { RouteData, RouteParams } from "../types.ts"
import { currentPath, routerContext, setCurrentPath } from "./state.ts"

/** Returns the active route's params as a live object view. */
export const useParams = (): RouteParams => {
	const router = useContext(routerContext)
	const getParams = (): RouteParams =>
		router?.matchedRoutes().at(-1)?.params ?? {}

	return new Proxy({} as RouteParams, {
		get: (_target, key) =>
			typeof key === "string" ? getParams()[key] : undefined,
		has: (_target, key) => typeof key === "string" && key in getParams(),
		ownKeys: () => Reflect.ownKeys(getParams()),
		getOwnPropertyDescriptor: (_target, key) => {
			if(typeof key !== "string" || !(key in getParams())) return undefined
			return {
				configurable: true,
				enumerable: true,
				value: getParams()[key],
			}
		},
	})
}

/** Returns the current pathname, query string, and hash. */
export const useLocation = (): string =>
	useContext(routerContext)?.location() ?? currentPath()

/**
 * Navigates to a same-origin HTTP(S) URL and updates mounted routers.
 * Throws when called outside a browser or given a URL with another origin.
 */
export const navigateTo = (to: string): void => {
	if(typeof window === "undefined") {
		throw new Error("navigateTo() requires a browser environment")
	}

	const next = new URL(to, window.location.href)
	if(
		next.origin !== window.location.origin ||
		(next.protocol !== "http:" && next.protocol !== "https:")
	) {
		throw new Error(`Cannot navigate to this URL with navigateTo(): ${next.href}`)
	}

	const location = `${next.pathname}${next.search}${next.hash}`
	if(location !== currentPath()) {
		window.history.pushState({}, "", location)
	}
	setCurrentPath(location)
}

/** Returns the active route loader's reactive data, loading state, and error. */
export const useRouteData = <T = unknown>(): RouteData<T> => {
	const entry = useContext(routerContext)?.dataStack.at(-1)
	return (entry ?? {
		data: () => undefined,
		loading: () => false,
		error: () => undefined,
	}) as RouteData<T>
}
