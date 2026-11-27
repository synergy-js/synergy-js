import { onCleanup, runWithOwner } from "../signals"
import type { JSXChild, JSXElement, BaseContext } from "./../types.ts"
import { renderFragment } from "./utils.ts"

export interface ContextProviderProps<T> {
	value: T
	children?: JSXChild | (() => JSXChild)
}

/** A typed context and its provider component. */
export interface Context<T> extends BaseContext<T> {
	Provider: (props: ContextProviderProps<T>) => JSXElement
}

/** Create a context whose value defaults to `defaultValue` outside a provider. */
export const createContext = <T>(defaultValue: T): Context<T> => {
	const base: BaseContext<T> = createBaseContext(defaultValue)
	
	const Provider = (props: ContextProviderProps<T>): JSXElement => {
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

export const createBaseContext = <T>(defaultValue: T): BaseContext<T> => {
	return {
		id: Symbol("kinetic.context"),
		defaultValue,
	}
}
