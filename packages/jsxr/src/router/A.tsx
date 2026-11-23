import type { JSXRenderNode } from "../web"
import { navigateTo } from "./hooks.js"
import { currentPath } from "./state.js"
import type { LinkProps } from "./types.ts"

export const A = (props: LinkProps): JSXRenderNode => {
	const handleClick = (e: MouseEvent) => {
		if(
			e.defaultPrevented ||
			e.button !== 0 ||
			e.metaKey ||
			e.altKey ||
			e.ctrlKey ||
			e.shiftKey
		) {
			return
		}
		e.preventDefault()
		navigateTo(props.href)
	}
	
	return (
		<a
			href={props.href}
			onClick={handleClick}
			class={() =>
				`${props.class ?? ""} ${currentPath() === props.href ? "active" : ""}`.trim()
			}
		>
			{props.children}
		</a>
	)
}
