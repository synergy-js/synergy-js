import { afterAll, describe, expect, test } from "bun:test"

import { inject, InjectionToken } from "../src/"
import { container, ITestConfig } from "./helpers"

describe("Injection Token", () => {
	test("Uses custom injection token", () => {
		container.start(() => {
			const token = new InjectionToken<ITestConfig>("CustomToken", {
				factory: () => ({
					users: [
						{id: 1, name: "Alice", role: "Admin"},
						{id: 2, name: "Bob", role: "Developer"},
					],
				}),
			})
			const testing = inject(token)
			console.info(container.debugScopedCache)
			expect(testing.users[0].name).toBe("Alice")
			expect(testing.users[0].role).toBe("Admin")
			expect(testing.users[1].name).toBe("Bob")
			expect(testing.users[1].role).toBe("Developer")
		})
	})
	
	test("Fails when not run inside an active injection context", () => {
		const token = new InjectionToken<ITestConfig>("UsersToken", {
			factory: () => ({
				users: [
					{id: 1, name: "Alice", role: "Admin"},
					{id: 2, name: "Bob", role: "Developer"},
				],
			}),
		})
		expect(() => inject(token)).toThrow()
	})
	
	test("Fails when not run inside an active injection context and provide a detailed error message", () => {
		const token = new InjectionToken<ITestConfig>("UsersToken2", {
			factory: () => ({
				users: [
					{id: 1, name: "Alice", role: "Admin"},
					{id: 2, name: "Bob", role: "Developer"},
				],
			}),
		})
		
		expect(() => inject(token))
			.toThrow(`[Dependency Injection]: inject(${token.description}) called outside of an active injection context\n
Please make sure you created a DI container\nconst container = new RequestContainer()\n container.runInContext(() => {...})\n`)
	})
})

afterAll(() => {
	container.destroy()
})
