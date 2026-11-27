/** @jsxImportSource @synergy-js/jsxr */
import { afterEach, beforeEach, describe, expect, test, rs } from "rstack/test"
import { createSignal } from "@synergy-js/signals"
import { For, mount, onMount, Show } from "../src/index.js"

describe("@synergy-js/jsxr", () => {
	let root: HTMLElement
	
	beforeEach(() => {
		root = document.createElement("div")
		root.id = "root"
		document.body.appendChild(root)
	})
	
	afterEach(() => {
		root.remove()
	})
	
	test("renders intrinsic HTML elements, attributes, classes, and nested children", () => {
		const dispose = mount(
			() => (
				<section id="hero" class="card primary" data-testid="banner">
					<h1>Welcome</h1>
					<p>Synergy UI</p>
				</section>
			),
			root,
		)
		
		const section = root.querySelector("section")
		expect(section).not.toBeNull()
		expect(section?.id).toBe("hero")
		expect(section?.className).toBe("card primary")
		expect(section?.getAttribute("data-testid")).toBe("banner")
		expect(section?.querySelector("h1")?.textContent).toBe("Welcome")
		expect(section?.querySelector("p")?.textContent).toBe("Synergy UI")
		
		dispose()
		expect(root.innerHTML).toBe("")
	})
	
	test("supports Fragments (<>...</>) and arrays of children", () => {
		const items = ["One", "Two", "Three"]
		
		const dispose = mount(
			() => (
				<>
					<span>Header</span>
					<ul>
						{items.map((item) => (
							<li>{item}</li>
						))}
					</ul>
				</>
			),
			root,
		)
		
		expect(root.querySelector("span")?.textContent).toBe("Header")
		const liTexts = Array.from(root.querySelectorAll("li")).map((li) => li.textContent)
		expect(liTexts).toEqual(["One", "Two", "Three"])
		
		dispose()
	})
	
	test("updates text nodes and attributes reactively when signals change", () => {
		const [count, setCount] = createSignal(0)
		const [active, setActive] = createSignal(false)
		
		const dispose = mount(
			() => (
				<div>
					<span class={() => (active() ? "on" : "off")}>Count: {count}</span>
					<button type="button" disabled={active} onClick={() => setCount((c) => c + 1)}>
						Increment
					</button>
				</div>
			),
			root,
		)
		
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
		
		dispose()
	})
	
	test("passes props and children to functional components without tracking parent signals", () => {
		const spy = rs.fn()
		const [parentSignal, setParentSignal] = createSignal("a")
		
		const Badge = (props: {label: string; children?: unknown}) => {
			spy()
			return (
				<div class="badge">
					<strong>{props.label}</strong>
					{props.children}
				</div>
			)
		}
		
		const dispose = mount(
			() => (
				<div>
					<p>{parentSignal}</p>
					<Badge label="Pro">
						<span>Member</span>
					</Badge>
				</div>
			),
			root,
		)
		
		expect(spy).toHaveBeenCalledTimes(1)
		expect(root.querySelector(".badge strong")?.textContent).toBe("Pro")
		expect(root.querySelector(".badge span")?.textContent).toBe("Member")
		
		// Updating parent signal should NOT re-instantiate Badge
		setParentSignal("b")
		expect(spy).toHaveBeenCalledTimes(1)
		expect(root.querySelector("p")?.textContent).toBe("b")
		
		dispose()
	})
	
	test("runs onMount callbacks on setup and registers cleanup on dispose", () => {
		const events: string[] = []
		
		const Widget = () => {
			onMount(() => {
				events.push("mounted")
				return () => events.push("unmounted")
			})
			
			return <div class="widget">Ready</div>
		}
		
		const dispose = mount(() => <Widget />, root)
		expect(root.querySelector(".widget")?.textContent).toBe("Ready")
		expect(events).toEqual(["mounted"])
		
		dispose()
		expect(events).toEqual(["mounted", "unmounted"])
	})
	
	test("<For> renders lists reactively across reorders and updates", () => {
		interface Todo {
			id: number
			text: string
		}
		
		const [todos, setTodos] = createSignal<Todo[]>([
			{id: 1, text: "First"},
			{id: 2, text: "Second"},
		])
		
		const dispose = mount(
			() => (
				<ul>
					<For each={todos}>{(item) => <li data-id={String(item.id)}>{item.text}</li>}</For>
				</ul>
			),
			root,
		)
		
		const ul = root.querySelector("ul")!
		expect(Array.from(ul.querySelectorAll("li")).map((el) => el.textContent)).toEqual(["First", "Second"])
		
		// Reorder and append item
		setTodos([
			{id: 2, text: "Second"},
			{id: 3, text: "Third"},
			{id: 1, text: "First"},
		])
		
		const updatedLis = Array.from(ul.querySelectorAll("li"))
		expect(updatedLis.map((el) => el.textContent)).toEqual(["Second", "Third", "First"])
		expect(updatedLis.map((el) => el.getAttribute("data-id"))).toEqual(["2", "3", "1"])
		
		dispose()
	})
	
	test("<Show> conditionally mounts and swaps fallback content reactively", () => {
		const [loggedIn, setLoggedIn] = createSignal(false)
		
		const dispose = mount(
			() => (
				<Show when={loggedIn} fallback={<p class="guest">Please sign in</p>}>
					<p class="user">Welcome back</p>
				</Show>
			),
			root,
		)
		
		expect(root.querySelector(".guest")?.textContent).toBe("Please sign in")
		expect(root.querySelector(".user")).toBeNull()
		
		setLoggedIn(true)
		expect(root.querySelector(".guest")).toBeNull()
		expect(root.querySelector(".user")?.textContent).toBe("Welcome back")
		
		setLoggedIn(false)
		expect(root.querySelector(".guest")?.textContent).toBe("Please sign in")
		expect(root.querySelector(".user")).toBeNull()
		
		dispose()
	})
})
