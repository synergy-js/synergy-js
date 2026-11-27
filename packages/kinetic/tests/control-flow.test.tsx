import { describe, expect, it } from "rstack/test"
import {
	createSignal,
	For,
	Match,
	Show,
	Switch,
} from "@synergy-js/kinetic"
import { mountTestApp } from "./helpers/dom.ts"

describe("Kinetic control flow", () => {
	it("supports keyed Show render props and updates when the value changes", () => {
		const [user, setUser] = createSignal<{name: string} | null>(null)
		const {root, dispose} = mountTestApp(() => (
			<Show when={user} fallback={<p>Signed out</p>}>
				{(current) => <p class="user">{current.name}</p>}
			</Show>
		))

		expect(root.textContent).toBe("Signed out")
		setUser({name: "Ada"})
		expect(root.querySelector(".user")?.textContent).toBe("Ada")
		setUser({name: "Grace"})
		expect(root.querySelector(".user")?.textContent).toBe("Grace")
		dispose()
	})

	it("renders the first matching Switch branch and fallback", () => {
		const [state, setState] = createSignal("loading")
		const {root, dispose} = mountTestApp(() => (
			<Switch fallback={<p>Unknown</p>}>
				<Match when={() => state() === "loading"}>
					<p>Loading</p>
				</Match>
				<Match when={() => state() === "ready"}>
					<p>Ready</p>
				</Match>
			</Switch>
		))

		expect(root.textContent).toBe("Loading")
		setState("ready")
		expect(root.textContent).toBe("Ready")
		setState("missing")
		expect(root.textContent).toBe("Unknown")
		dispose()
	})

	it("renders For fallback for empty lists and removes it when rows arrive", () => {
		const [items, setItems] = createSignal<readonly string[]>([])
		const {root, dispose} = mountTestApp(() => (
			<ul>
				<For each={items} fallback={<li class="empty">Empty</li>}>
					{(item) => <li>{item}</li>}
				</For>
			</ul>
		))

		expect(root.querySelector(".empty")?.textContent).toBe("Empty")
		setItems(["one", "two"])
		expect(Array.from(root.querySelectorAll("li"), (item) => item.textContent))
			.toEqual(["one", "two"])
		setItems([])
		expect(root.querySelectorAll("li")).toHaveLength(1)
		expect(root.querySelector(".empty")?.textContent).toBe("Empty")
		dispose()
	})
})
