import { describe, expect, it } from "rstack/test"
import { createHooks } from "../src/index.ts"

describe("hookr", () => {
	type Hooks = {
		"increment": (num: number) => void
		"request": (req: Request) => void | Promise<void>
		"response"?: (req: Request, res: Response) => void | Promise<void>
	}
	
	it("runs hooks sequentially with call", async () => {
		const order: string[] = []
		const {register, call} = createHooks<Hooks>()
		
		register("request", async (val) => {
			await Bun.sleep(10)
			order.push(`first:${val}`)
		})
		
		register("increment", async (val) => {
			const incr = val += 1
			order.push(`second:${incr}`)
		})
		
		expect(order).toEqual(["first:ok", "second:ok"])
	})
	
	it("runs hooks concurrently with callParallel", async () => {
		const order: string[] = []
		const {register, callParallel} = createHooks<{run: () => Promise<void>}>()
		
		register("run", async () => {
			await Bun.sleep(20)
			order.push("slow")
		})
		
		register("run", async () => {
			await Bun.sleep(5)
			order.push("fast")
		})
		
		await callParallel("run")
		expect(order).toEqual(["fast", "slow"])
	})
})
