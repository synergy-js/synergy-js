import { mount } from "@synergy-js/kinetic"
import { createResource, createSignal } from "@synergy-js/signals"
import { UsersController } from "./routes/users.ts"
import { createClient } from "@synergy-js/nexus/client"
import { createStyleSheet } from "@synergy-js/prism"
import { inject, InjectionToken } from "@synergy-js/infusion"
import { Component } from "./temp/component.ts"

const c = createClient<{users: typeof UsersController}>({
	baseUrl: "",
})

const styles = createStyleSheet({
	button: {
		"background-color": "red",
	},
})

const token = new InjectionToken("Hi", {
	factory: () => ({
		db: 123,
	}),
})

const Counter = () => {
	const [count, setCount] = createSignal(0)
	
	const [res] = createResource(() => c.users.byId("2"))
	
	const infusion = inject<{db: number}>(token)
	
	return (
		
		<div class="p-4">
			<p>{infusion.db}</p>
			<p>{res()?.name}</p>
			<p>Count: {count}</p>
			<button onClick={() => setCount((c) => c + 1)} class={styles.button}>
				+1
			</button>
		</div>
	)
}

mount(() => <Counter />, document.getElementById("root")!)
