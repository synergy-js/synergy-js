import { createEffect, createSignal } from "@synergy-js/signals"
import { params } from "./state"
import type { RouteData, RouteDefinition, RouteParams } from "./types"

const fetchRouteData = async (
	loader: NonNullable<RouteDefinition["loader"]>,
	currentParams: RouteParams,
	setData: (value: unknown) => void,
	setLoading: (value: boolean) => void,
): Promise<void> => {
	setLoading(true)
	try {
		const res = await loader({params: currentParams})
		setData(res)
	}
	finally {
		setLoading(false)
	}
}

export const createRouteData = (loader?: RouteDefinition["loader"]): RouteData | null => {
	if(!loader) return null
	
	const [data, setData] = createSignal<unknown>(undefined)
	const [loading, setLoading] = createSignal(true)
	
	createEffect(() => {
		const currentParams = params()
		void fetchRouteData(loader, currentParams, setData, setLoading)
	})
	
	return {data, loading}
}
