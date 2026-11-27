import { describe, expect, it } from "rstack/test"
import { createHooks, createPlugin } from "../src/index.ts"

describe("hookr", () => {
	type Hooks = {
		step?: (val: string) => Promise<void>
		run?: () => Promise<void>
	}
	
	it("runs hooks sequentially with callHook", async () => {
		const order: string[] = []
		const {hooks} = createHooks<Hooks>()
		
		hooks.hook("step", async (val) => {
			await Bun.sleep(10)
			order.push(`first:${val}`)
		})
		
		hooks.hook("step", async (val) => {
			order.push(`second:${val}`)
		})
		
		await hooks.callHook("step", "ok")
		expect(order).toEqual(["first:ok", "second:ok"])
	})
	
	it("runs hooks concurrently with callHookParallel", async () => {
		const order: string[] = []
		const {hooks} = createHooks<Hooks>()
		
		hooks.hook("run", async () => {
			await Bun.sleep(20)
			order.push("slow")
		})
		
		hooks.hook("run", async () => {
			await Bun.sleep(5)
			order.push("fast")
		})
		
		await hooks.callHookParallel("run")
		expect(order).toEqual(["fast", "slow"])
	})
	
	it("properly unsubscribes and supports hookOnce", async () => {
		let count = 0
		let onceCount = 0
		const {hooks} = createHooks<{ping: () => void}>()
		
		const off = hooks.hook("ping", () => count++)
		
		hooks.hookOnce("ping", () => onceCount++)
		
		await hooks.callHook("ping")
		off()
		await hooks.callHook("ping")
		
		expect(count).toBe(1)
		expect(onceCount).toBe(1)
	})
	
	it("bulk registers and unsubscribes via addHooks", async () => {
		const log: string[] = []
		const {hooks} = createHooks<{
			a: () => void
			b: () => void
		}>()
		
		const unsub = hooks.addHooks({
			a: [() => log.push("a1"), () => log.push("a2")],
			b: () => log.push("b1"),
		})
		
		await hooks.callHook("a")
		await hooks.callHook("b")
		expect(log).toEqual(["a1", "a2", "b1"])
		
		unsub()
		await hooks.callHook("a")
		await hooks.callHook("b")
		expect(log).toEqual(["a1", "a2", "b1"])
	})
	
	it("creates and passes a simple context object", async () => {
		type Hooks = {
			"increment": (val: number) => void
		}
		
		interface Context {
			env: string
			db?: {close: () => Promise<void>}
		}
		
		// 2. Create the app instance
		const appHooks = createHooks<Hooks, Context>({
			env: "production",
		})
		
		expect(appHooks.context.env).toBe("production")
	})
	
	it("preserves typed context without mutating the initial context", async () => {
		const initial = Object.freeze({env: "it", count: 0})
		
		const app = createHooks<
			{increment: () => void},
			{env: string, count: number}
		>({...initial})
		
		const plugin = createPlugin<typeof app>()
		
		const counterPlugin = plugin(({context, hooks}) => {
			hooks.hook("increment", () => {
				context.count += 1
			})
		})
		
		counterPlugin(app)
		await app.hooks.callHook("increment")
		
		expect(app.context.count).toBe(1)
		expect(initial.count).toBe(0)
	})
	
	it("profiles per-plugin execution with beforeEach and afterEach", async () => {
		const traces: {
			plugin: string,
			duration: number
		}[] = []
		
		const {hooks} = createHooks<{work: () => Promise<void>}>()
		
		hooks.beforeEach((e) => e.context.start = performance.now())
		
		hooks.afterEach((e) => {
			traces.push({
				plugin: e.plugin,
				duration: performance.now() - e.context.start,
			})
		})
		
		hooks.hook("work", async function namedWorker() {
			await Bun.sleep(5)
		})
		
		hooks.hook("work", async () => await Bun.sleep(5), {name: "labeledWorker"})
		
		await hooks.callHook("work")
		
		expect(traces.map((t) => t.plugin)).toEqual([
			"namedWorker",
			"labeledWorker",
		])
		expect(traces[0]!.duration).toBeGreaterThan(0)
		expect(traces[1]!.duration).toBeGreaterThan(0)
	})
	
	it("supports built-in SystemHooks and removeAllHooks", async () => {
		let startedPort = 0
		const {hooks} = createHooks()
		
		hooks.hook("server:start", ({port}) => {
			startedPort = port ?? 0
		})
		
		await hooks.callHook("server:start", {port: 8080})
		expect(startedPort).toBe(8080)
		
		hooks.removeAllHooks()
		await hooks.callHook("server:start", {port: 9090})
		expect(startedPort).toBe(8080)
	})
})
