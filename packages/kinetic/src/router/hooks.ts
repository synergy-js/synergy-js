import { currentPath, dataStack, params, setCurrentPath } from "./state.ts"
import type { RouteData, RouteParams } from "./types.ts"

export const useParams = (): RouteParams => params()

export const useLocation = (): string => currentPath()

export const navigateTo = (to: string): void => {
	if(window.location.pathname !== to) {
		window.history.pushState({}, "", to)
		setCurrentPath(to)
	}
}

export const useRouteData = <T = unknown>(): RouteData<T> => {
	const entry = dataStack[dataStack.length - 1]
	if(!entry) {
		return {
			data: () => undefined,
			loading: () => false,
		}
	}
	return entry as RouteData<T>
}
