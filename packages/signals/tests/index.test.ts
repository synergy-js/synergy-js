import { describe, expect, rstest, test } from "rstack/test"
import {
	batch,
	createEffect,
	createMemo,
	createResource,
	createSignal,
	onCleanup,
	untrack,
} from "../src/index.js"

describe("@synergy-js/signals", () => {
	test("createSignal reads initial value and updates via direct value or updater function", () => {
		const [count, setCount] = createSignal(10)
		
		expect(count()).toBe(10)
		
		setCount(25)
		expect(count()).toBe(25)
		
		setCount((prev) => prev + 5)
		expect(count()).toBe(30)
	})
	
	test("createSignal skips notifying subscribers when set to the exact same value", () => {
		const [value, setValue] = createSignal("same")
		const spy = rstest.fn()
		
		createEffect(() => {
			spy(value())
		})
		
		expect(spy).toHaveBeenCalledTimes(1)
		setValue("same")
		expect(spy).toHaveBeenCalledTimes(1)
		
		setValue("changed")
		expect(spy).toHaveBeenCalledTimes(2)
	})
	
	test("createEffect tracks dynamic dependencies and drops stale branches", () => {
		const [useA, setUseA] = createSignal(true)
		const [a, setA] = createSignal("A1")
		const [b, setB] = createSignal("B1")
		const seen: string[] = []
		
		createEffect(() => {
			seen.push(useA() ? a() : b())
		})
		
		expect(seen).toEqual(["A1"])
		
		setB("B2")
		expect(seen).toEqual(["A1"])
		
		setA("A2")
		expect(seen).toEqual(["A1", "A2"])
		
		setUseA(false)
		expect(seen).toEqual(["A1", "A2", "B2"])
		
		setA("A3")
		expect(seen).toEqual(["A1", "A2", "B2"])
	})
	
	test("createMemo caches computed values, deduplicates identical outputs, and updates reactively", () => {
		const [count, setCount] = createSignal(2)
		const computeSpy = rstest.fn()
		const effectSpy = rstest.fn()
		
		const isEven = createMemo(() => {
			computeSpy()
			return count() % 2 === 0
		})
		
		createEffect(() => {
			effectSpy(isEven())
		})
		
		expect(isEven()).toBe(true)
		expect(computeSpy).toHaveBeenCalledTimes(1)
		expect(effectSpy).toHaveBeenCalledTimes(1)
		
		setCount(4)
		expect(isEven()).toBe(true)
		expect(computeSpy).toHaveBeenCalledTimes(2)
		expect(effectSpy).toHaveBeenCalledTimes(1)
		
		setCount(5)
		expect(isEven()).toBe(false)
		expect(computeSpy).toHaveBeenCalledTimes(3)
		expect(effectSpy).toHaveBeenCalledTimes(2)
	})
	
	test("batch() coalesces multiple signal writes into a single downstream effect run", () => {
		const [first, setFirst] = createSignal("Ada")
		const [last, setLast] = createSignal("Lovelace")
		const log: string[] = []
		
		createEffect(() => {
			log.push(`${first()} ${last()}`)
		})
		
		expect(log).toEqual(["Ada Lovelace"])
		
		batch(() => {
			setFirst("Grace")
			setLast("Hopper")
		})
		
		expect(log).toEqual(["Ada Lovelace", "Grace Hopper"])
	})
	
	test("untrack() reads signals without registering dependencies", () => {
		const [tracked, setTracked] = createSignal(1)
		const [ignored, setIgnored] = createSignal(100)
		const runs: number[] = []
		
		createEffect(() => {
			runs.push(tracked() + untrack(() => ignored()))
		})
		
		expect(runs.length).toBe(1)
		expect(runs[0]).toBe(101)
		
		setIgnored(200)
		expect(runs.length).toBe(1)
		
		setTracked(2)
		expect(runs.length).toBe(2)
		expect(runs[1]).toBe(202)
	})
	
	test("onCleanup() runs before each effect re-execution", () => {
		const [id, setId] = createSignal(1)
		const events: string[] = []
		
		createEffect(() => {
			const current = id()
			events.push(`sub:${current}`)
			onCleanup(() => {
				events.push(`unsub:${current}`)
			})
		})
		
		expect(events).toEqual(["sub:1"])
		
		setId(2)
		expect(events).toEqual(["sub:1", "unsub:1", "sub:2"])
		
		setId(3)
		expect(events).toEqual(["sub:1", "unsub:1", "sub:2", "unsub:2", "sub:3"])
	})
	
	test("createResource() resolves async fetchers, tracks reactive signals, and supports refetch", async () => {
		const [userId, setUserId] = createSignal(1)
		const fetchedIds: number[] = []
		
		let release!: (val: string) => void
		const fetcher = (id: number): Promise<string> => {
			fetchedIds.push(id)
			return new Promise<string>((resolve) => {
				release = resolve
			})
		}
		
		const [user, {refetch}] = createResource(() => fetcher(userId()))
		
		expect(user.loading()).toBe(true)
		expect(user()).toBeUndefined()
		expect(fetchedIds).toEqual(Array.of(1))
		
		release("User #1")
		await Promise.resolve()
		await Promise.resolve()
		
		expect(user.loading()).toBe(false)
		expect(user()).toBe("User #1")
		
		setUserId(2)
		expect(user.loading()).toBe(true)
		expect(fetchedIds).toEqual(Array.of(1, 2))
		
		release("User #2")
		await Promise.resolve()
		await Promise.resolve()
		
		expect(user.loading()).toBe(false)
		expect(user()).toBe("User #2")
		
		void refetch()
		expect(fetchedIds).toEqual(Array.of(1, 2, 2))
		release("User #2 (refetched)")
		await Promise.resolve()
		await Promise.resolve()
		
		expect(user()).toBe("User #2 (refetched)")
	})
})
