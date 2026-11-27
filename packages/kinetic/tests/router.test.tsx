import { afterEach, describe, expect, it } from "rstack/test"
import {
	A,
	mount,
	navigateTo,
	Outlet,
	Router,
	useLocation,
	useParams,
	useRouteData,
} from "@synergy-js/kinetic"
import { resolveRouteChain } from "../src/router/matchers.ts"
import type { RouteDefinition } from "@synergy-js/kinetic"

const component = () => <div />

afterEach(() => {
	navigateTo("/")
	window.history.replaceState({}, "", "/")
})

describe("Kinetic route matching", () => {
	it("matches static routes and rejects partial paths", () => {
		const routes: RouteDefinition[] = [
			{path: "/about", component},
			{path: "/users", component},
		]

		expect(resolveRouteChain(routes, "/about")?.map(({route}) => route.path))
			.toEqual(["/about"])
		expect(resolveRouteChain(routes, "/about/team")).toBeNull()
		expect(resolveRouteChain(routes, "/missing")).toBeNull()
	})

	it("extracts and decodes dynamic params", () => {
		const routes: RouteDefinition[] = [
			{path: "/users/:userId", component},
		]

		expect(resolveRouteChain(routes, "/users/Ada%20Lovelace")?.[0]?.params)
			.toEqual({userId: "Ada Lovelace"})
	})

	it("prefers static paths over earlier dynamic definitions", () => {
		const routes: RouteDefinition[] = [
			{path: "/users/:userId", component},
			{path: "/users/settings", component},
		]

		expect(resolveRouteChain(routes, "/users/settings")?.[0]?.route.path)
			.toBe("/users/settings")
		expect(resolveRouteChain(routes, "/users/42")?.[0]?.params.userId)
			.toBe("42")
	})

	it("matches pathname independently of query and hash and rejects malformed params", () => {
		const routes: RouteDefinition[] = [
			{path: "/users/:userId", component},
		]

		expect(resolveRouteChain(routes, "/users/42?tab=posts#latest")?.[0]?.params.userId)
			.toBe("42")
		expect(resolveRouteChain([{path: "/caf%C3%A9", component}], "/café")).not.toBeNull()
		expect(resolveRouteChain(routes, "/users/%E0%A4%A")).toBeNull()
	})

	it("matches nested routes and falls back to the parent on its exact path", () => {
		const routes: RouteDefinition[] = [
			{
				path: "/users/:userId",
				component,
				children: [
					{path: "settings", component},
					{path: "posts/:postId", component},
				],
			},
		]

		expect(resolveRouteChain(routes, "/users/7/settings")?.map(({route}) => route.path))
			.toEqual(["/users/:userId", "settings"])
		expect(resolveRouteChain(routes, "/users/7/posts/12")?.map(({route}) => route.path))
			.toEqual(["/users/:userId", "posts/:postId"])
		expect(resolveRouteChain(routes, "/users/7")?.map(({route}) => route.path))
			.toEqual(["/users/:userId"])
	})

	it("exposes navigation state and decoded params", () => {
		expect(useLocation()).toBe("/")
		navigateTo("/users/42")
		expect(useLocation()).toBe("/users/42")
		expect(window.location.pathname).toBe("/users/42")
		expect(useParams()).toEqual({})
	})

	it("renders nested routes, updates route params, and navigates with links", () => {
		navigateTo("/users/42/settings")
		const root = document.createElement("div")
		document.body.appendChild(root)
		const routes: RouteDefinition[] = [
			{
				path: "/users/:userId",
				component: () => {
					const params = useParams()
					return (
						<section>
							<p class="user-id">{params.userId}</p>
							<Outlet />
						</section>
					)
				},
				children: [
					{
						path: "settings",
						component: () => <h1>Settings</h1>,
					},
				],
			},
			{
				path: "/home",
				component: () => (
					<A href="/users/7/settings">
						<span>Open user</span>
					</A>
				),
			},
		]
		const dispose = mount(() => <Router routes={routes} />, root)

		expect(root.querySelector(".user-id")?.textContent).toBe("42")
		expect(root.querySelector("h1")?.textContent).toBe("Settings")

		navigateTo("/home")
		expect(root.querySelector("a")?.textContent).toBe("Open user")
		root.querySelector("a")?.dispatchEvent(
			new MouseEvent("click", {bubbles: true, cancelable: true, button: 0}),
		)
		expect(useLocation()).toBe("/users/7/settings")
		expect(root.querySelector(".user-id")?.textContent).toBe("7")

		dispose()
		root.remove()
	})

	it("preserves query strings and hashes while navigating", () => {
		navigateTo("/search?q=kinetic#results")

		expect(useLocation()).toBe("/search?q=kinetic#results")
		expect(window.location.pathname).toBe("/search")
		expect(window.location.search).toBe("?q=kinetic")
		expect(window.location.hash).toBe("#results")
		expect(() => navigateTo("https://example.com/")).toThrow(
			"Cannot navigate to this URL",
		)
	})

	it("updates routes on browser back/forward navigation", () => {
		const root = document.createElement("div")
		document.body.appendChild(root)
		const routes: RouteDefinition[] = [
			{path: "/first", component: () => <p>First</p>},
			{path: "/second", component: () => <p>Second</p>},
		]
		const dispose = mount(() => <Router routes={routes} />, root)
		navigateTo("/first")
		navigateTo("/second")
		expect(root.textContent).toBe("Second")

		window.history.replaceState({}, "", "/first?from=history")
		window.dispatchEvent(new PopStateEvent("popstate"))
		expect(root.textContent).toBe("First")
		expect(useLocation()).toBe("/first?from=history")

		window.history.replaceState({}, "", "/first?from=history#details")
		window.dispatchEvent(new HashChangeEvent("hashchange"))
		expect(useLocation()).toBe("/first?from=history#details")

		dispose()
		root.remove()
	})

	it("does not intercept modified, external, targeted, or download links", () => {
		const root = document.createElement("div")
		document.body.appendChild(root)
		const routes: RouteDefinition[] = [
			{
				path: "/links",
				component: () => (
					<div>
						<A href="/next"><span class="internal">Internal</span></A>
						<A href="https://example.com"><span class="external">External</span></A>
						<A href="/next" target="_blank"><span class="targeted">Targeted</span></A>
						<A href="/next" download><span class="download">Download</span></A>
					</div>
				),
			},
			{path: "/next", component: () => <p>Next</p>},
		]
		navigateTo("/links")
		const dispose = mount(() => <Router routes={routes} />, root)

		const externalClick = new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
			button: 0,
		})
		root.querySelector(".external")?.dispatchEvent(externalClick)
		expect(externalClick.defaultPrevented).toBe(false)
		expect(useLocation()).toBe("/links")

		const modifiedClick = new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
			button: 0,
			metaKey: true,
		})
		root.querySelector(".internal")?.dispatchEvent(modifiedClick)
		expect(modifiedClick.defaultPrevented).toBe(false)

		const alreadyPrevented = new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
			button: 0,
		})
		alreadyPrevented.preventDefault()
		root.querySelector(".internal")?.dispatchEvent(alreadyPrevented)
		expect(useLocation()).toBe("/links")

		const nonPrimaryClick = new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
			button: 1,
		})
		root.querySelector(".internal")?.dispatchEvent(nonPrimaryClick)
		expect(nonPrimaryClick.defaultPrevented).toBe(false)

		for(const selector of [".targeted", ".download"]) {
			const click = new MouseEvent("click", {
				bubbles: true,
				cancelable: true,
				button: 0,
			})
			root.querySelector(selector)?.dispatchEvent(click)
			expect(click.defaultPrevented).toBe(false)
		}

		const ordinaryClick = new MouseEvent("click", {
			bubbles: true,
			cancelable: true,
			button: 0,
		})
		root.querySelector(".internal")?.dispatchEvent(ordinaryClick)
		expect(ordinaryClick.defaultPrevented).toBe(true)
		expect(useLocation()).toBe("/next")
		expect(root.textContent).toBe("Next")

		dispose()
		root.remove()
	})

	it("keeps params isolated between router instances", () => {
		const firstRoot = document.createElement("div")
		const secondRoot = document.createElement("div")
		document.body.append(firstRoot, secondRoot)
		const firstRoutes: RouteDefinition[] = [
			{
				path: "/:firstId",
				component: () => <p class="first">{useParams().firstId}</p>,
			},
		]
		const secondRoutes: RouteDefinition[] = [
			{
				path: "/:secondId",
				component: () => <p class="second">{useParams().secondId}</p>,
			},
		]
		navigateTo("/11")
		const disposeFirst = mount(() => <Router routes={firstRoutes} />, firstRoot)
		const disposeSecond = mount(() => <Router routes={secondRoutes} />, secondRoot)

		expect(firstRoot.querySelector(".first")?.textContent).toBe("11")
		expect(secondRoot.querySelector(".second")?.textContent).toBe("11")
		navigateTo("/22")
		expect(firstRoot.querySelector(".first")?.textContent).toBe("22")
		expect(secondRoot.querySelector(".second")?.textContent).toBe("22")

		disposeFirst()
		disposeSecond()
		firstRoot.remove()
		secondRoot.remove()
	})

	it("exposes loader data, loading state, and errors without unhandled rejections", async () => {
		const root = document.createElement("div")
		document.body.appendChild(root)
		const routes: RouteDefinition[] = [
			{
				path: "/loaded",
				loader: async () => "ready",
				component: () => {
					const routeData = useRouteData<string>()
					return <p>{() => `${routeData.loading()}:${routeData.data() ?? ""}`}</p>
				},
			},
			{
				path: "/failed",
				loader: async () => {
					throw new Error("load failed")
				},
				component: () => {
					const routeData = useRouteData<string>()
					return (
						<p>{() => `${routeData.loading()}:${String(routeData.error() ?? "")}`}</p>
					)
				},
			},
		]
		navigateTo("/loaded")
		const dispose = mount(() => <Router routes={routes} />, root)
		expect(root.textContent).toBe("true:")
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(root.textContent).toBe("false:ready")

		navigateTo("/failed")
		expect(root.textContent).toBe("true:")
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(root.textContent).toBe("false:Error: load failed")

		dispose()
		root.remove()
	})

	it("aborts obsolete loader requests and ignores their late results", async () => {
		const root = document.createElement("div")
		document.body.appendChild(root)
		const requests = new Map<
			string,
			{signal: AbortSignal; resolve: (value: string) => void}
		>()
		const routes: RouteDefinition[] = [
			{
				path: "/items/:itemId",
				loader: ({params, signal}) =>
					new Promise<string>((resolve) => {
						requests.set(params.itemId!, {signal, resolve})
					}),
				component: () => {
					const routeData = useRouteData<string>()
					return <p>{() => routeData.data() ?? "pending"}</p>
				},
			},
		]
		navigateTo("/items/1")
		const dispose = mount(() => <Router routes={routes} />, root)
		await Promise.resolve()
		navigateTo("/items/2")
		await Promise.resolve()

		expect(requests.get("1")?.signal.aborted).toBe(true)
		requests.get("2")?.resolve("new")
		await new Promise((resolve) => setTimeout(resolve, 0))
		requests.get("1")?.resolve("old")
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(root.textContent).toBe("new")

		dispose()
		root.remove()
	})
})
