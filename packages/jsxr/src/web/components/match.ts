import { Accessor } from "@synergy-js/signals"
import { JSXChild, JSXRenderNode, MatchDescriptor } from "../types.js"

export interface MatchProps<T> {
	when: T | undefined | null | false | Accessor<T | undefined | null | false>
	children?: JSXChild | ((item: NonNullable<T>) => JSXChild)
}

export const Match = <T>(props: MatchProps<T>): JSXRenderNode => {
	const descriptor: MatchDescriptor<T> = {
		__jsxrMatch: true,
		when: props.when,
		children: props.children,
	}
	return descriptor as unknown as JSXRenderNode
}