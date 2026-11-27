import type { JSXChild, JSXElement, MatchDescriptor, Accessor } from "../../types.ts"

export interface MatchProps<T> {
	when: T | undefined | null | false | Accessor<T | undefined | null | false>
	children?: JSXChild | ((item: NonNullable<T>) => JSXChild)
}

/** Declare a conditional branch for a parent `Switch`; renders no DOM by itself. */
export const Match = <T>(props: MatchProps<T>): JSXElement => {
	const descriptor: MatchDescriptor<T> = {
		__jsxrMatch: true,
		when: props.when,
		children: props.children,
	}
	return descriptor as unknown as JSXElement
}