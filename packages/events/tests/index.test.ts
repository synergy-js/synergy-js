import { describe, expect, it } from "rstack/test"
import { createHooks } from "../src/index.ts"

describe("events", () => {
	type Hooks = {
		"run": () => void
		"runAsync": () => Promise<void>
		"increment"?: (num: number) => void
		"request"?: (req: Request) => void | Promise<void>
		"response"?: (req: Request, res: Response) => void | Promise<void>
	}
	
	
	const {register, call, callParallel} = createHooks<Hooks>()
	
	it("runs hooks sequentially with call", async () => {
		const order: string[] = []
		register("run", () => order.push("1"))
		register("run", () => order.push("2"))
		await call("run")
		expect(order).toEqual(["1", "2"])
	})
	
	it("runs hooks concurrently with callParallel", async () => {
		const orderAsync: string[] = []
		
		register("runAsync", async () => {
			await Bun.sleep(20)
			orderAsync.push("slow")
		})
		
		register("runAsync", async () => {
			await Bun.sleep(5)
			orderAsync.push("fast")
		})
		
		await callParallel("runAsync")
		expect(orderAsync).toEqual(["fast", "slow"])
	})
})
