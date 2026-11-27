import { type BaseContext, createBaseContext, onCleanup, runWithOwner } from "@synergy-js/signals"
import type { JSXChild, JSXRenderNode } from "./types.ts"
import { renderFragment } from "./utils.ts"

export interface ContextProviderProps<T> {
	value: T
	children?: JSXChild | (() => JSXChild)
}

export interface Context<T> extends BaseContext<T> {
	Provider: (props: ContextProviderProps<T>) => JSXRenderNode
}

export const createContext = <T>(defaultValue: T): Context<T> => {
	const base: BaseContext<T> = createBaseContext(defaultValue)
	
	const Provider = (props: ContextProviderProps<T>): JSXRenderNode => {
		const owned = runWithOwner(() => {
				const resolved =
					typeof props.children === "function"
					? (props.children as () => JSXChild)()
					: props.children
				return renderFragment(resolved)
			},
			{id: base.id, value: props.value},
		)
		
		onCleanup(owned.dispose)
		return owned.result
	}
	
	return {...base, Provider}
}