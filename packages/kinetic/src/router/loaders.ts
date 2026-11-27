import { createEffect, createSignal, onCleanup } from "../signals"
import type { Accessor, RouteData, RouteDefinition, RouteParams } from "../types.ts"

/**
 * Starts a route loader and exposes its result as reactive state.
 * A changed route params object disposes the prior effect and aborts its request.
 */
export const createRouteData = (
	loader: RouteDefinition["loader"] | undefined,
	params: Accessor<RouteParams>,
): RouteData | null => {
	if(!loader) return null

	const [data, setData] = createSignal<unknown>(undefined)
	const [loading, setLoading] = createSignal(false)
	const [error, setError] = createSignal<unknown>(undefined)

	createEffect(() => {
		const controller = new AbortController()
		const currentParams = params()
		onCleanup(() => controller.abort())
		setLoading(true)
		setError(undefined)

		void Promise.resolve()
			.then(() =>
				controller.signal.aborted
					? undefined
					: loader({params: currentParams, signal: controller.signal}),
			)
			.then((result) => {
				if(!controller.signal.aborted) setData(() => result)
			})
			.catch((err: unknown) => {
				if(!controller.signal.aborted) setError(() => err)
			})
			.finally(() => {
				if(!controller.signal.aborted) setLoading(false)
			})
	})

	return {data, loading, error}
}
