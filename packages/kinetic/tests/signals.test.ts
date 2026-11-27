import { describe, expect, it } from "rstack/test"
import {
	batch,
	createEffect,
	createMemo,
	createResource,
	createSignal,
	createStore,
	onCleanup,
	runWithOwner,
} from "@synergy-js/kinetic"

describe("Kinetic signals", () => {
	it("updates values, supports updater functions, and skips unchanged values", () => {
		const [count, setCount] = createSignal(1)
		const values: number[] = []
		const owner = runWithOwner(() => createEffect(() => values.push(count())))

		expect(setCount((value) => value + 1)).toBe(2)
		expect(setCount(2)).toBe(2)
		expect(count()).toBe(2)
		expect(values).toEqual([1, 2])

		owner.dispose()
		setCount(3)
		expect(values).toEqual([1, 2])
	})

	it("batches updates so subscribers run once with the final values", () => {
		const [first, setFirst] = createSignal(1)
		const [second, setSecond] = createSignal(2)
		const seen: Array<[number, number]> = []
		const owner = runWithOwner(() =>
			createEffect(() => seen.push([first(), second()])),
		)

		batch(() => {
			setFirst(3)
			setSecond(4)
			setFirst(5)
		})

		expect(seen).toEqual([[1, 2], [5, 4]])
		owner.dispose()
	})

	it("tracks conditional dependencies and removes stale subscriptions", () => {
		const [useFirst, setUseFirst] = createSignal(true)
		const [first, setFirst] = createSignal("first")
		const [second, setSecond] = createSignal("second")
		const values: string[] = []
		const owner = runWithOwner(() =>
			createEffect(() => {
				values.push(useFirst() ? first() : second())
			}),
		)

		setUseFirst(false)
		setFirst("ignored")
		setSecond("updated")

		expect(values).toEqual(["first", "second", "updated"])
		owner.dispose()
	})

	it("memoizes derived values and propagates only changed results", () => {
		const [count, setCount] = createSignal(1)
		let computations = 0
		const doubled = createMemo(() => {
			computations++
			return Math.floor(count() / 2)
		})
		const observed: number[] = []
		const owner = runWithOwner(() => createEffect(() => observed.push(doubled())))

		setCount(2)
		setCount(3)
		setCount(4)

		expect(observed).toEqual([0, 1, 2])
		expect(computations).toBe(4)
		owner.dispose()
	})

	it("runs cleanups before rerunning an effect and when its owner is disposed", () => {
		const [value, setValue] = createSignal(0)
		const events: string[] = []
		const owner = runWithOwner(() =>
			createEffect(() => {
				events.push(`run:${value()}`)
				onCleanup(() => events.push(`cleanup:${value()}`))
			}),
		)

		setValue(1)
		expect(events).toEqual(["run:0", "cleanup:1", "run:1"])
		owner.dispose()
		expect(events).toEqual(["run:0", "cleanup:1", "run:1", "cleanup:1"])
	})
})

describe("Kinetic resources", () => {
	it("tracks loading, ready, and refetched resource values", async () => {
		const fetcher = async (id: number) => `item-${id}`
		const [resource, actions] = createResource(() => 7, fetcher)

		expect(resource.state()).toBe("pending")
		await actions.refetch()
		expect(resource()).toBe("item-7")
		expect(resource.loading()).toBe(false)
		expect(resource.state()).toBe("ready")

		actions.mutate("local")
		expect(resource()).toBe("local")
		expect(resource.state()).toBe("ready")
	})

	it("does not fetch while its source is disabled and resumes when enabled", async () => {
		const [source, setSource] = createSignal<number | false>(false)
		const fetched: number[] = []
		const [resource] = createResource(source, async (id) => {
			fetched.push(id)
			return id * 2
		})

		expect(resource.state()).toBe("unresolved")
		setSource(4)
		await Promise.resolve()
		await Promise.resolve()

		expect(fetched).toEqual([4])
		expect(resource()).toBe(8)
		expect(resource.state()).toBe("ready")
	})

	it("keeps the most recently requested result when requests resolve out of order", async () => {
		const [source, setSource] = createSignal(1)
		const pending = new Map<number, (value: string) => void>()
		const [resource] = createResource(
			source,
			(id) =>
				new Promise<string>((resolve) => {
					pending.set(id, resolve)
				}),
		)

		setSource(2)
		pending.get(2)?.("new")
		await Promise.resolve()
		pending.get(1)?.("old")
		await Promise.resolve()

		expect(resource()).toBe("new")
		expect(resource.state()).toBe("ready")
	})

	it("exposes fetch errors through resource state", async () => {
		const failure = new Error("load failed")
		const [resource] = createResource(async () => {
			throw failure
		})

		await Promise.resolve()
		await Promise.resolve()
		expect(resource.error()).toBe(failure)
		expect(resource.state()).toBe("error")
	})
})

describe("Kinetic stores", () => {
	it("tracks nested property reads and updates only subscribers", () => {
		const [store, setStore] = createStore({
			user: {name: "Ada"},
			status: "ready",
		})
		const names: string[] = []
		const statuses: string[] = []
		const owner = runWithOwner(() => {
			createEffect(() => names.push(store.user.name))
			createEffect(() => statuses.push(store.status))
		})

		setStore((draft) => {
			draft.user.name = "Grace"
		})
		expect(names).toEqual(["Ada", "Grace"])
		expect(statuses).toEqual(["ready"])

		setStore((draft) => {
			draft.status = "saved"
		})
		expect(statuses).toEqual(["ready", "saved"])
		owner.dispose()
	})

	it("batches recipe updates and supports array mutations", () => {
		const [store, setStore] = createStore({items: ["a", "b"]})
		const snapshots: string[] = []
		const owner = runWithOwner(() =>
			createEffect(() => snapshots.push(store.items.join(","))),
		)

		setStore((draft) => {
			draft.items.push("c")
			draft.items[0] = "A"
		})

		expect(snapshots).toEqual(["a,b", "A,b,c"])
		owner.dispose()
	})
})
