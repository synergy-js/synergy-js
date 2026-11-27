import type { JSXRenderNode, LinkProps } from "../types.ts"
import { navigateTo } from "./hooks.js"
import { currentPath } from "./state.js"
import { jsx } from "../web/jsx-runtime.js"

/**
 * Renders an anchor that uses client-side navigation for eligible same-origin clicks.
 * Modified, external, targeted, and download clicks retain native browser behavior.
 */
export const A = (props: LinkProps): JSXRenderNode => {
	const handleClick = (e: MouseEvent) => {
		if(
			e.defaultPrevented ||
			e.button !== 0 ||
			e.metaKey ||
			e.altKey ||
			e.ctrlKey ||
			e.shiftKey ||
			(props.target !== undefined && props.target.toLowerCase() !== "_self") ||
			(props.download !== undefined && props.download !== false)
		) {
			return
		}

		let destination: URL
		try {
			destination = new URL(props.href, window.location.href)
		}
		catch {
			return
		}
		if(
			destination.origin !== window.location.origin ||
			(destination.protocol !== "http:" && destination.protocol !== "https:")
		) {
			return
		}

		e.preventDefault()
		navigateTo(destination.href)
	}
	
	return jsx("a", {
		href: props.href,
		onClick: handleClick,
		target: props.target,
		download: props.download,
		rel: props.rel,
		class: () =>
			`${props.class ?? ""} ${isActiveLink(props.href) ? "active" : ""}`.trim(),
		children: props.children,
	})
}

/** Returns whether an href resolves to the current same-origin location. */
const isActiveLink = (href: string): boolean => {
	try {
		const target = new URL(href, window.location.href)
		return target.origin === window.location.origin &&
			`${target.pathname}${target.search}${target.hash}` === currentPath()
	}
	catch {
		return false
	}
}
