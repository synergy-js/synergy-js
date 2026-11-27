import { mount } from "@synergy-js/jsxr"
import { createSignal } from "@synergy-js/signals"
import { createStyleSheet, createTokens, createVariants } from "@synergy-js/prism"
import { inject, InjectionToken } from "@synergy-js/infusion"

const tokens = createTokens({
	colors: {
		primary: "#5b50e1",
	},
})

const styles = createStyleSheet({
	button: {
		"background-color": tokens.colors.primary,
	},
})

const variants = createVariants({
	base: {
		"background-color": tokens.colors.primary,
		color: "#c5cad8",
	},
	variants: {
		variant: {
			small: {
				padding: "1px",
			},
			medium: {
				padding: "2px",
			},
			large: {
				padding: "4px",
			},
		},
	},
})


const token = new InjectionToken("Hi", {
	factory: () => ({
		db: 123,
	}),
})

const Counter = () => {
	const [count, setCount] = createSignal(0)
	
	const infusion = inject<{db: number}>(token)
	
	return (
		<div class="p-4">
			<p>{infusion.db}</p>
			<p>Count: {count}</p>
			<button onClick={setCount((_n) => count() + 1)} class={variants({variant: "medium"})}>
				Click me
			</button>
		</div>
	)
}

mount(() => <Counter />, document.getElementById("root")!)
