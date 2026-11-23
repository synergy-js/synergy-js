import { mount } from "@synergy-js/jsxr"
import { createResource, createSignal } from "@synergy-js/signals"
import { UsersController } from "./routes/users.ts"
import { createClient } from "@synergy-js/srvr/client"
import { createStyleSheet } from "@synergy-js/css"
import { inject, InjectionToken } from "@synergy-js/infusion"


const c = createClient<{users: typeof UsersController}>({
	baseUrl: "",
})

const styles = createStyleSheet({
	button: {
		"background-color": "red",
	},
})

export const Counter = async () => {
	const [count, setCount] = createSignal(0)
	const [res] = createResource(() => c.users.byId("2"))
	
	const token = new InjectionToken("Hi", {})
	
	const infusion = inject<{db: number}>(token, {
		useFactory: () => ({
			db: 1234,
		}),
	})
	
	return (
		<div class="p-4">
			<p>{infusion.db}</p>
			<p>{res()?.name}</p>
			<p>Count: {count}</p>
			<button onClick={() => setCount((c) => c + 1)} class={styles.button}>+1</button>
		</div>
	)
}

const cn = await Counter()


mount(cn, document.getElementById("root")!)