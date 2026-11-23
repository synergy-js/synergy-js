import { type JSXRenderNode } from "@synergy-js/jsxr"

export interface ComponentOptions {
	selector: string
}

export interface ComponentOptions {
	selector: string
}

export interface Renderable {
	render(): JSXRenderNode
}

type ComponentConstructor = new () => Renderable

// Maps selector string (e.g. "app-counter") -> Component Class
export const selectorRegistry = new Map<string, ComponentConstructor>()

export function Component(options: ComponentOptions) {
	return function <C extends ComponentConstructor>(
		value: C,
		_context: ClassDecoratorContext<C>,
	) {
		if(selectorRegistry.has(options.selector)) {
			throw new Error(`Duplicate component selector: "${options.selector}"`)
		}
		selectorRegistry.set(options.selector, value)
	}
}