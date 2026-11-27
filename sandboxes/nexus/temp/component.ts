import { getActiveContainer, type Provider } from "@synergy-js/infusion"
import { type JSX } from "@synergy-js/jsxr"
import { onCleanup } from "@synergy-js/signals"

const onMount = (fn: () => void | (() => void)): void => {
	const cleanup = fn()
	if(typeof cleanup === "function") {
		onCleanup(cleanup)
	}
}

export interface ComponentOptions {
	providers?: readonly Provider[]
}

export interface OnInit {
	onInit(): void | (() => void)
}

export interface ComponentInstance<TProps = Record<string, unknown>> {
	render(props: TProps): JSX.Element
	
	onInit?(): void | (() => void)
	
	onDestroy?(): void | Promise<void>
}

export type ComponentConstructor<TProps = Record<string, unknown>> = new () => ComponentInstance<TProps>

export function Component(options: ComponentOptions = {}) {
	return function <TClass extends ComponentConstructor<never>>(
		TargetClass: TClass,
		_context?: ClassDecoratorContext<TClass>,
	): TClass {
		const ComponentWrapper = (props: Record<string, unknown>): JSX.Element => {
			const scope = getActiveContainer().createChild(options.providers)
			const instance = scope.start(() => new TargetClass())
			
			if(typeof instance.onInit === "function") {
				onMount(() => instance.onInit!())
			}
			
			onCleanup(() => {
				if(typeof instance.onDestroy === "function") {
					void instance.onDestroy()
				}
				void scope.destroy()
			})
			
			return scope.start(() => instance.render(props as never))
		}
		
		Object.defineProperty(ComponentWrapper, "name", {value: TargetClass.name})
		return ComponentWrapper as unknown as TClass
	}
}
