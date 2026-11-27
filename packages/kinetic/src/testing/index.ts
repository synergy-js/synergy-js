import { mount } from "../web/index.ts"
import type { JSXElement } from "../types.ts"

export interface RenderResult {
	/** DOM node into which the app was mounted. */
	container: HTMLElement
	/** Dispose the mounted owner and remove an automatically-created container. */
	unmount: () => void
	/** Log the container's current HTML to the console. */
	debug: () => void
	/** Find the last element whose trimmed text matches; throw if not found. */
	getByText: (text: string | RegExp) => HTMLElement
	/** Find the last matching text element or return null. */
	queryByText: (text: string | RegExp) => HTMLElement | null
	/** Find an element by its data-testid; throw if not found. */
	getByTestId: (id: string) => HTMLElement
	/** Find an element by its data-testid or return null. */
	queryByTestId: (id: string) => HTMLElement | null
}

const mountedCleanups = new Set<() => void>()

/** Unmount every tree rendered through this testing helper. */
export const cleanup = (): void => {
	for(const dispose of mountedCleanups) {
		dispose()
	}
	mountedCleanups.clear()
}

/**
 * Mount JSX into a container and return DOM queries plus an unmount function.
 * Containers created by this helper are removed automatically on unmount.
 */
export const render = (
	ui: () => JSXElement,
	options?: {container?: HTMLElement},
): RenderResult => {
	const container =
		options?.container ?? document.body.appendChild(document.createElement("div"))
	const disposeMount = mount(ui, container)
	
	const unmount = () => {
		disposeMount()
		if(!options?.container && container.parentNode) {
			container.remove()
		}
		mountedCleanups.delete(unmount)
	}
	
	mountedCleanups.add(unmount)
	
	const matchesText = (el: Element, matcher: string | RegExp): boolean => {
		const content = el.textContent?.trim() ?? ""
		return typeof matcher === "string" ? content === matcher : matcher.test(content)
	}
	
	const queryByText = (text: string | RegExp): HTMLElement | null => {
		const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT)
		let current = walker.nextNode() as HTMLElement | null
		let match: HTMLElement | null = null
		while(current) {
			if(matchesText(current, text)) {
				match = current
			}
			current = walker.nextNode() as HTMLElement | null
		}
		return match
	}
	
	const getByText = (text: string | RegExp): HTMLElement => {
		const el = queryByText(text)
		if(!el) throw new Error(`Unable to find element with text: ${String(text)}`)
		return el
	}
	
	const queryByTestId = (id: string): HTMLElement | null =>
		container.querySelector<HTMLElement>(`[data-testid="${id}"]`)
	
	const getByTestId = (id: string): HTMLElement => {
		const el = queryByTestId(id)
		if(!el) throw new Error(`Unable to find element with data-testid="${id}"`)
		return el
	}
	
	return {
		container,
		unmount,
		debug: () => console.log(container.innerHTML),
		getByText,
		queryByText,
		getByTestId,
		queryByTestId,
	}
}
