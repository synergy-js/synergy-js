import { afterEach, beforeEach, describe, expect, it, rs } from "rstack/test"
import {
	createEffect,
	createSignal,
	For,
	mount,
	onCleanup,
	Show,
	type ParentProps,
} from "@synergy-js/kinetic"

type MountedApp = Parameters<typeof mount>[0]

let root: HTMLElement
let activeDisposers: Array<() => void>

const renderApp = (app: MountedApp): (() => void) => {
	const dispose = mount(app, root)
	activeDisposers.push(dispose)
	return dispose
}

const disposeApp = (dispose: () => void): void => {
	dispose()
	activeDisposers = activeDisposers.filter((activeDispose) => activeDispose !== dispose)
}

const textContents = (elements: NodeListOf<Element>): Array<string | null> =>
	Array.from(elements, (element) => element.textContent)

beforeEach(() => {
	root = document.createElement("div")
	root.id = "root"
	document.body.appendChild(root)
	activeDisposers = []
})

afterEach(() => {
	for(const dispose of activeDisposers.splice(0)) {
		dispose()
	}
	root.remove()
})

describe("Kinetic: DOM rendering", () => {
	it("renders intrinsic elements, attributes, and nested children", () => {
		renderApp(() => (
			<section id="hero" class="card primary" data-testid="banner">
				<h1>Welcome</h1>
				<p>Synergy UI</p>
			</section>
		))
		
		const section = root.querySelector("section")
		expect(section).not.toBeNull()
		expect(section?.id).toBe("hero")
		expect(section?.className).toBe("card primary")
		expect(section?.getAttribute("data-testid")).toBe("banner")
		expect(section?.querySelector("h1")?.textContent).toBe("Welcome")
		expect(section?.querySelector("p")?.textContent).toBe("Synergy UI")
	})
	
	it("supports fragments, arrays, and null children", () => {
		const items = ["One", "Two", "Three"]
		renderApp(() => (
			<>
				<span>Header</span>
				<ul>
					{items.map((item) => <li>{item}</li>)}
					{null}
				</ul>
			</>
		))
		
		expect(root.querySelector("span")?.textContent).toBe("Header")
		expect(textContents(root.querySelectorAll("li"))).toEqual(["One", "Two", "Three"])
	})
	
	it("maps className to the DOM class attribute and assigns refs", () => {
		let referencedElement: HTMLElement | undefined
		renderApp(() => (
			<div
				className="using-class-name"
				ref={(element) => {
					referencedElement = element
				}}
			/>
		))
		
		expect(root.firstElementChild?.className).toBe("using-class-name")
		expect(referencedElement).toBe(root.firstElementChild)
	})
	
	it("disposes the mounted owner and clears its DOM", () => {
		const dispose = renderApp(() => <section>Mounted</section>)
		expect(root.textContent).toBe("Mounted")
		
		disposeApp(dispose)
		expect(root.innerHTML).toBe("")
	})
})

describe("Kinetic: Reactivity", () => {
	it("updates text, attributes, and event-driven signals", () => {
		const [count, setCount] = createSignal(0)
		const [active, setActive] = createSignal(false)
		renderApp(() => (
			<div>
				<span class={() => (active() ? "on" : "off")}>
					{() => `Count: ${count()}`}
				</span>
				<button
					type="button"
					disabled={active}
					onClick={() => setCount((current) => current + 1)}
				>
					Increment
				</button>
			</div>
		))
		
		const span = root.querySelector("span")!
		const button = root.querySelector("button")!
		expect(span.textContent).toBe("Count: 0")
		expect(span.className).toBe("off")
		expect(button.disabled).toBe(false)
		
		button.click()
		expect(span.textContent).toBe("Count: 1")
		setActive(true)
		expect(span.className).toBe("on")
		expect(button.disabled).toBe(true)
	})
	
	it("runs effect cleanups when the mounted owner is disposed", () => {
		const events: string[] = []
		
		const Widget = () => {
			createEffect(() => {
				events.push("mounted")
				onCleanup(() => events.push("unmounted"))
			})
			return <div class="widget">Ready</div>
		}
		
		const dispose = renderApp(() => <Widget />)
		expect(root.querySelector(".widget")?.textContent).toBe("Ready")
		expect(events).toEqual(["mounted"])
		
		disposeApp(dispose)
		expect(events).toEqual(["mounted", "unmounted"])
	})
	
	it("does not rerun components for unrelated parent signal updates", () => {
		const componentRuns = rs.fn()
		const [parentSignal, setParentSignal] = createSignal("a")
		
		
		const Badge = (props: ParentProps<{label: string}>) => {
			componentRuns()
			return (
				<div class="badge">
					<strong>{props.label}</strong>
					{props.children}
				</div>
			)
		}
		
		renderApp(() => (
			<div>
				<p>{() => parentSignal()}</p>
				<Badge label="Pro">
					<span>Member</span>
				</Badge>
			</div>
		))
		
		expect(componentRuns).toHaveBeenCalledTimes(1)
		expect(root.querySelector(".badge strong")?.textContent).toBe("Pro")
		expect(root.querySelector(".badge span")?.textContent).toBe("Member")
		
		setParentSignal("b")
		expect(componentRuns).toHaveBeenCalledTimes(1)
		expect(root.querySelector("p")?.textContent).toBe("b")
	})
})

describe("Kinetic: Control Flow Components", () => {
	it("renders, reorders, and removes For rows while retaining keyed row nodes", () => {
		interface Todo {
			id: number
			text: string
		}
		
		const first: Todo = {id: 1, text: "First"}
		const second: Todo = {id: 2, text: "Second"}
		const third: Todo = {id: 3, text: "Third"}
		const [todos, setTodos] = createSignal<readonly Todo[]>([first, second])
		
		renderApp(() => (
			<ul>
				<For each={todos}>
					{(todo, index) => (
						<li data-id={String(todo.id)}>
							{() => `${index()}: ${todo.text}`}
						</li>
					)}
				</For>
			</ul>
		))
		
		const initialRows = Array.from(root.querySelectorAll("li"))
		expect(textContents(root.querySelectorAll("li"))).toEqual([
			"0: First",
			"1: Second",
		])
		
		setTodos([second, third, first])
		const reorderedRows = Array.from(root.querySelectorAll("li"))
		expect(textContents(root.querySelectorAll("li"))).toEqual([
			"0: Second",
			"1: Third",
			"2: First",
		])
		expect(reorderedRows[0]).toBe(initialRows[1])
		expect(reorderedRows[2]).toBe(initialRows[0])
		
		setTodos([third])
		expect(textContents(root.querySelectorAll("li"))).toEqual(["0: Third"])
		expect(root.querySelector("li")?.getAttribute("data-id")).toBe("3")
	})
	
	it("switches Show between fallback and content as its condition changes", () => {
		const [loggedIn, setLoggedIn] = createSignal(false)
		renderApp(() => (
			<Show when={loggedIn} fallback={<p class="guest">Please sign in</p>}>
				<p class="user">Welcome back</p>
			</Show>
		))
		
		expect(root.querySelector(".guest")?.textContent).toBe("Please sign in")
		expect(root.querySelector(".user")).toBeNull()
		
		setLoggedIn(true)
		expect(root.querySelector(".guest")).toBeNull()
		expect(root.querySelector(".user")?.textContent).toBe("Welcome back")
		
		setLoggedIn(false)
		expect(root.querySelector(".guest")?.textContent).toBe("Please sign in")
		expect(root.querySelector(".user")).toBeNull()
	})
})
